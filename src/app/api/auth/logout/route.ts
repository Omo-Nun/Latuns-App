import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function POST() {
    try {
        const session = await getSession();
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session_id')?.value;

        if (sessionId) {
            if (session) {
                logAudit(session.user.id, session.user.username, 'Logout', 'Auth', 'User logged out');
            }
            db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
        }

        cookieStore.delete('session_id');

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
    }
}
