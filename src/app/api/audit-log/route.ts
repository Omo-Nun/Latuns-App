import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';

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

        let query = 'SELECT * FROM audit_log WHERE 1=1';
        const params: any[] = [];

        if (user) {
            query += ' AND username LIKE ?';
            params.push(`%${user}%`);
        }
        if (module) {
            query += ' AND module = ?';
            params.push(module);
        }
        if (action) {
            query += ' AND action = ?';
            params.push(action);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const logs = db.prepare(query).all(...params);

        let countQuery = 'SELECT COUNT(*) as count FROM audit_log WHERE 1=1';
        const countParams: any[] = [];
        if (user) { countQuery += ' AND username LIKE ?'; countParams.push(`%${user}%`); }
        if (module) { countQuery += ' AND module = ?'; countParams.push(module); }
        if (action) { countQuery += ' AND action = ?'; countParams.push(action); }
        
        const totalCount = (db.prepare(countQuery).get(...countParams) as any).count;

        return NextResponse.json({
            logs,
            totalCount,
            totalPages: Math.ceil(totalCount / limit)
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
    }
}
