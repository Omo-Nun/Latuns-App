import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
    try {
        // Query to check replication lag in postgres for the primary node
        let replication = [];
        if (process.env.NODE_ROLE?.toLowerCase() === 'master' || process.env.NODE_ROLE?.toLowerCase() === 'primary') {
            const lagResult = await db.execute(sql`
                SELECT client_addr, state, sync_state, 
                       pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS replication_lag_bytes 
                FROM pg_stat_replication;
            `);
            replication = lagResult.rows;
        } else {
            // For replica node, we can check if it's receiving
            const recvResult = await db.execute(sql`
                SELECT status, last_msg_send_time, last_msg_receipt_time 
                FROM pg_stat_wal_receiver;
            `);
            replication = recvResult.rows;
        }
        
        return NextResponse.json({
            nodeName: process.env.NODE_NAME || 'Unknown',
            nodeRole: process.env.NODE_ROLE || 'Unknown',
            peerAddress: process.env.PEER_NODE_ADDRESS || 'Unknown',
            replication,
            syncthingUi: `http://${process.env.PEER_NODE_ADDRESS || 'localhost'}:8384`
        });
    } catch (error: any) {
        return NextResponse.json({ 
            nodeName: process.env.NODE_NAME || 'Unknown',
            nodeRole: process.env.NODE_ROLE || 'Unknown',
            error: error.message 
        }, { status: 500 });
    }
}
