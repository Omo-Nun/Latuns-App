import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { requirePermission } from '@/lib/auth';
import { settings, expenses } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';
import { toSnakeCase } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
    const error = await requirePermission('Settings', 'can_view');
    if (error) return error;

    try {
        const defaultSettings = {
            bankName: '', accountName: '', accountNumber: '',
            companyPhone: '', companyAddress: '', companyWebsite: '', companyEmail: '',
            subsidiaries: JSON.stringify(['LATUNS ROOFING SYSTEM', 'LATUNS ESTATE DEVELOPERS'])
        };

        const rows = await db.select().from(settings);
        const settingsMap: Record<string, string> = { ...defaultSettings };

        rows.forEach(row => {
            if (row.key) {
                settingsMap[row.key] = row.value || '';
            }
        });

        return NextResponse.json(settingsMap);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const error = await requirePermission('Settings', 'can_edit');
    if (error) return error;

    try {
        const data = await request.json();
        const session = await getSession();

        await db.transaction(async (tx) => {
            // Handle Expense Category Renaming Sync
            if (data.expenseCategories && data.oldCategoryName && data.newCategoryName) {
                await tx.update(expenses).set({ category: data.newCategoryName }).where(eq(expenses.category, data.oldCategoryName));
            }

            for (const [key, value] of Object.entries(data)) {
                if (typeof value === 'string' && !['oldCategoryName', 'newCategoryName'].includes(key)) {
                    await tx.execute(sql`
                        INSERT INTO settings (key, value) 
                        VALUES (${key}, ${value}) 
                        ON CONFLICT (key) DO UPDATE SET value = ${value}
                    `);
                }
            }

            if (session) {
                const updatedKeys = Object.keys(data).filter(k => k !== 'oldCategoryName' && k !== 'newCategoryName').join(', ');
                if (updatedKeys) {
                    await logAudit(session.user.id, session.user.username, 'Update', 'Settings', `Updated general settings: ${updatedKeys}`);
                }
            }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Failed to update settings' }, { status: 500 });
    }
}
