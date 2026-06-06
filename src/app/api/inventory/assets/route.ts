import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const assets = db.prepare('SELECT * FROM company_assets ORDER BY created_at DESC').all();
        return NextResponse.json(assets);
    } catch (error) {
        console.error('Failed to fetch assets error:', error);
        return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const data = await request.json();
        const { name, description, classification, image_url, purchase_date, purchase_cost, current_value, status } = data;

        if (!name) {
            return NextResponse.json({ error: 'Asset name is required' }, { status: 400 });
        }

        const stmt = db.prepare(`
            INSERT INTO company_assets (name, description, classification, image_url, purchase_date, purchase_cost, current_value, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(
            name,
            description || '',
            classification || '',
            image_url || null,
            purchase_date || null,
            purchase_cost || 0,
            current_value || 0,
            status || 'Active'
        );

        return NextResponse.json({ id: Number(info.lastInsertRowid), success: true }, { status: 201 });
    } catch (error) {
        console.error('Failed to create asset error:', error);
        return NextResponse.json({ error: 'Failed to create asset' }, { status: 500 });
    }
}
