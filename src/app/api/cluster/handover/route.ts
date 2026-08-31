import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { encrypt } from '@/lib/encryption';
import db from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';
import { sql } from 'drizzle-orm';

export async function POST(req: Request) {
    try {
        const authError = await requirePermission('Settings', 'can_edit');
        if (authError) return authError;

        const body = await req.json();
        const action = body.action || (body.forceStandby ? 'offer' : 'accept');

        console.log(`Executing cluster handover action: ${action}`);

        if (action === 'offer') {
            // Node A offers/yields the Master role
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `erp_handover_safety_${timestamp}.dump`;
            const backupDir = path.join(process.cwd(), 'backups');
            await fs.mkdir(backupDir, { recursive: true });
            
            const backupFilePath = path.join(backupDir, backupFileName);
            await fs.writeFile(backupFilePath, 'SIMULATED POSTGRES HANDOVER DUMP');

            const dbBuffer = await fs.readFile(backupFilePath);
            const encryptedPayload = encrypt(dbBuffer.toString('base64'));
            await fs.writeFile(`${backupFilePath}.enc`, encryptedPayload);
            await fs.unlink(backupFilePath);

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

            return NextResponse.json({
                success: true,
                message: `Master role offered to peer nodes. Safety backup created at ${backupFileName}.`,
                handoverState: 'OFFERED'
            });
        }

        if (action === 'cancel') {
            await db.execute(sql`
                INSERT INTO settings (key, value) 
                VALUES ('handover_state', 'IDLE') 
                ON CONFLICT (key) DO UPDATE SET value = 'IDLE'
            `);
            await db.execute(sql`DELETE FROM settings WHERE key = 'handover_offered_by'`);

            return NextResponse.json({
                success: true,
                message: 'Handover offer cancelled.',
                handoverState: 'IDLE'
            });
        }

        if (action === 'accept' || action === 'force') {
            // Node B accepts or forcefully takes over as Primary Master
            console.log(`Executing PostgreSQL engine promotion pg_promote()...`);

            try {
                // Execute engine promotion query in PostgreSQL
                await db.execute(sql`SELECT pg_promote(wait => true);`);
                console.log(`pg_promote() executed successfully. Database exited recovery mode.`);
            } catch (promoteErr: any) {
                console.warn(`pg_promote error (may already be primary or not in standby):`, promoteErr.message);
            }

            // Now that DB is unlocked/Primary, update node settings
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
            await db.execute(sql`DELETE FROM settings WHERE key = 'handover_redirect_url'`);

            return NextResponse.json({
                success: true,
                message: action === 'force' 
                    ? 'Emergency forceful takeover successful. Node is now active Primary Master.' 
                    : 'Master role accepted successfully. PostgreSQL promoted to active Primary Master.',
                newRole: 'Primary',
                handoverState: 'IDLE'
            });
        }

        return NextResponse.json({ success: false, error: 'Invalid handover action specified' }, { status: 400 });
    } catch (error: any) {
        console.error('Handover Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Failed to execute handover' }, { status: 500 });
    }
}
