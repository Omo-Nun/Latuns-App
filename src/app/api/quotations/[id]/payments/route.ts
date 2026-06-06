import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const payments = db.prepare('SELECT * FROM payments WHERE quotation_id = ? ORDER BY date DESC').all(id);
        return NextResponse.json(payments);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: quotation_id } = await params;
        const data = await request.json();
        const { amount, date, note } = data;

        if (!amount || !date) {
            return NextResponse.json({ error: 'Amount and date are required' }, { status: 400 });
        }

        const stmt = db.prepare(`
      INSERT INTO payments(quotation_id, amount, date, note)
VALUES(?, ?, ?, ?)
    `);

        const info = stmt.run(quotation_id, amount, date, note || '');

        // Log Activity & touch client updated_at
        const quote = db.prepare('SELECT client_id, quote_number FROM quotations WHERE id = ?').get(quotation_id) as any;
        if (quote && quote.client_id) {
            db.prepare(`
                INSERT INTO activity_logs (client_id, action_type, description, ref_id)
                VALUES (?, ?, ?, ?)
            `).run(
                quote.client_id,
                'payment',
                `Recorded Payment of ₦${parseFloat(amount).toLocaleString()} for ${quote.quote_number || 'Quote'}`,
                quotation_id
            );
            db.prepare('UPDATE clients SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(quote.client_id);
        }

        return NextResponse.json({ id: info.lastInsertRowid, ...data }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to add payment' }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: quotation_id } = await params;
        const data = await request.json();
        const { paymentId, amount, date, note } = data;

        if (!paymentId || !amount || !date) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const stmt = db.prepare('UPDATE payments SET amount = ?, date = ?, note = ? WHERE id = ? AND quotation_id = ?');
        stmt.run(amount, date, note || null, paymentId, quotation_id);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Update payment error:', error);
        return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
    }
}
