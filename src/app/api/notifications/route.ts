import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { notifications } from '@/lib/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const url = new URL(request.url);
        const unreadOnly = url.searchParams.get('unread') === 'true';
        
        const conditions = [eq(notifications.userId, session.user.id)];
        if (unreadOnly) {
            conditions.push(eq(notifications.isRead, false));
        }

        const notificationsList = await db.select().from(notifications)
            .where(and(...conditions))
            .orderBy(desc(notifications.createdAt))
            .limit(50);
        
        const countRes = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM notifications WHERE user_id = ${session.user.id} AND is_read = false`));
        const unreadCount = Number(countRes.rows[0].count);

        return NextResponse.json({ notifications: notificationsList, unreadCount });
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
            await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, session.user.id));
        } else if (id) {
            await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, Number(id)), eq(notifications.userId, session.user.id)));
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
    }
}
