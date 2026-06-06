import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const logs = db.prepare('SELECT * FROM inventory_logs WHERE item_id = ? ORDER BY created_at DESC').all(id);
        return NextResponse.json(logs);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch inventory history' }, { status: 500 });
    }
}
