import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { customCharts } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        const id = Number(params.id);
        await db.delete(customCharts).where(eq(customCharts.id, id));
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete custom chart' }, { status: 500 });
    }
}
