import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const fromDate = searchParams.get('from');
        const toDate = searchParams.get('to');

        let query = `
            SELECT l.*, i.name as item_name, i.unit as item_unit 
            FROM inventory_logs l 
            JOIN inventory_items i ON l.item_id = i.id
        `;
        const conditions = [];

        if (fromDate) {
            conditions.push(`DATE(l.created_at) >= DATE('${fromDate}')`);
        }
        if (toDate) {
            conditions.push(`DATE(l.created_at) <= DATE('${toDate}')`);
        }

        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        query += " ORDER BY l.created_at DESC";

        const logsRes = await db.execute(sql.raw(query));
        return NextResponse.json(logsRes.rows);
    } catch (error) {
        console.error("Global history error:", error);
        return NextResponse.json({ error: 'Failed to fetch global inventory history' }, { status: 500 });
    }
}
