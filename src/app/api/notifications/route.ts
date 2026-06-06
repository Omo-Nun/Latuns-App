import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const url = new URL(request.url);
        const unreadOnly = url.searchParams.get('unread') === 'true';
        
        let query = 'SELECT * FROM notifications WHERE user_id = ?';
        if (unreadOnly) query += ' AND is_read = 0';
        query += ' ORDER BY created_at DESC LIMIT 50';

        const notifications = db.prepare(query).all(session.user.id);
        
        const unreadCount = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0')
            .get(session.user.id).count;

        return NextResponse.json({ notifications, unreadCount });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id, all } = await request.json();

        if (all) {
            db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(session.user.id);
        } else if (id) {
            db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id, session.user.id);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
    }
}
