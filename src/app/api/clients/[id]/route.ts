import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as any;
        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        const quotations = db.prepare(`
            SELECT 
                q.*,
                COALESCE(SUM(qi.total), 0) as subtotal,
                COALESCE((SELECT SUM(amount) FROM payments WHERE quotation_id = q.id), 0) as total_paid,
                (SELECT status FROM stock_requests WHERE quotation_id = q.id ORDER BY created_at DESC LIMIT 1) as stock_request_status,
                (SELECT id FROM stock_requests WHERE quotation_id = q.id ORDER BY created_at DESC LIMIT 1) as stock_request_id
            FROM quotations q
            LEFT JOIN quotation_items qi ON q.id = qi.quotation_id
            WHERE q.client_id = ?
            GROUP BY q.id
            ORDER BY q.created_at DESC
        `).all(id);

        const itemsStmt = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ?');
        const quotationsWithItems = quotations.map((q: any) => ({
            ...q,
            items: itemsStmt.all(q.id)
        }));

        const estimators = db.prepare(`
            SELECT DISTINCT a.id, a.name, a.phone
            FROM quotations q
            JOIN agents a ON q.agent_id = a.id
            WHERE q.client_id = ?
        `).all(id);

        const activity_logs = db.prepare(`
            SELECT * FROM activity_logs
            WHERE client_id = ?
            ORDER BY created_at DESC
        `).all(id);

        const payments = db.prepare(`
            SELECT p.*, q.quote_number
            FROM payments p
            JOIN quotations q ON p.quotation_id = q.id
            WHERE q.client_id = ?
            ORDER BY p.date DESC
        `).all(id);

        return NextResponse.json({
            ...client,
            quotations: quotationsWithItems,
            estimators,
            activity_logs,
            payments
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch client details' }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();

        const updates = [];
        const values = [];

        if (body.name !== undefined) { updates.push('name = ?'); values.push(body.name); }
        if (body.phone !== undefined) { updates.push('phone = ?'); values.push(body.phone); }
        if (body.address !== undefined) { updates.push('address = ?'); values.push(body.address); }
        if (body.state !== undefined) { updates.push('state = ?'); values.push(body.state); }
        if (body.city !== undefined) { updates.push('city = ?'); values.push(body.city); }

        if (updates.length > 0) {
            updates.push('updated_at = CURRENT_TIMESTAMP');
            const stmt = db.prepare(`UPDATE clients SET ${updates.join(', ')} WHERE id = ?`);
            stmt.run(...values, id);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to update client' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        db.exec('BEGIN TRANSACTION');
        try {
            // Nullify client references before deleting
            db.prepare('UPDATE quotations SET client_id = NULL WHERE client_id = ?').run(id);
            db.prepare('DELETE FROM clients WHERE id = ?').run(id);
            db.exec('COMMIT');
        } catch (e) {
            db.exec('ROLLBACK');
            throw e;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 });
    }
}
