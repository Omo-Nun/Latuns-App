import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { payments, quotations, activityLogs, clients } from '@/lib/schema';
import { eq, and, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: idStr } = await params;
        const id = Number(idStr);
        const paymentsList = await db.select().from(payments).where(eq(payments.quotationId, id)).orderBy(desc(payments.date));
        return NextResponse.json(paymentsList);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: idStr } = await params;
        const quotation_id = Number(idStr);
        const data = await request.json();
        const { amount, date, note } = data;

        if (!amount || !date) {
            return NextResponse.json({ error: 'Amount and date are required' }, { status: 400 });
        }

        let newPaymentId = 0;

        await db.transaction(async (tx) => {
            const insertResult = await tx.insert(payments).values({
                quotationId: quotation_id,
                amount: Number(amount),
                date: new Date(date),
                note: note || ''
            }).returning({ id: payments.id });
            
            newPaymentId = insertResult[0].id;

            // Log Activity & touch client updated_at
            const quoteRes = await tx.select({ clientId: quotations.clientId, quoteNumber: quotations.quoteNumber }).from(quotations).where(eq(quotations.id, quotation_id)).limit(1);
            const quote = quoteRes[0];
            
            if (quote && quote.clientId) {
                await tx.insert(activityLogs).values({
                    clientId: quote.clientId,
                    actionType: 'payment',
                    description: `Recorded Payment of ₦${parseFloat(amount).toLocaleString()} for ${quote.quoteNumber || 'Quote'}`,
                    refId: quotation_id
                });
                await tx.update(clients).set({ updatedAt: new Date() }).where(eq(clients.id, quote.clientId));
            }
        });

        return NextResponse.json({ id: newPaymentId, ...data }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to add payment' }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: idStr } = await params;
        const quotation_id = Number(idStr);
        const data = await request.json();
        const { paymentId, amount, date, note } = data;

        if (!paymentId || !amount || !date) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        await db.update(payments).set({
            amount: Number(amount),
            date: new Date(date),
            note: note || null
        }).where(and(eq(payments.id, Number(paymentId)), eq(payments.quotationId, quotation_id)));

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Update payment error:', error);
        return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
    }
}
