import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const requestData = db.prepare("SELECT status, quotation_id FROM stock_requests WHERE id = ?").get(id) as any;
        if (!requestData) {
            return NextResponse.json({ error: 'Stock request not found' }, { status: 404 });
        }

        if (requestData.status !== 'approved') {
            return NextResponse.json({ error: 'Only approved requests can be reverted' }, { status: 400 });
        }

        db.exec('BEGIN TRANSACTION');
        try {
            db.prepare("UPDATE stock_requests SET status = 'revert_pending' WHERE id = ?").run(id);

            // Log Activity
            const quote = db.prepare('SELECT client_id, quote_number FROM quotations WHERE id = ?').get(requestData.quotation_id) as any;
            if (quote && quote.client_id) {
                db.prepare(`
                    INSERT INTO activity_logs (client_id, action_type, description, ref_id)
                    VALUES (?, ?, ?, ?)
                `).run(
                    quote.client_id, 
                    'inventory', 
                    `Reversal requested for stock release of ${quote.quote_number || 'Quote'}`, 
                    requestData.quotation_id
                );
            }

            db.exec('COMMIT');
            return NextResponse.json({ success: true });
        } catch (e) {
            db.exec('ROLLBACK');
            throw e;
        }
    } catch (error) {
        console.error('Failed to request reversal:', error);
        return NextResponse.json({ error: 'Failed to request reversal' }, { status: 500 });
    }
}
