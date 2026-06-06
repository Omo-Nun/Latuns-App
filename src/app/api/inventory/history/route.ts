import { NextResponse } from 'next/server';
import db from '@/lib/db';

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
        const params: any[] = [];

        if (fromDate || toDate) {
            query += " WHERE ";
            const conditions = [];
            if (fromDate) {
                // To support SQLite date comparison, we use strftime
                conditions.push("date(l.created_at) >= date(?)");
                params.push(fromDate);
            }
            if (toDate) {
                conditions.push("date(l.created_at) <= date(?)");
                params.push(toDate);
            }
            query += conditions.join(" AND ");
        }

        query += " ORDER BY l.created_at DESC";

        const logs = db.prepare(query).all(...params);
        return NextResponse.json(logs);
    } catch (error) {
        console.error("Global history error:", error);
        return NextResponse.json({ error: 'Failed to fetch global inventory history' }, { status: 500 });
    }
}
