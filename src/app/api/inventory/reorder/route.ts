import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
    try {
        const data = await request.json();
        const { order } = data; // Array of item IDs in the new order

        if (!Array.isArray(order)) {
            return NextResponse.json({ error: 'Order must be an array of IDs' }, { status: 400 });
        }

        const updateStmt = db.prepare('UPDATE inventory_items SET display_order = ? WHERE id = ?');

        // Execute updates in a transaction
        db.exec('BEGIN TRANSACTION');
        try {
            for (let i = 0; i < order.length; i++) {
                updateStmt.run(i, order[i]);
            }
            db.exec('COMMIT');
        } catch (err) {
            db.exec('ROLLBACK');
            throw err;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to reorder items', error);
        return NextResponse.json({ error: 'Failed to reorder items' }, { status: 500 });
    }
}
