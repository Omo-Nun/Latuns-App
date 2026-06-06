import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const data = await request.json();
        const { name, description, classification, image_url, purchase_date, purchase_cost, current_value, status } = data;

        if (!name) {
            return NextResponse.json({ error: 'Asset name is required' }, { status: 400 });
        }

        const stmt = db.prepare(`
            UPDATE company_assets
            SET name = ?, description = ?, classification = ?, image_url = ?, purchase_date = ?, purchase_cost = ?, current_value = ?, status = ?
            WHERE id = ?
        `);

        const info = stmt.run(
            name,
            description || '',
            classification || '',
            image_url || null,
            purchase_date || null,
            purchase_cost || 0,
            current_value || 0,
            status || 'Active',
            id
        );

        if (info.changes === 0) {
            return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Failed to update asset' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const stmt = db.prepare('DELETE FROM company_assets WHERE id = ?');
        const info = stmt.run(id);

        if (info.changes === 0) {
            return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete asset' }, { status: 500 });
    }
}
