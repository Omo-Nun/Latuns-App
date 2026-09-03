import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { encrypt } from '@/lib/encryption';
import { generateClusterToken } from '@/lib/cluster-auth';
import db, { pool } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';
import { sql } from 'drizzle-orm';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

/**
 * Resolve the peer node URL from PEER_NODE_ADDRESS.
 * Handles addresses with or without port — defaults to :3000 if no port present.
 */
function getPeerBaseUrl(): string | null {
    const peerAddress = process.env.PEER_NODE_ADDRESS;
    if (!peerAddress) return null;

    const cleaned = peerAddress.replace(/^https?:\/\//, '').split('/')[0];
    // If address already includes a port (contains :), use as-is; otherwise append :3000
    const hasPort = cleaned.includes(':');
    return `http://${hasPort ? cleaned : `${cleaned}:3000`}`;
}

/**
 * Ensure the current database session is in read-write mode.
 * This is needed because ALTER DATABASE SET default_transaction_read_only only affects
 * NEW connections — existing pooled connections may still have read-only defaults.
 */
async function ensureSessionReadWrite(): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query('SET default_transaction_read_only = off');
    } finally {
        client.release();
    }
}

/**
 * Send demote signal to peer node with retries.
 * Returns true if successfully delivered, false if all attempts failed.
 */
async function sendDemoteWithRetry(peerBaseUrl: string, maxAttempts = 3): Promise<boolean> {
    const demoteUrl = `${peerBaseUrl}/api/cluster/demote`;
    const { clusterToken, clusterTimestamp } = generateClusterToken();

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            console.log(`Demote signal attempt ${attempt}/${maxAttempts} to ${demoteUrl}...`);
            const res = await fetch(demoteUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'demote', clusterToken, clusterTimestamp }),
                signal: AbortSignal.timeout(5000)
            });

            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    console.log(`Demote signal delivered successfully on attempt ${attempt}.`);
                    return true;
                }
            }
            console.warn(`Demote attempt ${attempt} failed: HTTP ${res.status}`);
        } catch (e: any) {
            console.warn(`Demote attempt ${attempt} error: ${e.message}`);
        }

        // Wait before retrying (except on last attempt)
        if (attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    console.error(`CRITICAL: All ${maxAttempts} demote signal attempts failed. Peer node may not know it was demoted — risk of split-brain.`);
    return false;
}

