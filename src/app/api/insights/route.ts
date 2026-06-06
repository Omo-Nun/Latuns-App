import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { calcGrandTotal, calcNetTotal } from '@/lib/financeUtils';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const allQuotes = db.prepare(`
            SELECT q.id, q.client_name, q.client_state, q.client_city, q.subsidiary_name, q.status, q.created_at, q.sundries, q.transportation,
            q.project_type, q.visit_status, q.project_status, q.doc_type, q.linked_quotations, q.discount_value, a.name as estimator_name,
            COALESCE(SUM(qi.total), 0) as subtotal,
            COALESCE((SELECT SUM(amount) FROM payments WHERE quotation_id = q.id), 0) as total_paid
            FROM quotations q
            LEFT JOIN quotation_items qi ON q.id = qi.quotation_id
            LEFT JOIN agents a ON q.agent_id = a.id
            GROUP BY q.id
        `).all() as any[];

        // Identify all children of project scopes/discount statements
        const childIdsSet = new Set<number>();
        allQuotes.forEach(q => {
            if (q.linked_quotations) {
                try {
                    const ids: number[] = JSON.parse(q.linked_quotations);
                    ids.forEach(id => childIdsSet.add(id));
                } catch { }
            }
        });

        // Use Root Selection logic: A root is any Parent or Standalone Quotation
        const activeRoots = allQuotes.filter(q => 
            !childIdsSet.has(q.id) && 
            q.project_status !== 'Pending' && 
            q.project_status != null
        );

        const allPayments = db.prepare('SELECT quotation_id, amount FROM payments').all() as any[];

        const insightsData = activeRoots.map(q => {
            // Aggregate payments for this root AND its children
            let linkedIds: number[] = [];
            if (q.linked_quotations) {
                try { linkedIds = JSON.parse(q.linked_quotations); } catch { }
            }
            const allDocIds = [q.id, ...linkedIds];
            const totalPaid = allPayments
                .filter(p => allDocIds.includes(p.quotation_id))
                .reduce((acc, p) => Math.round((acc + p.amount + Number.EPSILON) * 100) / 100, 0);

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

        const expensesData = db.prepare('SELECT * FROM expenses').all();
        const clientCount = db.prepare('SELECT COUNT(*) as count FROM clients').get() as { count: number };

        // 1. Estimator Performance
        const estimatorPerformance = db.prepare(`
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
            GROUP BY a.id
            ORDER BY total_revenue DESC
        `).all() as any[];

        // 2. Conversion Pipeline (Monthly Status Breakdown)
        const conversionData = db.prepare(`
            SELECT 
                strftime('%Y-%m', created_at) as month,
                project_status,
                COUNT(*) as count
            FROM quotations
            WHERE project_status IS NOT NULL
            GROUP BY month, project_status
            ORDER BY month DESC
        `).all() as any[];

        return NextResponse.json({ 
            quotes: insightsData, 
            expenses: expensesData,
            clientCount: clientCount.count,
            estimators: estimatorPerformance,
            conversion: conversionData
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch insights data' }, { status: 500 });
    }
}
