import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { users, staffRoles } from '@/lib/schema';
import { logAudit } from '@/lib/audit';
import { getSession, hashPassword, requirePermission, requireSubPermission } from '@/lib/auth';
import { eq, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
    const error = await requirePermission('Settings', 'can_view');
    if (error) return error;

    try {
        const result = await db
            .select({
                id: users.id,
                username: users.username,
                role_name: staffRoles.name,
            })
            .from(users)
            .innerJoin(staffRoles, eq(users.roleId, staffRoles.id))
            .orderBy(asc(users.username));
        
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (session.user.role_name !== 'Admin') {
            const permError = await requireSubPermission('Settings', 'Staff');
            if (permError) return permError;
        }

        const { username, password, staffId, roleId } = await request.json();
        
        if (!username || !password || !roleId) {
            return NextResponse.json({ error: 'Username, password and role are required' }, { status: 400 });
        }

        // Check if non-admin is trying to set the role to Admin
        if (session.user.role_name !== 'Admin') {
            const targetRoleRes = await db.select({ name: staffRoles.name }).from(staffRoles).where(eq(staffRoles.id, roleId)).limit(1);
            const targetRole = targetRoleRes[0];
            if (targetRole && targetRole.name === 'Admin') {
                return NextResponse.json({ error: 'Non-admins cannot assign the Admin role' }, { status: 403 });
            }
        }

        const passwordHash = hashPassword(password);

        // Check if user exists for this staff
        const existingUserRes = await db.select({ id: users.id, roleId: users.roleId }).from(users).where(eq(users.staffId, staffId)).limit(1);
        const existingUser = existingUserRes[0];
        
        if (existingUser) {
            // Check if existing user is an Admin
            if (session.user.role_name !== 'Admin' && existingUser.roleId) {
                const existingRoleRes = await db.select({ name: staffRoles.name }).from(staffRoles).where(eq(staffRoles.id, existingUser.roleId)).limit(1);
                const existingRole = existingRoleRes[0];
                if (existingRole && existingRole.name === 'Admin') {
                    return NextResponse.json({ error: 'Non-admins cannot modify an Admin user' }, { status: 403 });
                }
            }

            await db.update(users)
                .set({ username, passwordHash, roleId })
                .where(eq(users.id, existingUser.id));
            await logAudit(session.user.id, session.user.username, 'Update', 'Settings', `Updated credentials/role for user: ${username}`, 'users', existingUser.id);
            return NextResponse.json({ success: true, message: 'User updated' });
        } else {
            const insertResult = await db.insert(users)
                .values({ username, passwordHash, staffId, roleId })
                .returning({ id: users.id });
            await logAudit(session.user.id, session.user.username, 'Create', 'Settings', `Created new user credentials for: ${username}`, 'users', insertResult[0].id);
            return NextResponse.json({ success: true, message: 'User created' });
        }
    } catch (error: any) {
        if (error.message.includes('unique constraint') || error.message.includes('duplicate key')) {
            return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to save credentials' }, { status: 500 });
    }
}