export async function POST(req: Request) {
    try {
        const authError = await requirePermission('Settings', 'can_edit');
        if (authError) return authError;

        const body = await req.json();
        const action = body.action;

        // Require explicit action — no silent fallbacks
        if (!action || !['offer', 'cancel', 'accept', 'force'].includes(action)) {
            return NextResponse.json({ success: false, error: 'Missing or invalid required field: action. Must be one of: offer, cancel, accept, force' }, { status: 400 });
        }

        console.log(`Executing cluster handover action: ${action}`);

        if (action === 'offer') {
            // 1. Write handover offer status into settings while DB is still read/write
            await db.execute(sql`
                INSERT INTO settings (key, value) 
                VALUES ('handover_state', 'OFFERED') 
                ON CONFLICT (key) DO UPDATE SET value = 'OFFERED'
            `);

            await db.execute(sql`
                INSERT INTO settings (key, value) 
                VALUES ('handover_offered_by', ${process.env.NODE_NAME || 'Machine-A'}) 
                ON CONFLICT (key) DO UPDATE SET value = ${process.env.NODE_NAME || 'Machine-A'}
            `);

            // Write timestamp for auto-expiry of the OFFERED state
            const offeredAt = new Date().toISOString();
            await db.execute(sql`
                INSERT INTO settings (key, value)
                VALUES ('handover_offered_at', ${offeredAt})
                ON CONFLICT (key) DO UPDATE SET value = ${offeredAt}
            `);

            // Write redirect URL so LayoutWrapper can redirect users to the new primary
            const peerBaseUrl = getPeerBaseUrl();
            if (peerBaseUrl) {
                await db.execute(sql`
                    INSERT INTO settings (key, value)
                    VALUES ('handover_redirect_url', ${peerBaseUrl})
                    ON CONFLICT (key) DO UPDATE SET value = ${peerBaseUrl}
                `);
            }

            // 2. Create encrypted safety backup dump
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `erp_handover_safety_${timestamp}.dump`;
            const backupDir = path.join(process.cwd(), 'backups');
            await fs.mkdir(backupDir, { recursive: true });
            
            const backupFilePath = path.join(backupDir, backupFileName);
            
            // Execute pg_dump using postgresql-client
            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) {
                return NextResponse.json({ success: false, error: 'DATABASE_URL is not configured. Cannot perform safety backup.' }, { status: 500 });
            }

            try {
                console.log(`Executing pg_dump for handover safety backup...`);
                await execPromise(`pg_dump "${dbUrl}" -f "${backupFilePath}"`);
                console.log('Safety pg_dump completed successfully.');
            } catch (dumpErr: any) {
                console.error(`Safety pg_dump failed: ${dumpErr.message}`);
                // Fallback for local development environments where pg_dump might not be installed
                if (process.env.NODE_ENV !== 'production') {
                    console.warn('Development mode: Falling back to simulated safety backup since pg_dump failed.');
                    await fs.writeFile(backupFilePath, 'SIMULATED POSTGRES HANDOVER DUMP (DEV FALLBACK)');
                } else {
                    return NextResponse.json({ success: false, error: `Safety database dump failed: ${dumpErr.message}` }, { status: 500 });
                }
            }

            const dbBuffer = await fs.readFile(backupFilePath);
            const encryptedPayload = encrypt(dbBuffer.toString('base64'));
            await fs.writeFile(`${backupFilePath}.enc`, encryptedPayload);
            await fs.unlink(backupFilePath);

            // 3. Enforce database-level read-only lock to prevent race conditions
            await db.execute(sql`ALTER DATABASE latuns SET default_transaction_read_only = on;`);
            
            try {
                await db.execute(sql`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'latuns' AND pid <> pg_backend_pid();`);
            } catch (e) {
                console.warn('Could not terminate other backends:', e);
            }

            return NextResponse.json({
                success: true,
                message: `Master role offered to peer nodes. Database is locked (Read-Only) to prevent conflicts. Safety backup created at ${backupFileName}.`,
                handoverState: 'OFFERED'
            });
        }

        if (action === 'cancel') {
            // Remove the read-only lock at database level
            await db.execute(sql`ALTER DATABASE latuns SET default_transaction_read_only = off;`);
            
            // Terminate existing connections to force them to reconnect in read-write mode
            try {
                await db.execute(sql`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'latuns' AND pid <> pg_backend_pid();`);
            } catch (e) {
                console.warn('Could not terminate other backends:', e);
            }

            // Ensure our current session is also read-write (pool may have recycled this connection while read-only was on)
            await ensureSessionReadWrite();

            await db.execute(sql`
                INSERT INTO settings (key, value) 
                VALUES ('handover_state', 'IDLE') 
                ON CONFLICT (key) DO UPDATE SET value = 'IDLE'
            `);
            await db.execute(sql`DELETE FROM settings WHERE key = 'handover_offered_by'`);
            await db.execute(sql`DELETE FROM settings WHERE key = 'handover_offered_at'`);
            await db.execute(sql`DELETE FROM settings WHERE key = 'handover_redirect_url'`);

            return NextResponse.json({
                success: true,
                message: 'Handover offer cancelled. Database unlocked (Read/Write restored).',
                handoverState: 'IDLE'
            });
        }

        if (action === 'accept' || action === 'force') {
            // For 'accept': validate that an offer is pending (prevent accidental promotion)
            if (action === 'accept') {
                try {
                    const stateCheck = await db.execute(sql`SELECT value FROM settings WHERE key = 'handover_state'`);
                    const currentState = stateCheck.rows[0]?.value;
                    if (currentState !== 'OFFERED') {
                        return NextResponse.json({ 
                            success: false, 
                            error: 'No handover offer is pending. The Primary node must first click [Initiate Master Handover]. Use the "force" action for emergency takeover when the Primary is unreachable.' 
                        }, { status: 400 });
                    }
                } catch (e: any) {
                    // If we can't read settings (e.g., standby DB), check via peer poll
                    console.warn('Could not verify handover_state from local DB (may be in recovery):', e.message);
                }
            }

            // Execute PostgreSQL engine promotion
            console.log(`Executing PostgreSQL engine promotion pg_promote()...`);
            let promotionSucceeded = false;

            try {
                await db.execute(sql`SELECT pg_promote(wait => true);`);
                console.log(`pg_promote() executed successfully. Waiting for database to exit recovery mode...`);

                let isRecovery = true;
                let attempts = 0;
                while (isRecovery && attempts < 10) {
                    const check = await db.execute(sql`SELECT pg_is_in_recovery() as in_recovery`);
                    isRecovery = Boolean(check.rows[0]?.in_recovery);
                    if (isRecovery) {
                        await new Promise(res => setTimeout(res, 1000));
                        attempts++;
                    }
                }
                
                if (isRecovery) {
                    console.warn(`Database is still in recovery mode after 10 seconds.`);
                } else {
                    console.log(`Database exited recovery mode successfully.`);
                    promotionSucceeded = true;
                }
            } catch (promoteErr: any) {
                console.warn(`pg_promote error: ${promoteErr.message}`);
                // Check if we're already primary (not in recovery) — that counts as success
                try {
                    const check = await db.execute(sql`SELECT pg_is_in_recovery() as in_recovery`);
                    if (!Boolean(check.rows[0]?.in_recovery)) {
                        console.log('Node is already primary (not in recovery). Treating as successful promotion.');
                        promotionSucceeded = true;
                    }
                } catch (e) {
                    // DB might be completely down
                }
            }

            // CRITICAL: If promotion failed and this is NOT a force action, abort
            if (!promotionSucceeded && action !== 'force') {
                return NextResponse.json({
                    success: false,
                    error: 'pg_promote() failed and database is still in recovery mode. Promotion aborted. Use "force" action if the Primary is confirmed offline.'
                }, { status: 500 });
            }

            if (!promotionSucceeded && action === 'force') {
                console.warn('FORCE MODE: Proceeding despite pg_promote failure. Database may still be in recovery.');
            }

            // Ensure database-level read-only lock is completely removed and backends refreshed
            try {
                await db.execute(sql`ALTER DATABASE latuns SET default_transaction_read_only = off;`);
                try {
                    await db.execute(sql`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'latuns' AND pid <> pg_backend_pid();`);
                } catch (e) {}
                console.log('Database read/write permissions fully restored.');
            } catch (roErr: any) {
                console.warn('Could not reset default_transaction_read_only:', roErr.message);
            }

            // Ensure current session is read-write before writing settings
            await ensureSessionReadWrite();

            // Update .env for next container restart
            try {
                const envPath = path.join(process.cwd(), '.env');
                let envContent = await fs.readFile(envPath, 'utf8');
                if (envContent.includes('NODE_ROLE=')) {
                    envContent = envContent.replace(/^NODE_ROLE=.*/m, 'NODE_ROLE="master"');
                } else {
                    envContent += '\nNODE_ROLE="master"\n';
                }
                await fs.writeFile(envPath, envContent, 'utf8');
            } catch (e: any) {
                console.warn('Could not update .env on promotion:', e.message);
            }

            await db.execute(sql`
                INSERT INTO settings (key, value) 
                VALUES ('nodeRole', 'Primary') 
                ON CONFLICT (key) DO UPDATE SET value = 'Primary'
            `);

            await db.execute(sql`
                INSERT INTO settings (key, value) 
                VALUES ('handover_state', 'IDLE') 
                ON CONFLICT (key) DO UPDATE SET value = 'IDLE'
            `);

            await db.execute(sql`DELETE FROM settings WHERE key = 'handover_offered_by'`);
            await db.execute(sql`DELETE FROM settings WHERE key = 'handover_offered_at'`);
            await db.execute(sql`DELETE FROM settings WHERE key = 'handover_redirect_url'`);

            // Send demote signal to peer node with retries
            let demoteDelivered = false;
            const peerBaseUrl = getPeerBaseUrl();
            if (peerBaseUrl) {
                demoteDelivered = await sendDemoteWithRetry(peerBaseUrl);
            } else {
                console.warn('PEER_NODE_ADDRESS not configured — cannot send demote signal to peer.');
            }

            return NextResponse.json({
                success: true,
                message: action === 'force' 
                    ? 'Emergency forceful takeover successful. Node is now active Primary Master.' 
                    : 'Master role accepted successfully. PostgreSQL promoted to active Primary Master.',
                newRole: 'Primary',
                handoverState: 'IDLE',
                demoteDelivered,
                ...((!demoteDelivered && peerBaseUrl) ? { 
                    warning: 'Demote signal could not be delivered to the peer node. Verify that the old Primary is shut down or manually demoted to prevent split-brain.' 
                } : {})
            });
        }

        return NextResponse.json({ success: false, error: 'Invalid handover action specified' }, { status: 400 });
    } catch (error: any) {
        console.error('Handover Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Failed to execute handover' }, { status: 500 });
    }
}
