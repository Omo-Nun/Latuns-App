import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fetchAttachment } from '@/lib/mail';

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

        const account = db.prepare('SELECT * FROM mail_accounts WHERE user_id = ?').get(session.user.id) as any;
        
        if (!account) return new NextResponse('Mail setup required', { status: 400 });

        const attachment = await fetchAttachment(account, folder, uid, filename);
        
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
