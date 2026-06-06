import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { markAsRead, moveToTrash } from '@/lib/mail';

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const account = db.prepare('SELECT * FROM mail_accounts WHERE user_id = ?').get(session.user.id) as any;
        if (!account) return NextResponse.json({ error: 'Mail setup required' }, { status: 400 });

        const { action, folder, uid } = await request.json();

        if (!action || !folder || !uid) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (action === 'read') {
            await markAsRead(account, folder, uid);
        } else if (action === 'trash') {
            await moveToTrash(account, folder, uid);
        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Mail action error:', error);
        return NextResponse.json({ error: error.message || 'Failed to perform action' }, { status: 500 });
    }
}
