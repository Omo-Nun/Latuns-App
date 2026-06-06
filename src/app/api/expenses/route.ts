import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
    const error = await requirePermission('Finances', 'can_view');
    if (error) return error;

    try {
        const expenses = db.prepare('SELECT * FROM expenses ORDER BY date DESC, created_at DESC').all();
        return NextResponse.json(expenses);
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

        const stmt = db.prepare('INSERT INTO expenses (category, amount, date, note) VALUES (?, ?, ?, ?)');
        const info = stmt.run(category, amount, date, note || '');

        return NextResponse.json({ id: info.lastInsertRowid }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to record expense' }, { status: 500 });
    }
}
