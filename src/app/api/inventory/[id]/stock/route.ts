import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: idStr } = await params;
        const id = parseInt(idStr, 10);
        const { type, qty, note, reference } = await request.json();

        if (!type || qty === undefined || isNaN(qty) || qty <= 0) {
            return NextResponse.json({ error: 'Valid type (in/out) and positive qty are required' }, { status: 400 });
        }

        if (type === 'out') {
            const currentItem = db.prepare('SELECT stock_qty FROM inventory_items WHERE id = ?').get(id) as { stock_qty: number } | undefined;
            if (!currentItem || currentItem.stock_qty < qty) {
                return NextResponse.json({ error: `Insufficient stock. Current balance: ${currentItem?.stock_qty || 0}` }, { status: 400 });
            }
        }

        db.exec('BEGIN TRANSACTION');
        try {
            // Log the movement
            const logStmt = db.prepare(`
                INSERT INTO inventory_logs (item_id, type, qty, note)
                VALUES (?, ?, ?, ?)
            `);
            const finalNote = [reference ? `REF: ${reference}` : '', note].filter(Boolean).join(' | ');
            logStmt.run(id, type, qty, finalNote);

            // Update the master stock
            const modifier = type === 'in' ? '+' : '-';
            const updStmt = db.prepare(`
                UPDATE inventory_items 
                SET stock_qty = stock_qty ${modifier} ? 
                WHERE id = ?
            `);
            updStmt.run(qty, id);

            db.exec('COMMIT');
        } catch (e) {
            db.exec('ROLLBACK');
            throw e;
        }

        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update stock' }, { status: 500 });
    }
}
