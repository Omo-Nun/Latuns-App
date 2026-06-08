import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { auditLog } from '@/lib/schema';
import { desc, like, eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session || session.user.role_name !== 'Admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = (page - 1) * limit;
        
        const user = searchParams.get('user') || '';
        const module = searchParams.get('module') || '';
        const action = searchParams.get('action') || '';

        // Build WHERE conditions dynamically
        const conditions: any[] = [];
        if (user) {
            conditions.push(like(auditLog.username, `%${user}%`));
        }
        if (module) {
            conditions.push(eq(auditLog.module, module));
        }
        if (action) {
            conditions.push(eq(auditLog.action, action));
        }

        // Build the query with optional conditions
        let whereClause = conditions.length > 0 ? sql.join(conditions, sql` AND `) : sql`1=1`;

        const logsRes = await db.execute(sql`
            SELECT * FROM audit_log 
            WHERE ${whereClause}
            ORDER BY created_at DESC 
            LIMIT ${limit} OFFSET ${offset}
        `);

        const countRes = await db.execute(sql`
            SELECT COUNT(*) as count FROM audit_log 
            WHERE ${whereClause}
        `);

        const totalCount = Number(countRes.rows[0]?.count) || 0;

        return NextResponse.json({
            logs: logsRes.rows,
            totalCount,
            totalPages: Math.ceil(totalCount / limit)
        });
    } catch (error) {
        console.error('Audit log error:', error);
        return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
    }
}
