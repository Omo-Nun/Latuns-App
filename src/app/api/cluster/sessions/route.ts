import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import db from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
    try {
        const authError = await requirePermission('Settings', 'can_view');
        if (authError) return authError;

        const sessionsRes = await db.execute(sql.raw(`
            SELECT 
                s.id, 
                s.ip_address, 
                s.user_agent, 
                s.last_active, 
                s.expires_at,
                u.username,
                r.name as role_name
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            JOIN staff_roles r ON u.role_id = r.id
            WHERE s.expires_at > NOW()
            ORDER BY s.last_active DESC
        `));

        return NextResponse.json({ success: true, sessions: sessionsRes.rows });
    } catch (error: any) {
        console.error('Fetch Sessions Error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
