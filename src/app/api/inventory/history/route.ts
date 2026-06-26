import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const fromDate = searchParams.get('from');
        const toDate = searchParams.get('to');

        const conditions: ReturnType<typeof sql>[] = [];

        if (fromDate) {
            conditions.push(sql`l.created_at::date >= ${fromDate}::date`);
        }
        if (toDate) {
            conditions.push(sql`l.created_at::date <= ${toDate}::date`);
        }

        const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

        const logsRes = await db.execute(sql`
            SELECT l.*, i.name as item_name, i.unit as item_unit 
            FROM inventory_logs l 
            JOIN inventory_items i ON l.item_id = i.id
            ${whereClause}
            ORDER BY l.created_at DESC
        `);
        return NextResponse.json(logsRes.rows);
    } catch (error) {
        console.error("Global history error:", error);
        return NextResponse.json({ error: 'Failed to fetch global inventory history' }, { status: 500 });
    }
}
