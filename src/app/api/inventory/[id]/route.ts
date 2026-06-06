import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const error = await requirePermission('Inventory', 'can_edit');
    if (error) return error;

    try {
        const { id } = await params;
        const data = await request.json();
        const { name, unit, description, default_price, tags, min_stock, low_stock } = data;

        if (!name || !unit) {
            return NextResponse.json({ error: 'Name and unit are required' }, { status: 400 });
        }

        const stmt = db.prepare('UPDATE inventory_items SET name = ?, unit = ?, description = ?, default_price = ?, tags = ?, min_stock = ?, low_stock = ? WHERE id = ?');
        stmt.run(name, unit, description || '', default_price || 0, tags || null, min_stock === undefined ? 10 : min_stock, low_stock === undefined ? 20 : low_stock, id);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const error = await requirePermission('Inventory', 'can_delete');
    if (error) return error;

    try {
        const { id } = await params;
        const stmt = db.prepare('DELETE FROM inventory_items WHERE id = ?');
        stmt.run(id);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
    }
}
