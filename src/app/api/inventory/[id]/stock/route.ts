import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePermission, getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { inventoryItems, inventoryLogs, inventoryMovements } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const error = await requirePermission('Inventory', 'can_edit');
    if (error) return error;

    try {
        const { id: idStr } = await params;
        const id = parseInt(idStr, 10);
        const { type, qty, note, reference } = await request.json();

        if (!type || qty === undefined || isNaN(qty) || qty <= 0) {
            return NextResponse.json({ error: 'Valid type (in/out) and positive qty are required' }, { status: 400 });
        }

        const session = await getSession();

        await db.transaction(async (tx) => {
            if (type === 'out') {
                // Atomic check-and-deduct: prevents race conditions where two concurrent
                // withdrawals could both pass a stock check and drive balance negative.
                const result = await tx.execute(sql`
                    UPDATE inventory_items 
                    SET stock_qty = stock_qty - ${qty} 
                    WHERE id = ${id} AND stock_qty >= ${qty}
                    RETURNING stock_qty
                `);

                if (result.rows.length === 0) {
                    // Either item doesn't exist or insufficient stock
                    const currentItemRes = await tx.execute(sql`
                        SELECT stock_qty FROM inventory_items WHERE id = ${id}
                    `);
                    const currentStock = currentItemRes.rows[0]?.stock_qty ?? 'N/A';
                    throw new Error(`Insufficient stock. Current balance: ${currentStock}`);
                }
            } else {
                // For 'in' type, simply add to stock
                await tx.execute(sql`
                    UPDATE inventory_items 
                    SET stock_qty = stock_qty + ${qty} 
                    WHERE id = ${id}
                `);
            }

            // Log the movement in legacy inventory_logs
            const finalNote = [reference ? `REF: ${reference}` : '', note].filter(Boolean).join(' | ');
            await tx.insert(inventoryLogs).values({
                itemId: id,
                type,
                qty: String(qty),
                note: finalNote
            });

            // Log in the new inventory_movements ledger
            await tx.insert(inventoryMovements).values({
                itemId: id,
                movementType: type === 'in' ? 'IN' : 'OUT',
                quantity: String(qty),
                referenceType: reference ? 'manual' : 'manual',
                note: finalNote,
                createdBy: session?.user?.id || null,
            });

            // Audit log
            if (session) {
                await logAudit(
                    session.user.id, session.user.username,
                    type === 'in' ? 'Stock In' : 'Stock Out', 'Inventory',
                    `${type === 'in' ? 'Added' : 'Withdrew'} ${qty} units for item #${id}`,
                    'inventory_item', id,
                    { entityType: 'inventory_item', entityId: id, afterData: { type, qty, note: finalNote } }
                );
            }
        });

        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error: any) {
        console.error('Failed to update stock', error);
        const message = error.message?.startsWith('Insufficient stock') ? error.message : 'Failed to update stock';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
