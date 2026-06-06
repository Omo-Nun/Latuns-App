import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { sendEmail } from '@/lib/mail';

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const account = db.prepare('SELECT * FROM mail_accounts WHERE user_id = ?').get(session.user.id) as any;
        
        if (!account) return NextResponse.json({ error: 'Mail setup required' }, { status: 400 });

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

        const info = await sendEmail(account, to, subject, text, html, attachments);
        return NextResponse.json({ success: true, messageId: info.messageId });
    } catch (error: any) {
        console.error('Send mail error:', error);
        return NextResponse.json({ error: error.message || 'Failed to send email' }, { status: 500 });
    }
}
