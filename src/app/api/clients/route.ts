import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { calcGrandTotal, calcNetTotal } from '@/lib/financeUtils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = (page - 1) * limit;
        const search = searchParams.get('search') || '';

        let query = "SELECT id, name, phone, address, state, city, updated_at, created_at FROM clients";
        let params = [];
        
        if (search) {
            query += " WHERE name LIKE ? OR phone LIKE ?";
            params.push(`%${search}%`, `%${search}%`);
        }
        
        const countQuery = "SELECT COUNT(*) as count FROM clients" + (search ? " WHERE name LIKE ? OR phone LIKE ?" : "");
        const totalCount = (db.prepare(countQuery).get(...params) as any).count;
        const totalPages = Math.ceil(totalCount / limit);

        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
        params.push(limit, offset);

        const clients = db.prepare(query).all(...params) as any[];

        if (clients.length === 0) {
            return NextResponse.json({ data: [], meta: { page, limit, totalPages, totalCount } });
        }

        const allQuotes = db.prepare(`
            SELECT q.id, q.client_id, q.doc_type, q.project_status, q.sundries, q.transportation, q.linked_quotations, q.discount_value, q.project_type, q.visit_status, q.created_at,
            COALESCE(SUM(qi.total), 0) as subtotal
            FROM quotations q
            LEFT JOIN quotation_items qi ON q.id = qi.quotation_id
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

        // Use Root Selection logic
        const activeRoots = allQuotes.filter(q => 
            !childIdsSet.has(q.id) && 
            q.project_status !== 'Pending' && 
            q.project_status != null
        );

        const clientsWithTotals = clients.map(c => {
            const clientActiveRoots = activeRoots.filter(q => q.client_id === c.id);
            const totalValue = clientActiveRoots.reduce((sum, q) => {
                return sum + calcNetTotal(q);
            }, 0);

            const sortedRoots = [...clientActiveRoots].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
            const latest_project_status = sortedRoots.length > 0 ? sortedRoots[0].project_status : 'Unknown';

            const project_types: string[] = clientActiveRoots.map(q => q.project_type).filter(Boolean);
            const visit_statuses: string[] = clientActiveRoots.map(q => q.visit_status).filter(Boolean);

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

        const stmt = db.prepare("INSERT INTO clients (name, phone, address, state, city) VALUES (?, ?, ?, ?, ?)");
        const info = stmt.run(name, phone || '', address || '', state || '', city || '');

        return NextResponse.json({ id: Number(info.lastInsertRowid), success: true }, { status: 201 });
    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message || 'Failed to create client' }, { status: 500 });
    }
}
