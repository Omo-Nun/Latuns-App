import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { payments, activityLogs, clients } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { clientId, date, allocations } = body;

        if (!allocations || !Array.isArray(allocations)) {
            return NextResponse.json({ error: 'Invalid allocations' }, { status: 400 });
        }

        let totalSum = 0;

        await db.transaction(async (tx) => {
            const refIds: number[] = [];

            for (const alloc of allocations) {
                const amount = parseFloat(alloc.amount);
                if (isNaN(amount) || amount <= 0) continue;
                
                await tx.insert(payments).values({
                    quotationId: alloc.quotationId,
                    amount: amount,
                    date: date ? new Date(date) : new Date(),
                    note: alloc.note || 'Bulk Payment Allocation'
                });
                totalSum += amount;
                refIds.push(alloc.quotationId);
            }

            // Log Activity for Client if possible
            if (clientId) {
                await tx.insert(activityLogs).values({
                    clientId: clientId,
                    actionType: 'payment_received',
                    description: `Recorded Bulk Payment of ₦${totalSum.toLocaleString()} allocated across ${refIds.length} projects.`
                });
                await tx.update(clients).set({ updatedAt: new Date() }).where(eq(clients.id, clientId));
            }
        });

        return NextResponse.json({ success: true, total: totalSum });
    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message || 'Failed to process bulk payment' }, { status: 500 });
    }
}
