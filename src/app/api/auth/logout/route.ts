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

        try {
            if (sessionId) {
                if (session) {
                    await logAudit(session.user.id, session.user.username, 'Logout', 'Auth', 'User logged out');
                }
                await db.delete(sessions).where(eq(sessions.id, sessionId));
            }
        } catch (dbError) {
            // Ignore DB errors (e.g. read-only replica) and proceed to delete the cookie
            console.error('Logout DB Error (ignoring):', dbError);
        }

        cookieStore.delete('session_id');

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
    }
}
