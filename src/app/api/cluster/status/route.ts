import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { settings } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';

export async function GET() {
    try {
        let isRecovery = false;
        try {
            const recoveryCheck = await db.execute(sql`SELECT pg_is_in_recovery() as in_recovery`);
            isRecovery = Boolean(recoveryCheck.rows[0]?.in_recovery);
        } catch (e: any) {
            console.warn('Could not query pg_is_in_recovery:', e.message);
        }

        let dbRole = process.env.NODE_ROLE || (isRecovery ? 'Standby' : 'Primary');
        let handoverState = 'IDLE';
        let handoverOfferedBy = null;

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
        } catch (e: any) {
            // DB might be locked or uninitialized, use default values
        }

        // PostgreSQL recovery state is the ground truth for role detection.
        // If the engine is in recovery mode, this node is definitively a Standby,
        // regardless of any stale 'nodeRole' setting left from a previous role.
        if (isRecovery) {
            dbRole = 'Standby';
        } else if (dbRole.toLowerCase() === 'master') {
            dbRole = 'Primary';
        }

        return NextResponse.json({
            success: true,
            nodeName: process.env.NODE_NAME || 'latuns-node',
            nodeRole: dbRole,
            isRecovery,
            canWrite: !isRecovery,
            handoverState,
            handoverOfferedBy,
            peerAddress: process.env.PEER_NODE_ADDRESS || null,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to fetch cluster status'
        }, { status: 500 });
    }
}
