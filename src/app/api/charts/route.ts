import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { customCharts } from '@/lib/schema';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const charts = await db.select().from(customCharts).orderBy(desc(customCharts.createdAt));
        return NextResponse.json(charts);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch custom charts' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, config } = body;

        if (!name || !config) {
            return NextResponse.json({ error: 'Name and config are required' }, { status: 400 });
        }

        const result = await db.insert(customCharts).values({
            name,
            config: JSON.stringify(config)
        }).returning({ id: customCharts.id });

        return NextResponse.json({ id: result[0].id, success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save chart' }, { status: 500 });
    }
}
