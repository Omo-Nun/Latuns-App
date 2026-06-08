import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fetchEmails } from '@/lib/mail';
import { mailAccounts } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const folder = searchParams.get('folder') || 'INBOX';
        const page = parseInt(searchParams.get('page') || '1', 10);

        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const accountRes = await db.select().from(mailAccounts).where(eq(mailAccounts.userId, session.user.id)).limit(1);
        const account = accountRes[0];
        
        if (!account) return NextResponse.json({ error: 'Mail setup required' }, { status: 400 });

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

        const emails = await fetchEmails(legacyAccount as any, folder, page);
        return NextResponse.json(emails);
    } catch (error: any) {
        console.error('Fetch mail error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch emails' }, { status: 500 });
    }
}
