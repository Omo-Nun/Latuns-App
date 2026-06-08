import { NextResponse } from 'next/server';
import { getSession, verifyPassword, hashPassword } from '@/lib/auth';
import db from '@/lib/db';
import { users } from '@/lib/schema';
import { logAudit } from '@/lib/audit';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { currentPassword, newPassword } = await request.json();

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ error: 'Current and new passwords are required' }, { status: 400 });
        }

        if (newPassword.length < 8) {
            return NextResponse.json({ error: 'New password must be at least 8 characters long' }, { status: 400 });
        }

        // Fetch user again to get the latest password hash
        const result = await db.select({ passwordHash: users.passwordHash })
            .from(users)
            .where(eq(users.id, session.user.id))
            .limit(1);
        const user = result[0];
        
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Verify current password
        if (!verifyPassword(currentPassword, user.passwordHash)) {
            return NextResponse.json({ error: 'Incorrect current password' }, { status: 400 });
        }

        // Update password
        const newHash = hashPassword(newPassword);
        await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, session.user.id));
        await logAudit(session.user.id, session.user.username, 'Update', 'Authentication', 'User updated their own password', 'users', session.user.id);

        return NextResponse.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Password change error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
