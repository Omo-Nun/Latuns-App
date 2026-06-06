import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession, requireSubPermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (session.user.role_name !== 'Admin') {
            const permError = await requireSubPermission('Settings', 'Staff');
            if (permError) return permError;
        }

        const roles = db.prepare('SELECT * FROM staff_roles').all() as any[];
        
        const rolesWithStaff = roles.map(role => {
            // Get agents associated with this role
            // We'll match by the 'role' string in agents table for now, or improve the schema
            const staff = db.prepare(`
                SELECT a.id, a.name, a.phone, u.username, u.id as user_id
                FROM agents a
                LEFT JOIN users u ON a.id = u.staff_id
                WHERE a.role = ?
            `).all(role.name);
            
            return {
                ...role,
                staff
            };
        });

        return NextResponse.json(rolesWithStaff);
    } catch (error) {
        console.error("Failed to fetch grouped staff", error);
        return NextResponse.json({ error: 'Failed to fetch grouped staff' }, { status: 500 });
    }
}
