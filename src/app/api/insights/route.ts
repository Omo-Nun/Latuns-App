import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { calcNetTotal } from '@/lib/financeUtils';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const allQuotesRes = await db.execute(sql.raw(`
            SELECT q.id, q.client_name, q.client_state, q.client_city, q.subsidiary_name, q.status, q.created_at, q.sundries, q.transportation,
            q.project_type, q.visit_status, q.project_status, q.doc_type, q.linked_quotations, q.discount_value, a.name as estimator_name,
            COALESCE(SUM(qi.total), 0) as subtotal,
            COALESCE((SELECT SUM(amount) FROM payments WHERE quotation_id = q.id), 0) as total_paid
            FROM quotations q
            LEFT JOIN quotation_items qi ON q.id = qi.quotation_id
            LEFT JOIN agents a ON q.agent_id = a.id
            GROUP BY q.id, a.name
        `));
        const allQuotes = allQuotesRes.rows;

        // Identify all children of project scopes/discount statements
        const childIdsSet = new Set<number>();
        allQuotes.forEach((q: any) => {
            if (q.linked_quotations) {
                try {
                    const ids: number[] = JSON.parse(q.linked_quotations);
                    ids.forEach(id => childIdsSet.add(id));
                } catch { }
            }
        });

        // Use Root Selection logic: A root is any Parent or Standalone Quotation
        const activeRoots = allQuotes.filter((q: any) => 
            !childIdsSet.has(Number(q.id)) && 
            q.project_status !== 'Pending' && 
            q.project_status != null
        );

        const allPaymentsRes = await db.execute(sql.raw('SELECT quotation_id, amount FROM payments'));
        const allPayments = allPaymentsRes.rows;

        const insightsData = activeRoots.map((q: any) => {
            // Aggregate payments for this root AND its children
            let linkedIds: number[] = [];
            if (q.linked_quotations) {
                try { linkedIds = JSON.parse(q.linked_quotations); } catch { }
            }
            const allDocIds = [q.id, ...linkedIds].map(Number);
            const totalPaid = allPayments
                .filter((p: any) => allDocIds.includes(Number(p.quotation_id)))
                .reduce((acc: number, p: any) => Math.round((acc + Number(p.amount) + Number.EPSILON) * 100) / 100, 0);

            return {
                id: q.id,
                client_name: q.client_name,
                client_state: q.client_state || 'Unspecified',
                client_city: q.client_city || 'Unspecified',
                subsidiary_name: q.subsidiary_name,
                status: q.status,
                project_type: q.project_type || 'Unspecified',
                visit_status: q.visit_status || 'Unspecified',
                project_status: q.project_status || 'Pending',
                estimator_name: q.estimator_name || 'Unassigned',
                created_at: q.created_at,
                grandTotal: calcNetTotal(q),
                total_paid: totalPaid
            };
        });

        const expensesDataRes = await db.execute(sql.raw('SELECT * FROM expenses'));
        const expensesData = expensesDataRes.rows;

        const clientCountRes = await db.execute(sql.raw('SELECT COUNT(*) as count FROM clients'));
        const clientCount = Number(clientCountRes.rows[0]?.count) || 0;

        // 1. Estimator Performance
        const estimatorPerformanceRes = await db.execute(sql.raw(`
            SELECT 
                a.name as estimator_name,
                COUNT(q.id) as job_count,
                SUM(qi_sum.total_val) as total_revenue
            FROM agents a
            LEFT JOIN quotations q ON a.id = q.agent_id
            LEFT JOIN (
                SELECT quotation_id, SUM(total) as total_val FROM quotation_items GROUP BY quotation_id
            ) qi_sum ON q.id = qi_sum.quotation_id
            WHERE q.project_status != 'Pending' OR q.project_status IS NULL
            GROUP BY a.id, a.name
            ORDER BY total_revenue DESC
        `));
        const estimatorPerformance = estimatorPerformanceRes.rows;

        // 2. Conversion Pipeline (Monthly Status Breakdown)
        const conversionDataRes = await db.execute(sql.raw(`
            SELECT 
                to_char(created_at, 'YYYY-MM') as month,
                project_status,
                COUNT(*) as count
            FROM quotations
            WHERE project_status IS NOT NULL
            GROUP BY month, project_status
            ORDER BY month DESC
        `));
        const conversionData = conversionDataRes.rows;

        return NextResponse.json({ 
            quotes: insightsData, 
            expenses: expensesData,
            clientCount: clientCount,
            estimators: estimatorPerformance,
            conversion: conversionData
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch insights data' }, { status: 500 });
    }
}
