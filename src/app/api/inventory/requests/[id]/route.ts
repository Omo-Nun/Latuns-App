import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { stockRequests, stockRequestItems, inventoryItems, inventoryLogs, quotations, activityLogs, clients } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: idStr } = await params;
        const id = Number(idStr);
        const body = await request.json();
        const { items } = body; // Array of { id: stock_request_item_id, approved_qty: number, inventory_item_id: number }

        if (!items || !Array.isArray(items)) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        await db.transaction(async (tx) => {
            // Update the header
            await tx.update(stockRequests).set({ status: 'approved' }).where(eq(stockRequests.id, id));

            // Get quotation ID for logging
            const reqDataRes = await tx.select({ quotationId: stockRequests.quotationId }).from(stockRequests).where(eq(stockRequests.id, id)).limit(1);
            const reqData = reqDataRes[0];

            for (const item of items) {
                if (item.approved_qty > 0) {
                    // Update the request item record for historical accuracy
                    await tx.update(stockRequestItems).set({ approvedQty: item.approved_qty }).where(eq(stockRequestItems.id, item.id));

                    // Deduct from actual storage limits
                    await tx.execute(sql`UPDATE inventory_items SET stock_qty = stock_qty - ${item.approved_qty} WHERE id = ${item.inventory_item_id}`);

                    // Add global history log
                    await tx.insert(inventoryLogs).values({
                        itemId: item.inventory_item_id,
                        type: 'out',
                        qty: item.approved_qty,
                        note: `Approved Issue from Quote #${reqData?.quotationId || 'Unknown'}`
                    });
                }
            }

            // Log Activity & touch client updated_at
            if (reqData && reqData.quotationId) {
                const quoteRes = await tx.select({ clientId: quotations.clientId, quoteNumber: quotations.quoteNumber }).from(quotations).where(eq(quotations.id, reqData.quotationId)).limit(1);
                const quote = quoteRes[0];

                if (quote && quote.clientId) {
                    await tx.insert(activityLogs).values({
                        clientId: quote.clientId,
                        actionType: 'inventory',
                        description: `Approved stock release request for ${quote.quoteNumber || 'Quote'}`,
                        refId: reqData.quotationId
                    });
                    await tx.update(clients).set({ updatedAt: new Date() }).where(eq(clients.id, quote.clientId));
                }

                // Audit Log
                const session = await getSession();
                if (session) {
                    await logAudit(session.user.id, session.user.username, 'Approve', 'Inventory', `Approved stock request for ${quote?.quoteNumber || 'Quote'}`, 'stock_request', id);
                }
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to approve stock request:', error);
        return NextResponse.json({ error: 'Failed to approve request' }, { status: 500 });
    }
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: idStr } = await params;
        const id = Number(idStr);
        
        await db.transaction(async (tx) => {
            await tx.update(stockRequests).set({ status: 'rejected' }).where(eq(stockRequests.id, id));

            // Log Activity & touch client updated_at
            const reqDataRes = await tx.select({ quotationId: stockRequests.quotationId }).from(stockRequests).where(eq(stockRequests.id, id)).limit(1);
            const reqData = reqDataRes[0];
            
            if (reqData && reqData.quotationId) {
                const quoteRes = await tx.select({ clientId: quotations.clientId, quoteNumber: quotations.quoteNumber }).from(quotations).where(eq(quotations.id, reqData.quotationId)).limit(1);
                const quote = quoteRes[0];
                
                if (quote && quote.clientId) {
                    await tx.insert(activityLogs).values({
                        clientId: quote.clientId,
                        actionType: 'inventory',
                        description: `Rejected stock release request for ${quote.quoteNumber || 'Quote'}`,
                        refId: reqData.quotationId
                    });
                    await tx.update(clients).set({ updatedAt: new Date() }).where(eq(clients.id, quote.clientId));
                }

                // Audit Log
                const session = await getSession();
                if (session) {
                    await logAudit(session.user.id, session.user.username, 'Reject', 'Inventory', `Rejected stock request for ${quote?.quoteNumber || 'Quote'}`, 'stock_request', id);
                }
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to reject stock request:', error);
        return NextResponse.json({ error: 'Failed to reject request' }, { status: 500 });
    }
}
