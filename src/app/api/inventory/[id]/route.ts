import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { inventoryItems } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const error = await requirePermission('Inventory', 'can_edit');
    if (error) return error;

    try {
        const { id: idStr } = await params;
        const id = Number(idStr);
        const data = await request.json();
        const { name, unit, description, default_price, tags, min_stock, low_stock } = data;

        if (!name || !unit) {
            return NextResponse.json({ error: 'Name and unit are required' }, { status: 400 });
        }

        await db.update(inventoryItems).set({
            name,
            unit,
            description: description || '',
            defaultPrice: String(Number(default_price) || 0),
            tags: tags || null,
            minStock: min_stock === undefined ? '10' : String(Number(min_stock)),
            lowStock: low_stock === undefined ? '20' : String(Number(low_stock))
        }).where(eq(inventoryItems.id, id));

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const error = await requirePermission('Inventory', 'can_delete');
    if (error) return error;

    try {
        const { id: idStr } = await params;
        const id = Number(idStr);
        
        await db.delete(inventoryItems).where(eq(inventoryItems.id, id));

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
    }
}
