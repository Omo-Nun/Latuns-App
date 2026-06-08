import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { inventoryItems, inventoryLogs } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: idStr } = await params;
        const id = parseInt(idStr, 10);
        const { type, qty, note, reference } = await request.json();

        if (!type || qty === undefined || isNaN(qty) || qty <= 0) {
            return NextResponse.json({ error: 'Valid type (in/out) and positive qty are required' }, { status: 400 });
        }

        if (type === 'out') {
            const currentItemRes = await db.select({ stockQty: inventoryItems.stockQty }).from(inventoryItems).where(eq(inventoryItems.id, id)).limit(1);
            const currentItem = currentItemRes[0];
            const currentStock = currentItem?.stockQty || 0;
            if (!currentItem || currentStock < qty) {
                return NextResponse.json({ error: `Insufficient stock. Current balance: ${currentStock}` }, { status: 400 });
            }
        }

        await db.transaction(async (tx) => {
            // Log the movement
            const finalNote = [reference ? `REF: ${reference}` : '', note].filter(Boolean).join(' | ');
            await tx.insert(inventoryLogs).values({
                itemId: id,
                type,
                qty: Number(qty),
                note: finalNote
            });

            // Update the master stock
            const modifier = type === 'in' ? '+' : '-';
            await tx.execute(sql`
                UPDATE inventory_items 
                SET stock_qty = stock_qty ${sql.raw(modifier)} ${qty} 
                WHERE id = ${id}
            `);
        });

        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error) {
        console.error('Failed to update stock', error);
        return NextResponse.json({ error: 'Failed to update stock' }, { status: 500 });
    }
}
