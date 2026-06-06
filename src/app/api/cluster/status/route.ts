import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import db from '@/lib/db';

export async function GET(req: Request) {
    try {
        const authError = await requirePermission('Settings', 'can_view');
        if (authError) return authError;

        const getSetting = (key: string, defaultValue: string = '') => {
            const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
            return row ? row.value : defaultValue;
        };

        const nodeName = process.env.NODE_NAME || getSetting('nodeName', 'Node Alpha');
        const nodeRole = process.env.NODE_ROLE || getSetting('nodeRole', 'Primary');
        const nodeIp = process.env.NODE_IP || getSetting('nodeIp', '192.168.1.100');
        const lastBackup = getSetting('lastBackup', 'Never');
        const lastHeartbeat = getSetting('lastHeartbeat', 'Never');
        const handoverRedirectUrl = getSetting('handover_redirect_url', '');

        // Ping peer node if address is configured
        const peerAddress = process.env.PEER_NODE_ADDRESS;
        let peerStatus = null;
        if (peerAddress) {
            try {
                // AbortController to prevent hanging the status request
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                
                const peerRes = await fetch(`http://${peerAddress}:3000/api/cluster/status`, { 
                    method: 'GET',
                    headers: { 'Cookie': req?.headers?.get('cookie') || '' }, // Pass cookies just in case, though might not authenticate across domains if secret differs
                    signal: controller.signal 
                });
                clearTimeout(timeoutId);
                
                if (peerRes.ok) {
                    peerStatus = await peerRes.json();
                } else {
                    peerStatus = { status: 'offline', error: 'HTTP ' + peerRes.status };
                }
            } catch (err: any) {
                peerStatus = { status: 'offline', error: err.message };
            }
        }

        const status = {
            nodeName,
            nodeRole,
            nodeIp,
            lastBackup,
            lastHeartbeat,
            handover_redirect_url: handoverRedirectUrl,
            peerStatus,
            status: 'online'
        };

        return NextResponse.json(status);
    } catch (error: any) {
        console.error('Cluster Status Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
