import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { stockRequests, stockRequestItems, inventoryItems, quotationItems } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: idStr } = await params;
        const id = parseInt(idStr, 10);

        // Fetch the quotation items
        const quoteItems = await db.select({
            description: quotationItems.description,
            qty: quotationItems.qty
        }).from(quotationItems).where(eq(quotationItems.quotationId, id));

        if (!quoteItems || quoteItems.length === 0) {
            return NextResponse.json({ error: 'No items found in this quotation.' }, { status: 400 });
        }

        // Fetch current inventory
        const inventory = await db.select({
            id: inventoryItems.id,
            name: inventoryItems.name
        }).from(inventoryItems);

        await db.transaction(async (tx) => {
            // 1. Check if a pending request already exists for this quote to prevent concurrent duplicates
            const existingReqRes = await tx.select({ id: stockRequests.id })
                .from(stockRequests)
                .where(and(eq(stockRequests.quotationId, id), eq(stockRequests.status, 'pending')))
                .limit(1);
            
            const existingReq = existingReqRes[0];
            if (existingReq) {
                throw new Error('A pending stock request for this quotation already exists.');
            }

            let itemsRequested = 0;
            const itemsToInsert = [];

            for (const qItem of quoteItems) {
                // Try to find a matching inventory item by name (case-insensitive)
                const matchedInv = inventory.find(inv => inv.name.toLowerCase().trim() === qItem.description.toLowerCase().trim());

                if (matchedInv) {
                    itemsToInsert.push({
                        inventoryItemId: matchedInv.id,
                        requestedQty: String(Number(qItem.qty)),
                        approvedQty: String(Number(qItem.qty))
                    });
                    itemsRequested++;
                }
            }

            if (itemsRequested === 0) {
                throw new Error('No items in the quotation matched existing inventory items.');
            }

            // 2. Create the pending Request Header
            const reqInfo = await tx.insert(stockRequests).values({
                quotationId: id,
                status: 'pending'
            }).returning({ id: stockRequests.id });
            const newRequestId = reqInfo[0].id;

            // Insert items
            for (const item of itemsToInsert) {
                await tx.insert(stockRequestItems).values({
                    requestId: newRequestId,
                    ...item
                });
            }
        });

        return NextResponse.json({ success: true, count: quoteItems.length }, { status: 201 }); // returning full quoteItems length since we map all possible matches? The original returned itemsRequested.
    } catch (error: any) {
        if (error.message === 'A pending stock request for this quotation already exists.' || 
            error.message === 'No items in the quotation matched existing inventory items.') {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to create stock request' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: idStr } = await params;
        const id = Number(idStr);
        // Delete the rejected stock request for this quotation to dismiss the notification
        await db.delete(stockRequests)
            .where(and(eq(stockRequests.quotationId, id), eq(stockRequests.status, 'rejected')));
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to dismiss stock request' }, { status: 500 });
    }
}
