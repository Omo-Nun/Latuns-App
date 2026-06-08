import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { inventoryItems, inventoryLogs, stockRequests } from '@/lib/schema';
import { asc, sql } from 'drizzle-orm';
import { toSnakeCase } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
    const error = await requirePermission('Inventory', 'can_view');
    if (error) return error;

    try {
        const items = await db.select().from(inventoryItems).orderBy(asc(inventoryItems.displayOrder), asc(inventoryItems.name));
        return NextResponse.json(toSnakeCase(items));
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const error = await requirePermission('Inventory', 'can_edit');
    if (error) return error;

    try {
        const data = await request.json();
        const { name, unit, description, default_price, tags, min_stock, low_stock } = data;

        if (!name || !unit) {
            return NextResponse.json({ error: 'Name and unit are required' }, { status: 400 });
        }

        const insertResult = await db.insert(inventoryItems).values({
            name,
            unit,
            description: description || '',
            defaultPrice: Number(default_price) || 0,
            tags: tags || null,
            minStock: min_stock === undefined ? 10 : Number(min_stock),
            lowStock: low_stock === undefined ? 20 : Number(low_stock)
        }).returning({ id: inventoryItems.id });

        return NextResponse.json({ id: insertResult[0].id }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to add item' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const error = await requirePermission('Inventory', 'can_delete');
    if (error) return error;

    try {
        const { searchParams } = new URL(request.url);
        if (searchParams.get('action') !== 'reset_all_confirm') {
            return NextResponse.json({ error: 'To reset all inventory, use action=reset_all_confirm' }, { status: 400 });
        }

        await db.transaction(async (tx) => {
            // Note: Update all inventory stock to 0
            await tx.update(inventoryItems).set({ stockQty: 0 });
            // Truncate logs and stock requests
            await tx.delete(inventoryLogs);
            await tx.delete(stockRequests);
            // stock_request_items is deleted via CASCADE on stock_requests
        });

        return NextResponse.json({ message: 'Inventory levels and history reset successfully' });
    } catch (error) {
        console.error('Reset failed:', error);
        return NextResponse.json({ error: 'Failed to reset inventory' }, { status: 500 });
    }
}
