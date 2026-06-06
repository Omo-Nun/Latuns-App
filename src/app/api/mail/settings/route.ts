import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { encrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const account = db.prepare('SELECT * FROM mail_accounts WHERE user_id = ?').get(session.user.id);
        
        if (!account) return NextResponse.json({ setup_required: true });

        // Mask password for security
        return NextResponse.json({ ...account, password: account.password ? '••••••••' : '' });
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

        // Validation...
        
        const existing = db.prepare('SELECT id FROM mail_accounts WHERE user_id = ?').get(session.user.id) as any;

        const encryptedPassword = encrypt(password);

        if (existing) {
            db.prepare(`
                UPDATE mail_accounts SET 
                    imap_host = ?, imap_port = ?, imap_secure = ?, 
                    smtp_host = ?, smtp_port = ?, smtp_secure = ?, 
                    email = ?, password = ?
                WHERE user_id = ?
            `).run(imap_host, imap_port, imap_secure ? 1 : 0, smtp_host, smtp_port, smtp_secure ? 1 : 0, email, encryptedPassword, session.user.id);
        } else {
            db.prepare(`
                INSERT INTO mail_accounts (user_id, imap_host, imap_port, imap_secure, smtp_host, smtp_port, smtp_secure, email, password)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(session.user.id, imap_host, imap_port, imap_secure ? 1 : 0, smtp_host, smtp_port, smtp_secure ? 1 : 0, email, encryptedPassword);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save mail settings' }, { status: 500 });
    }
}
