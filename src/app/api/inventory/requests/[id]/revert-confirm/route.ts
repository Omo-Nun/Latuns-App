import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const requestData = db.prepare("SELECT status, quotation_id FROM stock_requests WHERE id = ?").get(id) as any;
        if (!requestData) {
            return NextResponse.json({ error: 'Stock request not found' }, { status: 404 });
        }

        if (requestData.status !== 'revert_pending') {
            return NextResponse.json({ error: 'Request is not in revert pending state' }, { status: 400 });
        }

        const items = db.prepare("SELECT * FROM stock_request_items WHERE request_id = ?").all(id) as any[];

        db.exec('BEGIN TRANSACTION');
        try {
            const updateStockStmt = db.prepare('UPDATE inventory_items SET stock_qty = stock_qty + ? WHERE id = ?');
            const logStmt = db.prepare('INSERT INTO inventory_logs (item_id, type, qty, note) VALUES (?, ?, ?, ?)');
            const updateReqItemStmt = db.prepare('UPDATE stock_request_items SET approved_qty = 0 WHERE id = ?');

            for (const item of items) {
                if (item.approved_qty > 0) {
                    // Return stock to inventory
                    updateStockStmt.run(item.approved_qty, item.inventory_item_id);

                    // Log the return
                    logStmt.run(
                        item.inventory_item_id, 
                        'in', 
                        item.approved_qty, 
                        `Returned from Reversal of Quote #${requestData.quotation_id}`
                    );

                    // Reset approved qty
                    updateReqItemStmt.run(item.id);
                }
            }

            // Set status back to pending
            db.prepare("UPDATE stock_requests SET status = 'pending' WHERE id = ?").run(id);

            // Log Activity
            const quote = db.prepare('SELECT client_id, quote_number FROM quotations WHERE id = ?').get(requestData.quotation_id) as any;
            if (quote && quote.client_id) {
                db.prepare(`
                    INSERT INTO activity_logs (client_id, action_type, description, ref_id)
                    VALUES (?, ?, ?, ?)
                `).run(
                    quote.client_id, 
                    'inventory', 
                    `Confirmed reversal of stock release for ${quote.quote_number || 'Quote'}. Stock returned to warehouse.`, 
                    requestData.quotation_id
                );
                db.prepare('UPDATE clients SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(quote.client_id);
            }

            db.exec('COMMIT');
            return NextResponse.json({ success: true });
        } catch (e) {
            db.exec('ROLLBACK');
            throw e;
        }
    } catch (error) {
        console.error('Failed to confirm reversal:', error);
        return NextResponse.json({ error: 'Failed to confirm reversal' }, { status: 500 });
    }
}
