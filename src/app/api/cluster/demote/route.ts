import { NextResponse } from 'next/server';
import { verifyClusterToken } from '@/lib/cluster-auth';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        
        if (body.action !== 'demote') {
            return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
        }

        // Verify cluster authentication token from peer node
        if (!verifyClusterToken(body.clusterToken, body.clusterTimestamp)) {
            console.warn('Demote request rejected: invalid or missing cluster authentication token.');
            return NextResponse.json({ success: false, error: 'Forbidden: Invalid cluster authentication' }, { status: 403 });
        }

        console.log(`Received authenticated DEMOTE signal from peer node.`);
        
        // Write the demote signal to data directory
        const dataDir = path.join(process.cwd(), 'data');
        await fs.mkdir(dataDir, { recursive: true });
        
        const signalPath = path.join(dataDir, 'demote.signal');
        await fs.writeFile(signalPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            reason: 'Peer node took over as Primary Master'
        }));

        console.log(`Demote signal file created at ${signalPath}`);

        return NextResponse.json({
            success: true,
            message: 'Demote signal received successfully.'
        });
    } catch (error: any) {
        console.error('Demote Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
