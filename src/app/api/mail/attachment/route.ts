import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fetchAttachment } from '@/lib/mail';
import { mailAccounts } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const folder = searchParams.get('folder') || 'INBOX';
        const uid = parseInt(searchParams.get('uid') || '0', 10);
        const filename = searchParams.get('filename');

        if (!uid || !filename) {
            return new NextResponse('Missing uid or filename', { status: 400 });
        }

        const session = await getSession();
        if (!session) return new NextResponse('Unauthorized', { status: 401 });

        const accountRes = await db.select().from(mailAccounts).where(eq(mailAccounts.userId, session.user.id)).limit(1);
        const account = accountRes[0];
        
        if (!account) return new NextResponse('Mail setup required', { status: 400 });

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

        const attachment = await fetchAttachment(legacyAccount as any, folder, uid, filename);
        
        return new NextResponse(attachment.content, {
            headers: {
                'Content-Type': attachment.contentType || 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`
            }
        });
    } catch (error: any) {
        console.error('Fetch attachment error:', error);
        return new NextResponse(error.message || 'Failed to fetch attachment', { status: 500 });
    }
}
