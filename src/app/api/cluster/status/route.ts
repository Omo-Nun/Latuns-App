import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { settings } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';

/** How long an OFFERED state can persist before auto-cancelling (10 minutes) */
const OFFERED_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Resolve the peer node URL from environment variables.
 * Handles addresses with or without port — defaults to :3000 if no port present.
 */
function getPeerUrl(): string | null {
    const peerAddress = process.env.PEER_NODE_ADDRESS || process.env.NEXT_PUBLIC_PEER_NODE_ADDRESS || null;
    if (!peerAddress) return null;

    const cleaned = peerAddress.replace(/^https?:\/\//, '').split('/')[0];
    const hasPort = cleaned.includes(':');
    return `http://${hasPort ? cleaned : `${cleaned}:3000`}`;
}

function getPeerHost(): string | null {
    const peerAddress = process.env.PEER_NODE_ADDRESS || process.env.NEXT_PUBLIC_PEER_NODE_ADDRESS || null;
    if (!peerAddress) return null;
    return peerAddress.replace(/^https?:\/\//, '').split('/')[0];
}

/**
 * Fetch status from the peer node. Returns a peerStatus object.
 */
async function fetchPeerStatus(peerUrl: string): Promise<{
    status: 'online' | 'offline';
    nodeName?: string;
    nodeRole?: string;
    lastBackup?: string;
    handoverState?: string;
    handoverOfferedBy?: string;
}> {
    try {
        const res = await fetch(`${peerUrl}/api/cluster/status`, {
            signal: AbortSignal.timeout(2000)
        });

        if (res.ok) {
            const data = await res.json();
            return {
                status: 'online',
                nodeName: data.nodeName || 'Peer Node',
                nodeRole: data.nodeRole || 'Unknown',
                lastBackup: data.lastBackup || 'Never',
                handoverState: data.handoverState,
                handoverOfferedBy: data.handoverOfferedBy
            };
        }
    } catch (e) {
        // Peer unreachable
    }

    return { status: 'offline' };
}

export async function GET() {
    try {
        let isRecovery = false;
        let isDbConnected = false;

        // Wrap database check with a 2-second timeout so poller never hangs
        const dbCheckPromise = Promise.race([
            (async () => {
                const recoveryCheck = await db.execute(sql`SELECT pg_is_in_recovery() as in_recovery`);
                return Boolean(recoveryCheck.rows[0]?.in_recovery);
            })(),
            new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('DB Timeout')), 2000))
        ]);

        try {
            isRecovery = await dbCheckPromise;
            isDbConnected = true;
        } catch (e: any) {
            console.warn('Cluster status DB query timed out or failed:', e.message);
        }

        let dbRole = process.env.NODE_ROLE || (isRecovery ? 'Standby' : 'Primary');
        let handoverState = 'IDLE';
        let handoverOfferedBy = null;
        let handoverRedirectUrl = null;
        let handoverOfferedAt = null;
        let lastBackup = 'Never';

        if (isDbConnected) {
            try {
                const settingsRows = await db.select().from(settings);
                const roleSetting = settingsRows.find(s => s.key === 'nodeRole');
                if (roleSetting?.value) {
                    dbRole = roleSetting.value;
                }

                const stateSetting = settingsRows.find(s => s.key === 'handover_state');
                if (stateSetting?.value) {
                    handoverState = stateSetting.value;
                }

                const offeredBySetting = settingsRows.find(s => s.key === 'handover_offered_by');
                if (offeredBySetting?.value) {
                    handoverOfferedBy = offeredBySetting.value;
                }

                const redirectSetting = settingsRows.find(s => s.key === 'handover_redirect_url');
                if (redirectSetting?.value) {
                    handoverRedirectUrl = redirectSetting.value;
                }

                const offeredAtSetting = settingsRows.find(s => s.key === 'handover_offered_at');
                if (offeredAtSetting?.value) {
                    handoverOfferedAt = offeredAtSetting.value;
                }

                const backupSetting = settingsRows.find(s => s.key === 'lastBackup');
                if (backupSetting?.value) {
                    lastBackup = backupSetting.value;
                }
            } catch (e: any) {
                // Ignore query errors in read-only / recovering mode
            }
        }

        // Auto-cancel expired OFFERED state (10-minute timeout)
        if (handoverState === 'OFFERED' && handoverOfferedAt && isDbConnected && !isRecovery) {
            const offeredAge = Date.now() - new Date(handoverOfferedAt).getTime();
            if (offeredAge > OFFERED_TIMEOUT_MS) {
                console.warn(`Handover offer expired after ${Math.round(offeredAge / 60000)} minutes. Auto-cancelling and unlocking database.`);
                try {
                    await db.execute(sql`ALTER DATABASE latuns SET default_transaction_read_only = off;`);
                    try {
                        await db.execute(sql`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'latuns' AND pid <> pg_backend_pid();`);
                    } catch (e) {}

                    await db.execute(sql`INSERT INTO settings (key, value) VALUES ('handover_state', 'IDLE') ON CONFLICT (key) DO UPDATE SET value = 'IDLE'`);
                    await db.execute(sql`DELETE FROM settings WHERE key = 'handover_offered_by'`);
                    await db.execute(sql`DELETE FROM settings WHERE key = 'handover_offered_at'`);
                    await db.execute(sql`DELETE FROM settings WHERE key = 'handover_redirect_url'`);

                    handoverState = 'IDLE';
                    handoverOfferedBy = null;
                    handoverRedirectUrl = null;
                    handoverOfferedAt = null;
                } catch (e: any) {
                    console.error('Failed to auto-cancel expired handover offer:', e.message);
                }
            }
        }

        if (isRecovery || !isDbConnected) {
            dbRole = 'Standby';
        } else if (dbRole.toLowerCase() === 'master' || dbRole.toLowerCase() === 'primary') {
            dbRole = 'Primary';
        }

        // Fetch peer node status
        const peerUrl = getPeerUrl();
        const cleanPeerHost = getPeerHost();
        let peerStatus: any = { status: 'offline' };

        if (peerUrl) {
            peerStatus = await fetchPeerStatus(peerUrl);

            // If this node is Standby and local handoverState is IDLE,
            // check if the peer (Primary) has offered handover
            if (dbRole === 'Standby' && handoverState !== 'OFFERED' && peerStatus.status === 'online') {
                if (peerStatus.handoverState === 'OFFERED') {
                    handoverState = 'OFFERED';
                    handoverOfferedBy = peerStatus.handoverOfferedBy || peerStatus.nodeName || 'Primary Master';
                }
            }
        }

        return NextResponse.json({
            success: true,
            nodeName: process.env.NODE_NAME || 'latuns-node',
            nodeRole: dbRole,
            isRecovery,
            isDbConnected,
            canWrite: dbRole === 'Primary' && !isRecovery,
            handoverState,
            handoverOfferedBy,
            handover_redirect_url: handoverRedirectUrl || null,
            lastBackup,
            peerAddress: cleanPeerHost,
            peerStatus,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            nodeName: process.env.NODE_NAME || 'latuns-node',
            nodeRole: 'Standby',
            isRecovery: true,
            isDbConnected: false,
            canWrite: false,
            handoverState: 'IDLE',
            peerStatus: { status: 'offline' },
            error: error.message || 'Failed to fetch cluster status'
        });
    }
}
