import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { clients, quotations } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: idStr } = await params;
        const id = Number(idStr);

        const clientRes = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
        const client = clientRes[0];
        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        const quotationsRes = await db.execute(sql`
            SELECT 
                q.*,
                COALESCE(SUM(qi.total), 0) as subtotal,
                COALESCE((SELECT SUM(amount) FROM payments WHERE quotation_id = q.id), 0) as total_paid,
                (SELECT status FROM stock_requests WHERE quotation_id = q.id ORDER BY created_at DESC LIMIT 1) as stock_request_status,
                (SELECT id FROM stock_requests WHERE quotation_id = q.id ORDER BY created_at DESC LIMIT 1) as stock_request_id
            FROM quotations q
            LEFT JOIN quotation_items qi ON q.id = qi.quotation_id
            WHERE q.client_id = ${id}
            GROUP BY q.id
            ORDER BY q.created_at DESC
        `);
        const quotationsList = quotationsRes.rows;

        const itemsRes = await db.execute(sql`SELECT * FROM quotation_items WHERE quotation_id IN (SELECT id FROM quotations WHERE client_id = ${id})`);
        const allItems = itemsRes.rows;

        const quotationsWithItems = quotationsList.map((q: any) => ({
            ...q,
            items: allItems.filter((i: any) => i.quotation_id === q.id)
        }));

        const estimatorsRes = await db.execute(sql`
            SELECT DISTINCT a.id, a.name, a.phone
            FROM quotations q
            JOIN agents a ON q.agent_id = a.id
            WHERE q.client_id = ${id}
        `);
        const estimators = estimatorsRes.rows;

        const activityLogsRes = await db.execute(sql`
            SELECT * FROM activity_logs
            WHERE client_id = ${id}
            ORDER BY created_at DESC
        `);
        const activity_logs = activityLogsRes.rows;

        const paymentsRes = await db.execute(sql`
            SELECT p.*, q.quote_number
            FROM payments p
            JOIN quotations q ON p.quotation_id = q.id
            WHERE q.client_id = ${id}
            ORDER BY p.date DESC
        `);
        const paymentsList = paymentsRes.rows;

        return NextResponse.json({
            ...client,
            quotations: quotationsWithItems,
            estimators,
            activity_logs,
            payments: paymentsList
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch client details' }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: idStr } = await params;
        const id = Number(idStr);
        const body = await request.json();

        const updates: any = {};

        if (body.name !== undefined) updates.name = body.name;
        if (body.phone !== undefined) updates.phone = body.phone;
        if (body.address !== undefined) updates.address = body.address;
        if (body.state !== undefined) updates.state = body.state;
        if (body.city !== undefined) updates.city = body.city;

        if (Object.keys(updates).length > 0) {
            updates.updatedAt = new Date();
            await db.update(clients).set(updates).where(eq(clients.id, id));
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to update client' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: idStr } = await params;
        const id = Number(idStr);

        await db.transaction(async (tx) => {
            // Nullify client references before deleting
            await tx.update(quotations).set({ clientId: null }).where(eq(quotations.clientId, id));
            await tx.delete(clients).where(eq(clients.id, id));
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 });
    }
}
