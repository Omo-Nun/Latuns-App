import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { checkPermission } from '@/lib/auth';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const canView = await checkPermission('Finances', 'can_view');
        if (!canView) {
            return NextResponse.json({ error: 'Unauthorized access to Finances' }, { status: 403 });
        }

        const rawPaymentsRes = await db.execute(sql.raw(`
            SELECT 
                p.id, p.quotation_id, p.amount, p.date, p.note, p.created_at,
                q.quote_number, q.client_name, q.project_type, q.transportation, q.sundries,
                (SELECT SUM(total) FROM quotation_items WHERE quotation_id = q.id) as subtotal,
                (SELECT SUM(amount) FROM payments WHERE quotation_id = q.id) as total_paid
            FROM payments p
            LEFT JOIN quotations q ON p.quotation_id = q.id
            ORDER BY p.date DESC, p.created_at DESC
        `));
        const rawPayments = rawPaymentsRes.rows;

        return NextResponse.json(rawPayments);
    } catch (error) {
        console.error('Failed to fetch payments error:', error);
        return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
    }
}
