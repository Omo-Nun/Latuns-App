import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePermission, getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { inventoryItems, inventoryLogs, inventoryMovements, stockRequests } from '@/lib/schema';
import { asc, sql, gt } from 'drizzle-orm';
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
            defaultPrice: String(Number(default_price) || 0),
            tags: tags || null,
            minStock: min_stock === undefined ? '10' : String(Number(min_stock)),
            lowStock: low_stock === undefined ? '20' : String(Number(low_stock))
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

        const session = await getSession();

        await db.transaction(async (tx) => {
            // Fetch all items with non-zero stock to create adjustment records
            const itemsWithStock = await tx.select({
                id: inventoryItems.id,
                name: inventoryItems.name,
                stockQty: inventoryItems.stockQty,
            }).from(inventoryItems).where(gt(inventoryItems.stockQty, '0'));

            // Create ADJUSTMENT movements for audit trail (records the zeroing out)
            for (const item of itemsWithStock) {
                const currentQty = Number(item.stockQty) || 0;
                if (currentQty > 0) {
                    await tx.insert(inventoryMovements).values({
                        itemId: item.id,
                        movementType: 'ADJUSTMENT',
                        quantity: String(-currentQty),
                        note: 'Inventory reset to zero',
                        createdBy: session?.user?.id || null,
                    });

                    await tx.insert(inventoryLogs).values({
                        itemId: item.id,
                        type: 'adjustment',
                        qty: String(currentQty),
                        note: `RESET: Stock adjusted from ${currentQty} to 0`,
                    });
                }
            }

            // Now zero out all stock
            await tx.update(inventoryItems).set({ stockQty: '0' });

            // Audit log the reset action
            if (session) {
                await logAudit(
                    session.user.id, session.user.username,
                    'Reset', 'Inventory',
                    `Reset all inventory levels to zero. ${itemsWithStock.length} items affected.`,
                    undefined, undefined,
                    { entityType: 'inventory', afterData: { itemsReset: itemsWithStock.length } }
                );
            }
        });

        return NextResponse.json({ message: 'Inventory levels reset successfully. Historical records preserved.' });
    } catch (error) {
        console.error('Reset failed:', error);
        return NextResponse.json({ error: 'Failed to reset inventory' }, { status: 500 });
    }
}
