import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { expenses } from '@/lib/schema';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
    const error = await requirePermission('Finances', 'can_view');
    if (error) return error;

    try {
        const expensesList = await db.select().from(expenses).orderBy(desc(expenses.date), desc(expenses.createdAt));
        return NextResponse.json(expensesList);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const error = await requirePermission('Finances', 'can_edit');
    if (error) return error;

    try {
        const data = await request.json();
        const { category, amount, date, note } = data;

        if (!category || amount === undefined || !date) {
            return NextResponse.json({ error: 'Category, amount, and date are required' }, { status: 400 });
        }

        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
        }

        const insertResult = await db.insert(expenses).values({
            category,
            amount: numericAmount,
            date: new Date(date),
            note: note || ''
        }).returning({ id: expenses.id });

        return NextResponse.json({ id: insertResult[0].id }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to record expense' }, { status: 500 });
    }
}
