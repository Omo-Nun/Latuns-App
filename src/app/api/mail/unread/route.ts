import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getUnreadCount } from '@/lib/mail';
import { mailAccounts } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const accountRes = await db.select().from(mailAccounts).where(eq(mailAccounts.userId, session.user.id)).limit(1);
        const account = accountRes[0];
        if (!account) return NextResponse.json({ count: 0 });

        const legacyAccount = {
            id: account.id,
            user_id: account.userId,
            imap_host: account.imapHost,
            imap_port: account.imapPort,
            imap_secure: account.imapSecure,
            smtp_host: account.smtpHost,
            smtp_port: account.smtpPort,
            smtp_secure: account.smtpSecure,
            email: account.email,
            password: account.password
        };

        const count = await getUnreadCount(legacyAccount as any);
        return NextResponse.json({ count });
    } catch (error: any) {
        console.error('Unread count error:', error);
        return NextResponse.json({ count: 0 });
    }
}
