import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { settings } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';

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
            } catch (e: any) {
                // Ignore query errors in read-only / recovering mode
            }
        }

        if (isRecovery || !isDbConnected) {
            dbRole = 'Standby';
        } else if (dbRole.toLowerCase() === 'master' || dbRole.toLowerCase() === 'primary') {
            dbRole = 'Primary';
        }

        const peerAddress = process.env.PEER_NODE_ADDRESS || process.env.NEXT_PUBLIC_PEER_NODE_ADDRESS || null;
        const cleanPeerHost = peerAddress ? peerAddress.replace(/^https?:\/\//, '').split('/')[0] : null;

        // If this node is in Standby mode and local handoverState is IDLE, poll the Primary peer node to see if it offered handover
        if (dbRole === 'Standby' && cleanPeerHost && handoverState !== 'OFFERED') {
            try {
                const peerRes = await fetch(`http://${cleanPeerHost}:3000/api/cluster/status`, {
                    signal: AbortSignal.timeout(1500)
                });
                if (peerRes.ok) {
                    const peerData = await peerRes.json();
                    if (peerData.handoverState === 'OFFERED') {
                        handoverState = 'OFFERED';
                        handoverOfferedBy = peerData.handoverOfferedBy || peerData.nodeName || 'Primary Master';
                    }
                }
            } catch (peerErr) {
                // Peer unreachable or busy, ignore
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
            peerAddress: cleanPeerHost,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        return NextResponse.json({
            success: true,
            nodeName: process.env.NODE_NAME || 'latuns-node',
            nodeRole: 'Standby',
            isRecovery: true,
            isDbConnected: false,
            canWrite: false,
            handoverState: 'IDLE',
            error: error.message || 'Failed to fetch cluster status'
        });
    }
}
