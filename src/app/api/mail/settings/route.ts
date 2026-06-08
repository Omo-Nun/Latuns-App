import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { encrypt } from '@/lib/encryption';
import { mailAccounts } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const accountRes = await db.select().from(mailAccounts).where(eq(mailAccounts.userId, session.user.id)).limit(1);
        const account = accountRes[0];
        
        if (!account) return NextResponse.json({ setup_required: true });

        // Map to legacy response shape that frontend expects if any (specifically properties)
        const mappedAccount = {
            ...account,
            imap_host: account.imapHost,
            imap_port: account.imapPort,
            imap_secure: account.imapSecure,
            smtp_host: account.smtpHost,
            smtp_port: account.smtpPort,
            smtp_secure: account.smtpSecure,
        };

        // Mask password for security
        return NextResponse.json({ ...mappedAccount, password: account.password ? '••••••••' : '' });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch mail settings' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const data = await request.json();
        const { imap_host, imap_port, imap_secure, smtp_host, smtp_port, smtp_secure, email, password } = data;

        const existingRes = await db.select({ id: mailAccounts.id }).from(mailAccounts).where(eq(mailAccounts.userId, session.user.id)).limit(1);
        const existing = existingRes[0];

        const encryptedPassword = encrypt(password);

        if (existing) {
            await db.update(mailAccounts).set({
                imapHost: imap_host,
                imapPort: Number(imap_port),
                imapSecure: imap_secure ? true : false,
                smtpHost: smtp_host,
                smtpPort: Number(smtp_port),
                smtpSecure: smtp_secure ? true : false,
                email,
                password: encryptedPassword
            }).where(eq(mailAccounts.userId, session.user.id));
        } else {
            await db.insert(mailAccounts).values({
                userId: session.user.id,
                imapHost: imap_host,
                imapPort: Number(imap_port),
                imapSecure: imap_secure ? true : false,
                smtpHost: smtp_host,
                smtpPort: Number(smtp_port),
                smtpSecure: smtp_secure ? true : false,
                email,
                password: encryptedPassword
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save mail settings' }, { status: 500 });
    }
}
