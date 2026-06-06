import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const charts = db.prepare('SELECT * FROM custom_charts ORDER BY created_at DESC').all();
        return NextResponse.json(charts);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch custom charts' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, config } = body;

        if (!name || !config) {
            return NextResponse.json({ error: 'Name and config are required' }, { status: 400 });
        }

        const stmt = db.prepare('INSERT INTO custom_charts (name, config) VALUES (?, ?)');
        const result = stmt.run(name, JSON.stringify(config));

        return NextResponse.json({ id: result.lastInsertRowid, success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save chart' }, { status: 500 });
    }
}
