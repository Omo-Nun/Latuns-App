import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fetchEmails } from '@/lib/mail';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const folder = searchParams.get('folder') || 'INBOX';
        const page = parseInt(searchParams.get('page') || '1', 10);

        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const account = db.prepare('SELECT * FROM mail_accounts WHERE user_id = ?').get(session.user.id) as any;
        
        if (!account) return NextResponse.json({ error: 'Mail setup required' }, { status: 400 });

        const emails = await fetchEmails(account, folder, page);
        return NextResponse.json(emails);
    } catch (error: any) {
        console.error('Fetch mail error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch emails' }, { status: 500 });
    }
}
