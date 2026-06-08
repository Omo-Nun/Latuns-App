import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { expenses } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const error = await requirePermission('Finances', 'can_delete');
    if (error) return error;

    try {
        const { id: idStr } = await params;
        const id = Number(idStr);
        
        await db.delete(expenses).where(eq(expenses.id, id));

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
    }
}
