import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { checkPermission } from '@/lib/auth';
import { sql } from 'drizzle-orm';
import { toSnakeCase } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const canView = await checkPermission('Inventory', 'can_view');
        if (!canView) {
            return NextResponse.json({ error: 'Unauthorized access to Inventory' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');

        let statusClause;
        if (status) {
            statusClause = sql`WHERE sr.status = ${status}`;
        } else {
            statusClause = sql`WHERE sr.status IN ('pending', 'revert_pending')`;
        }

        const reqRes = await db.execute(sql`
            SELECT sr.*, q.quote_number, q.client_name, q.project_type 
            FROM stock_requests sr
            JOIN quotations q ON sr.quotation_id = q.id
            ${statusClause}
            ORDER BY sr.created_at DESC
        `);
        const requests = reqRes.rows as any[];

        for (const req of requests) {
            const itemRes = await db.execute(sql`
                SELECT sri.*, ii.name as item_name, ii.unit as item_unit, ii.stock_qty as current_stock
                FROM stock_request_items sri
                JOIN inventory_items ii ON sri.inventory_item_id = ii.id
                WHERE sri.request_id = ${req.id}
            `);
            req.items = itemRes.rows;
        }

        return NextResponse.json(requests);
    } catch (error) {
        console.error("Failed to fetch stock requests", error);
        return NextResponse.json({ error: 'Failed to fetch pending stock requests' }, { status: 500 });
    }
}
