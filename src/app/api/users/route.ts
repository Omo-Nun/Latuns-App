import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { getSession, hashPassword, requirePermission, requireSubPermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
    const error = await requirePermission('Settings', 'can_view');
    if (error) return error;

    try {

        const users = db.prepare(`
            SELECT u.id, u.username, r.name as role_name 
            FROM users u
            JOIN staff_roles r ON u.role_id = r.id
            ORDER BY u.username ASC
        `).all();
        
        return NextResponse.json(users);
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
            const targetRole = db.prepare('SELECT name FROM staff_roles WHERE id = ?').get(roleId) as any;
            if (targetRole && targetRole.name === 'Admin') {
                return NextResponse.json({ error: 'Non-admins cannot assign the Admin role' }, { status: 403 });
            }
        }

        const passwordHash = hashPassword(password);

        // Check if user exists for this staff
        const existingUser = db.prepare('SELECT id, role_id FROM users WHERE staff_id = ?').get(staffId) as any;
        
        if (existingUser) {
            // Check if existing user is an Admin
            if (session.user.role_name !== 'Admin') {
                const existingRole = db.prepare('SELECT name FROM staff_roles WHERE id = ?').get(existingUser.role_id) as any;
                if (existingRole && existingRole.name === 'Admin') {
                    return NextResponse.json({ error: 'Non-admins cannot modify an Admin user' }, { status: 403 });
                }
            }

            db.prepare('UPDATE users SET username = ?, password_hash = ?, role_id = ? WHERE id = ?')
                .run(username, passwordHash, roleId, existingUser.id);
            logAudit(session.user.id, session.user.username, 'Update', 'Settings', `Updated credentials/role for user: ${username}`, 'users', existingUser.id);
            return NextResponse.json({ success: true, message: 'User updated' });
        } else {
            const insertResult = db.prepare('INSERT INTO users (username, password_hash, staff_id, role_id) VALUES (?, ?, ?, ?)')
                .run(username, passwordHash, staffId, roleId);
            logAudit(session.user.id, session.user.username, 'Create', 'Settings', `Created new user credentials for: ${username}`, 'users', Number(insertResult.lastInsertRowid));
            return NextResponse.json({ success: true, message: 'User created' });
        }
    } catch (error: any) {
        if (error.message.includes('UNIQUE constraint failed: users.username')) {
            return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to save credentials' }, { status: 500 });
    }
}
