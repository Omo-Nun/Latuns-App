import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import db from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: Request) {
    try {
        const authError = await requirePermission('Settings', 'can_edit');
        if (authError) return authError;

        const body = await req.json();
        const { nodeId, forceStandby } = body;

        console.log(`Executing cluster handover. Updating role...`);
        
        // 1. Take a safety snapshot before yielding Primary status
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `erp_handover_safety_${timestamp}.db`;
        
        const backupDir = path.join(process.cwd(), 'backups');
        await fs.mkdir(backupDir, { recursive: true });
        
        const backupFilePath = path.join(backupDir, backupFileName);
        db.exec(`VACUUM INTO '${backupFilePath}'`);
        
        // 2. Update role in settings table
        const newRole = forceStandby ? 'Standby' : 'Primary';
        
        db.prepare(`
            INSERT INTO settings (key, value) 
            VALUES ('nodeRole', ?) 
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `).run(newRole);

        // 3. Save redirect URL if we are stepping down, or clear it if stepping up
        if (newRole === 'Standby') {
            const redirectUrl = body.redirectUrl || (process.env.PEER_NODE_ADDRESS ? `http://${process.env.PEER_NODE_ADDRESS}:3000` : null);
            if (redirectUrl) {
                db.prepare(`
                    INSERT INTO settings (key, value) 
                    VALUES ('handover_redirect_url', ?) 
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value
                `).run(redirectUrl);
            }
        } else {
            db.prepare(`DELETE FROM settings WHERE key = 'handover_redirect_url'`).run();
        }

        return NextResponse.json({ 
            success: true, 
            message: `Handover successful. Safety backup created at ${backupFileName}. Current node role is now ${newRole}.`,
            newRole
        });
    } catch (error: any) {
        console.error('Handover Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Failed to execute handover' }, { status: 500 });
    }
}
