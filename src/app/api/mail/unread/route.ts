import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getUnreadCount } from '@/lib/mail';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const account = db.prepare('SELECT * FROM mail_accounts WHERE user_id = ?').get(session.user.id) as any;
        if (!account) return NextResponse.json({ count: 0 });

        const count = await getUnreadCount(account);
        return NextResponse.json({ count });
    } catch (error: any) {
        console.error('Unread count error:', error);
        return NextResponse.json({ count: 0 });
    }
}
