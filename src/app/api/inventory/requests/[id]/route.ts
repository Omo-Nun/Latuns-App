import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { items } = body; // Array of { id: stock_request_item_id, approved_qty: number, inventory_item_id: number }

        if (!items || !Array.isArray(items)) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        db.exec('BEGIN TRANSACTION');
        try {
            // Update the header
            const headerStmt = db.prepare("UPDATE stock_requests SET status = 'approved' WHERE id = ?");
            headerStmt.run(id);

            // Get quotation ID for logging
            const reqData = db.prepare("SELECT quotation_id FROM stock_requests WHERE id = ?").get(id) as any;

            const updateReqItemStmt = db.prepare("UPDATE stock_request_items SET approved_qty = ? WHERE id = ?");
            const updateStockStmt = db.prepare('UPDATE inventory_items SET stock_qty = stock_qty - ? WHERE id = ?');
            const logStmt = db.prepare('INSERT INTO inventory_logs (item_id, type, qty, note) VALUES (?, ?, ?, ?)');

            for (const item of items) {
                if (item.approved_qty > 0) {
                    // Update the request item record for historical accuracy
                    updateReqItemStmt.run(item.approved_qty, item.id);

                    // Deduct from actual storage limits
                    updateStockStmt.run(item.approved_qty, item.inventory_item_id);

                    // Add global history log
                    logStmt.run(item.inventory_item_id, 'out', item.approved_qty, `Approved Issue from Quote #${reqData?.quotation_id || 'Unknown'}`);
                }
            }

            // Log Activity & touch client updated_at
            const quote = db.prepare('SELECT client_id, quote_number FROM quotations WHERE id = ?').get(reqData?.quotation_id) as any;
            if (quote && quote.client_id) {
                db.prepare(`
                    INSERT INTO activity_logs (client_id, action_type, description, ref_id)
                    VALUES (?, ?, ?, ?)
                `).run(quote.client_id, 'inventory', `Approved stock release request for ${quote.quote_number || 'Quote'}`, reqData.quotation_id);
                db.prepare('UPDATE clients SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(quote.client_id);
            }

            // Audit Log
            const session = await getSession();
            if (session) {
                logAudit(session.user.id, session.user.username, 'Approve', 'Inventory', `Approved stock request for ${quote?.quote_number || 'Quote'}`, 'stock_request', Number(id));
            }

            db.exec('COMMIT');
            return NextResponse.json({ success: true });
        } catch (e) {
            db.exec('ROLLBACK');
            throw e;
        }
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
        const { id } = await params;
        db.prepare("UPDATE stock_requests SET status = 'rejected' WHERE id = ?").run(id);

        // Log Activity & touch client updated_at
        const reqData = db.prepare("SELECT quotation_id FROM stock_requests WHERE id = ?").get(id) as any;
        const quote = db.prepare('SELECT client_id, quote_number FROM quotations WHERE id = ?').get(reqData?.quotation_id) as any;
        if (quote && quote.client_id) {
            db.prepare(`
                INSERT INTO activity_logs (client_id, action_type, description, ref_id)
                VALUES (?, ?, ?, ?)
            `).run(quote.client_id, 'inventory', `Rejected stock release request for ${quote.quote_number || 'Quote'}`, reqData.quotation_id);
            db.prepare('UPDATE clients SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(quote.client_id);
        }

        // Audit Log
        const session = await getSession();
        if (session) {
            logAudit(session.user.id, session.user.username, 'Reject', 'Inventory', `Rejected stock request for ${quote?.quote_number || 'Quote'}`, 'stock_request', Number(id));
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to reject stock request:', error);
        return NextResponse.json({ error: 'Failed to reject request' }, { status: 500 });
    }
}
