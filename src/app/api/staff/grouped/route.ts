import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession, requireSubPermission } from '@/lib/auth';
import { staffRoles, agents, users } from '@/lib/schema';
import { eq } from 'drizzle-orm';

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

        const roles = await db.select().from(staffRoles);
        
        const rolesWithStaff = await Promise.all(roles.map(async (role) => {
            const staff = await db
                .select({
                    id: agents.id,
                    name: agents.name,
                    phone: agents.phone,
                    username: users.username,
                    user_id: users.id,
                })
                .from(agents)
                .leftJoin(users, eq(agents.id, users.staffId))
                .where(eq(agents.role, role.name));
            
            return {
                ...role,
                staff
            };
        }));

        return NextResponse.json(rolesWithStaff);
    } catch (error) {
        console.error("Failed to fetch grouped staff", error);
        return NextResponse.json({ error: 'Failed to fetch grouped staff' }, { status: 500 });
    }
}
