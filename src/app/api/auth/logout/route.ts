import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '@/lib/db';
import { sessions } from '@/lib/schema';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { eq } from 'drizzle-orm';

export async function POST() {
    try {
        const session = await getSession();
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session_id')?.value;

        if (sessionId) {
            if (session) {
                await logAudit(session.user.id, session.user.username, 'Logout', 'Auth', 'User logged out');
            }
            await db.delete(sessions).where(eq(sessions.id, sessionId));
        }

        cookieStore.delete('session_id');

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
    }
}
