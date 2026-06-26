import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { calcNetTotal } from '@/lib/financeUtils';
import { clients, quotations, quotationItems } from '@/lib/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = (page - 1) * limit;
        const search = searchParams.get('search') || '';

        let whereClause = sql``;
        if (search) {
            const searchPattern = `%${search}%`;
            whereClause = sql`WHERE name ILIKE ${searchPattern} OR phone ILIKE ${searchPattern}`;
        }

        const clientsRes = await db.execute(sql`
            SELECT id, name, phone, address, state, city, updated_at, created_at 
            FROM clients 
            ${whereClause} 
            ORDER BY created_at DESC 
            LIMIT ${limit} OFFSET ${offset}
        `);
        const clientsList = clientsRes.rows;

        const countRes = await db.execute(sql`SELECT COUNT(*) as count FROM clients ${whereClause}`);
        const totalCount = Number(countRes.rows[0].count);
        const totalPages = Math.ceil(totalCount / limit);

        if (clientsList.length === 0) {
            return NextResponse.json({ data: [], meta: { page, limit, totalPages, totalCount } });
        }

        const allQuotesRes = await db.execute(sql.raw(`
            SELECT q.id, q.client_id, q.doc_type, q.project_status, q.sundries, q.transportation, q.linked_quotations, q.discount_value, q.project_type, q.visit_status, q.created_at,
            COALESCE(SUM(qi.total), 0) as subtotal
            FROM quotations q
            LEFT JOIN quotation_items qi ON q.id = qi.quotation_id
            GROUP BY q.id
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

        // Use Root Selection logic
        const activeRoots = allQuotes.filter((q: any) => 
            !childIdsSet.has(Number(q.id)) && 
            q.project_status !== 'Pending' && 
            q.project_status != null
        );

        const clientsWithTotals = clientsList.map((c: any) => {
            const clientActiveRoots = activeRoots.filter((q: any) => q.client_id === c.id);
            const totalValue = clientActiveRoots.reduce((sum: number, q: any) => {
                return sum + calcNetTotal(q);
            }, 0);

            const sortedRoots = [...clientActiveRoots].sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
            const latest_project_status = sortedRoots.length > 0 ? sortedRoots[0].project_status : 'Unknown';

            const project_types: string[] = clientActiveRoots.map((q: any) => q.project_type).filter(Boolean);
            const visit_statuses: string[] = clientActiveRoots.map((q: any) => q.visit_status).filter(Boolean);

            // Total quotes is just count of active root documents
            return {
                ...c,
                total_quotations: clientActiveRoots.length,
                total_value: totalValue,
                latest_project_status,
                project_types,
                visit_statuses
            };
        });

        return NextResponse.json({ data: clientsWithTotals, meta: { page, limit, totalPages, totalCount } });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, phone, address, state, city } = body;

        if (!name) {
            return NextResponse.json({ error: 'Client name is required' }, { status: 400 });
        }

        const insertResult = await db.insert(clients).values({
            name,
            phone: phone || '',
            address: address || '',
            state: state || '',
            city: city || ''
        }).returning({ id: clients.id });

        return NextResponse.json({ id: insertResult[0].id, success: true }, { status: 201 });
    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message || 'Failed to create client' }, { status: 500 });
    }
}
