import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { sendEmail } from '@/lib/mail';
import { mailAccounts } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
    try {
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

        const formData = await request.formData();
        const to = formData.get('to') as string;
        const subject = formData.get('subject') as string;
        const text = formData.get('text') as string;
        const html = formData.get('html') as string;

        if (!to || !subject || !text) {
            return NextResponse.json({ error: 'Recipient, subject, and body are required' }, { status: 400 });
        }

        const attachments = [];
        for (const [key, value] of formData.entries()) {
            if (key === 'attachments' && value instanceof File) {
                const arrayBuffer = await value.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                attachments.push({
                    filename: value.name,
                    content: buffer,
                    contentType: value.type
                });
            }
        }

        const info = await sendEmail(legacyAccount as any, to, subject, text, html, attachments);
        return NextResponse.json({ success: true, messageId: info.messageId });
    } catch (error: any) {
        console.error('Send mail error:', error);
        return NextResponse.json({ error: error.message || 'Failed to send email' }, { status: 500 });
    }
}
