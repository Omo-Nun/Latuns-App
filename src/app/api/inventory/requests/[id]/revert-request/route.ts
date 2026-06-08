import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { stockRequests, quotations, activityLogs } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function POST(
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

        if (requestData.status !== 'approved') {
            return NextResponse.json({ error: 'Only approved requests can be reverted' }, { status: 400 });
        }

        await db.transaction(async (tx) => {
            await tx.update(stockRequests).set({ status: 'revert_pending' }).where(eq(stockRequests.id, id));

            // Log Activity
            if (requestData.quotationId) {
                const quoteRes = await tx.select({ clientId: quotations.clientId, quoteNumber: quotations.quoteNumber }).from(quotations).where(eq(quotations.id, requestData.quotationId)).limit(1);
                const quote = quoteRes[0];
                if (quote && quote.clientId) {
                    await tx.insert(activityLogs).values({
                        clientId: quote.clientId,
                        actionType: 'inventory',
                        description: `Reversal requested for stock release of ${quote.quoteNumber || 'Quote'}`,
                        refId: requestData.quotationId
                    });
                }
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to request reversal:', error);
        return NextResponse.json({ error: 'Failed to request reversal' }, { status: 500 });
    }
}
