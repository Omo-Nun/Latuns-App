import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { stockRequests, stockRequestItems, inventoryLogs, quotations, activityLogs, clients } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: idStr } = await params;
        const id = Number(idStr);

        const requestDataRes = await db.select({ status: stockRequests.status, quotationId: stockRequests.quotationId }).from(stockRequests).where(eq(stockRequests.id, id)).limit(1);
        const requestData = requestDataRes[0];
        if (!requestData) {
            return NextResponse.json({ error: 'Stock request not found' }, { status: 404 });
        }

        if (requestData.status !== 'revert_pending') {
            return NextResponse.json({ error: 'Request is not in revert pending state' }, { status: 400 });
        }

        const items = await db.select().from(stockRequestItems).where(eq(stockRequestItems.requestId, id));

        await db.transaction(async (tx) => {
            for (const item of items) {
                const approvedQty = item.approvedQty || 0;
                if (approvedQty > 0) {
                    // Return stock to inventory
                    await tx.execute(sql`UPDATE inventory_items SET stock_qty = stock_qty + ${approvedQty} WHERE id = ${item.inventoryItemId}`);

                    // Log the return
                    await tx.insert(inventoryLogs).values({
                        itemId: item.inventoryItemId,
                        type: 'in',
                        qty: approvedQty,
                        note: `Returned from Reversal of Quote #${requestData.quotationId}`
                    });

                    // Reset approved qty
                    await tx.update(stockRequestItems).set({ approvedQty: 0 }).where(eq(stockRequestItems.id, item.id));
                }
            }

            // Set status back to pending
            await tx.update(stockRequests).set({ status: 'pending' }).where(eq(stockRequests.id, id));

            // Log Activity
            if (requestData.quotationId) {
                const quoteRes = await tx.select({ clientId: quotations.clientId, quoteNumber: quotations.quoteNumber }).from(quotations).where(eq(quotations.id, requestData.quotationId)).limit(1);
                const quote = quoteRes[0];
                if (quote && quote.clientId) {
                    await tx.insert(activityLogs).values({
                        clientId: quote.clientId,
                        actionType: 'inventory',
                        description: `Confirmed reversal of stock release for ${quote.quoteNumber || 'Quote'}. Stock returned to warehouse.`,
                        refId: requestData.quotationId
                    });
                    await tx.update(clients).set({ updatedAt: new Date() }).where(eq(clients.id, quote.clientId));
                }
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to confirm reversal:', error);
        return NextResponse.json({ error: 'Failed to confirm reversal' }, { status: 500 });
    }
}
