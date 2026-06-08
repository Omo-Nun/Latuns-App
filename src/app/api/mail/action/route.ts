import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { markAsRead, moveToTrash } from '@/lib/mail';
import { mailAccounts } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const accountRes = await db.select().from(mailAccounts).where(eq(mailAccounts.userId, session.user.id)).limit(1);
        const account = accountRes[0];
        if (!account) return NextResponse.json({ error: 'Mail setup required' }, { status: 400 });

        const { action, folder, uid } = await request.json();

        if (!action || !folder || !uid) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Map Drizzle camelCase properties back to snake_case for the legacy node-imap logic inside lib/mail if needed
        // Assuming lib/mail works with the properties we feed it. If it expects exact db column names, we might need mapping.
        // We will pass the `account` object, which now has camelCase properties (e.g. `imapHost`).
        // IMPORTANT: Ensure `lib/mail.ts` uses camelCase `account.imapHost` or we need to map them here.
        // For safety, let's map it if lib/mail expects legacy SQLite shape.
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

        if (action === 'read') {
            await markAsRead(legacyAccount as any, folder, uid);
        } else if (action === 'trash') {
            await moveToTrash(legacyAccount as any, folder, uid);
        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Mail action error:', error);
        return NextResponse.json({ error: error.message || 'Failed to perform action' }, { status: 500 });
    }
}
