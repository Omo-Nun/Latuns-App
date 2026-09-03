import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePermission, getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { payments, quotations, activityLogs, clients } from '@/lib/schema';
import { eq, and, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const error = await requirePermission('Finances', 'can_view');
    if (error) return error;

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
    const error = await requirePermission('Finances', 'can_edit');
    if (error) return error;

    try {
        const { id: idStr } = await params;
        const quotation_id = Number(idStr);
        const data = await request.json();
        const { amount, date, note } = data;

        if (!amount || !date) {
            return NextResponse.json({ error: 'Amount and date are required' }, { status: 400 });
        }

        const numericAmount = Number(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
        }

        const session = await getSession();
        let newPaymentId = 0;

        await db.transaction(async (tx) => {
            const insertResult = await tx.insert(payments).values({
                quotationId: quotation_id,
                amount: String(numericAmount),
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
                    description: `Recorded Payment of ₦${numericAmount.toLocaleString()} for ${quote.quoteNumber || 'Quote'}`,
                    refId: quotation_id
                });
                await tx.update(clients).set({ updatedAt: new Date() }).where(eq(clients.id, quote.clientId));
            }

            // Audit log
            if (session) {
                await logAudit(
                    session.user.id, session.user.username,
                    'Create', 'Finances',
                    `Recorded payment of ₦${numericAmount.toLocaleString()} for quotation #${quotation_id}`,
                    'payment', newPaymentId,
                    { entityType: 'payment', entityId: newPaymentId, afterData: { amount: numericAmount, quotation_id, date, note } }
                );
            }
        });

        return NextResponse.json({ id: newPaymentId, ...data }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to add payment' }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const error = await requirePermission('Finances', 'can_edit');
    if (error) return error;

    try {
        const { id: idStr } = await params;
        const quotation_id = Number(idStr);
        const data = await request.json();
        const { paymentId, amount, date, note } = data;

        if (!paymentId || !amount || !date) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const session = await getSession();

        // Capture before-state for audit
        const beforeRes = await db.select().from(payments).where(and(eq(payments.id, Number(paymentId)), eq(payments.quotationId, quotation_id))).limit(1);
        const beforePayment = beforeRes[0];

        await db.update(payments).set({
            amount: String(Number(amount)),
            date: new Date(date),
            note: note || null
        }).where(and(eq(payments.id, Number(paymentId)), eq(payments.quotationId, quotation_id)));

        // Audit log with before/after
        if (session && beforePayment) {
            await logAudit(
                session.user.id, session.user.username,
                'Update', 'Finances',
                `Updated payment #${paymentId} for quotation #${quotation_id}`,
                'payment', Number(paymentId),
                {
                    entityType: 'payment', entityId: Number(paymentId),
                    beforeData: { amount: beforePayment.amount, date: beforePayment.date, note: beforePayment.note },
                    afterData: { amount, date, note }
                }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Update payment error:', error);
        return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
    }
}
