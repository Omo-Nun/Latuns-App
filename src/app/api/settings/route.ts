import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { requirePermission } from '@/lib/auth';

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

        const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string, value: string }[];
        const settings: Record<string, string> = { ...defaultSettings };

        rows.forEach(row => {
            settings[row.key] = row.value;
        });

        return NextResponse.json(settings);
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

        const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

        db.exec('BEGIN TRANSACTION');
        try {
            // Handle Expense Category Renaming Sync
            if (data.expenseCategories && data.oldCategoryName && data.newCategoryName) {
                db.prepare('UPDATE expenses SET category = ? WHERE category = ?')
                  .run(data.newCategoryName, data.oldCategoryName);
            }

            for (const [key, value] of Object.entries(data)) {
                if (typeof value === 'string' && !['oldCategoryName', 'newCategoryName'].includes(key)) {
                    stmt.run(key, value);
                }
            }
            db.exec('COMMIT');
            if (session) {
                const updatedKeys = Object.keys(data).filter(k => k !== 'oldCategoryName' && k !== 'newCategoryName').join(', ');
                if (updatedKeys) {
                    logAudit(session.user.id, session.user.username, 'Update', 'Settings', `Updated general settings: ${updatedKeys}`);
                }
            }
            return NextResponse.json({ success: true });
        } catch (e) {
            db.exec('ROLLBACK');
            throw e;
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Failed to update settings' }, { status: 500 });
    }
}
