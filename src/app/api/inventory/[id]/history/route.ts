import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { inventoryLogs } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';

import { toSnakeCase } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const logs = await db.select().from(inventoryLogs).where(eq(inventoryLogs.itemId, Number(id))).orderBy(desc(inventoryLogs.createdAt));
        return NextResponse.json(toSnakeCase(logs));
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch inventory history' }, { status: 500 });
    }
}
