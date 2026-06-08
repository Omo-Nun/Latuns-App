import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { inventoryItems } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
    try {
        const data = await request.json();
        const { order } = data; // Array of item IDs in the new order

        if (!Array.isArray(order)) {
            return NextResponse.json({ error: 'Order must be an array of IDs' }, { status: 400 });
        }

        // Execute updates in a transaction
        await db.transaction(async (tx) => {
            for (let i = 0; i < order.length; i++) {
                await tx.update(inventoryItems)
                    .set({ displayOrder: i })
                    .where(eq(inventoryItems.id, Number(order[i])));
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to reorder items', error);
        return NextResponse.json({ error: 'Failed to reorder items' }, { status: 500 });
    }
}
