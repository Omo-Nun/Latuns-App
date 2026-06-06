import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { subDays, subMonths, subYears, isAfter } from 'date-fns';
import { calcSundries, calcGrandTotal, calcNetTotal } from '@/lib/financeUtils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const filter = searchParams.get('filter') || 'all'; // week, month, year, all

        const now = new Date();
        let startDate: Date | null = null;

        if (filter === 'week') startDate = subDays(now, 7);
        else if (filter === 'month') startDate = subMonths(now, 30); // Approximate month
        else if (filter === 'year') startDate = subYears(now, 1);



        // 1. Identify all child quotations
        let childIdsSet = new Set<number>();
        try {
            const allLinked = db.prepare("SELECT linked_quotations FROM quotations WHERE linked_quotations IS NOT NULL AND linked_quotations != ''").all() as any[];
            allLinked.forEach(row => {
                const raw = (row.linked_quotations || "").trim();
                if (!raw) return;
                try {
                    const ids = JSON.parse(raw);
                    if (Array.isArray(ids)) ids.forEach(id => childIdsSet.add(Number(id)));
                } catch { }
            });
        } catch (e) {
            console.error("Dashboard API Error (Step 1):", e);
        }

        // 2. Fetch ALL quotations (for counts) and non-Pending ones (for financials)
        let allQuotations: any[] = [];
        let financialQuotations: any[] = [];
        try {
            allQuotations = db.prepare(`
                SELECT q.*, 
                (SELECT COALESCE(SUM(total), 0) FROM quotation_items WHERE quotation_id = q.id) as subtotal
                FROM quotations q
            `).all();
            financialQuotations = allQuotations.filter(q => q.project_status && q.project_status !== 'Pending');
        } catch (e) {
            console.error("Dashboard API Error (Step 2):", e);
            throw new Error("Failed to fetch quotations subtotals");
        }

        // 3. Fetch all payments
        let allPayments: any[] = [];
        try {
            allPayments = db.prepare('SELECT quotation_id, amount FROM payments').all();
        } catch (e) {
            console.error("Dashboard API Error (Step 3):", e);
            throw new Error("Failed to fetch payments");
        }

        // 4a. Process ALL roots for counts
        const allRoots = allQuotations.filter(q => !childIdsSet.has(q.id));
        
        let totalQuotes = 0;
        let totalVisited = 0, totalNotVisited = 0, totalSent = 0;
        let todayQuotes = 0, yesterdayQuotes = 0, todayVisited = 0, yesterdayVisited = 0;

        const todayStr = now.toISOString().split('T')[0];
        const yesterdayStr = subDays(now, 1).toISOString().split('T')[0];

        allRoots.forEach(q => {
            if (!q.created_at) return;
            try {
                const qDate = new Date(q.created_at);
                if (isNaN(qDate.getTime())) return;

                if (startDate && !isAfter(qDate, startDate)) return;

                const qDateStr = q.created_at.includes('T') ? q.created_at.split('T')[0] : (q.created_at.split(' ')[0] || "");
                
                if (qDateStr === todayStr) {
                    todayQuotes++;
                    if (q.visit_status === 'Visited') todayVisited++;
                } else if (qDateStr === yesterdayStr) {
                    yesterdayQuotes++;
                    if (q.visit_status === 'Visited') yesterdayVisited++;
                }

                totalQuotes++;
                if (q.visit_status === 'Visited') totalVisited++;
                else if (q.visit_status === 'Sent') totalSent++;
                else totalNotVisited++;
            } catch (err) {
                console.error(`Error processing count for ${q.id}:`, err);
            }
        });

        // 4b. Process non-Pending roots for financials and charting
        const financialRoots = financialQuotations.filter(q => !childIdsSet.has(q.id));
        
        let chartDataMap: Record<string, { date: string, revenue: number, paid: number }> = {};
        let totalOutstanding = 0, totalPaid = 0;

        financialRoots.forEach(q => {
            if (!q.created_at) return;
            try {
                const qDate = new Date(q.created_at);
                if (isNaN(qDate.getTime())) return;

                if (startDate && !isAfter(qDate, startDate)) return;

                // Financials
                const netTotal = calcNetTotal(q);
                
                let childIds: number[] = [];
                if (q.linked_quotations) {
                    const raw = q.linked_quotations.trim();
                    if (raw) {
                        try {
                            const parsed = JSON.parse(raw);
                            if (Array.isArray(parsed)) childIds = parsed.map(id => Number(id));
                        } catch { }
                    }
                }

                const docIds = [q.id, ...childIds];
                const totalDocPaid = allPayments
                    .filter(p => docIds.includes(Number(p.quotation_id)))
                    .reduce((sum, p) => Math.round((sum + (p.amount || 0) + Number.EPSILON) * 100) / 100, 0);

                totalPaid += totalDocPaid;
                totalOutstanding += (netTotal - totalDocPaid);

                // Charting
                const dateKey = (filter === 'week' || filter === 'month') 
                    ? `${qDate.getMonth() + 1}/${qDate.getDate()}`
                    : `${qDate.toLocaleString('default', { month: 'short' })} ${qDate.getFullYear()}`;

                if (!chartDataMap[dateKey]) chartDataMap[dateKey] = { date: dateKey, revenue: 0, paid: 0 };
                chartDataMap[dateKey].revenue += netTotal;
                chartDataMap[dateKey].paid += totalDocPaid;
            } catch (err) {
                console.error(`Error processing financials for ${q.id}:`, err);
            }
        });

        // 5. Finalize miscellaneous data
        const chartData = Object.values(chartDataMap);
        let invCount = 0;
        try {
            const res = db.prepare('SELECT COUNT(*) as count FROM inventory_items').get() as any;
            invCount = res?.count || 0;
        } catch { }

        let lowStockItems: any[] = [];
        try {
            lowStockItems = db.prepare('SELECT id, name, unit, stock_qty, min_stock, low_stock FROM inventory_items WHERE stock_qty <= COALESCE(low_stock, 20) AND stock_qty >= 0 ORDER BY stock_qty ASC').all();
        } catch { }

        let rejectedRequests: any[] = [];
        try {
            rejectedRequests = db.prepare(`
                SELECT q.id as quotation_id, q.quote_number, q.client_name, q.project_type
                FROM quotations q
                JOIN stock_requests sr ON q.id = sr.quotation_id
                WHERE sr.status = 'rejected'
                GROUP BY q.id
            `).all();
        } catch { }

        return NextResponse.json({
            quoteCount: totalQuotes,
            outstanding: totalOutstanding,
            totalPaid: totalPaid,
            invCount: invCount,
            todayQuotes,
            yesterdayQuotes,
            todayVisited,
            yesterdayVisited,
            totalVisited,
            totalNotVisited,
            totalSent,
            lowStockItems,
            rejectedStockRequests: rejectedRequests,
            chartData
        });

    } catch (error: any) {
        console.error('CRITICAL Dashboard API Error:', error);
        return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
    }
}
