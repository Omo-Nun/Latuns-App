import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';
import { decrypt } from './encryption';

export async function fetchEmails(config: any, folder: string = 'INBOX', page: number = 1) {
    const client = new ImapFlow({
        host: config.imap_host,
        port: config.imap_port,
        secure: config.imap_secure === 1 || config.imap_secure === true,
        auth: {
            user: config.email,
            pass: decrypt(config.password)
        },
        logger: false,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        tls: {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();
    } catch (err: any) {
        console.error('IMAP Connection Full Error:', err);
        throw new Error(`Failed to connect to IMAP server: ${err.message}`);
    }

    let targetFolder = folder;
    
    // Dynamically find the Sent folder if requested
    if (folder.toUpperCase() === 'SENT') {
        try {
            const mailboxes = await client.list();
            const sentBox = mailboxes.find(mb => mb.specialUse === '\\Sent' || mb.name.toLowerCase() === 'sent' || mb.name.toLowerCase() === 'sent items' || mb.name.toLowerCase() === 'sent messages');
            if (sentBox) {
                targetFolder = sentBox.path;
            } else {
                console.warn('Could not definitively identify a Sent folder, falling back to "Sent"');
                targetFolder = 'Sent';
            }
        } catch (err) {
            console.error('Failed to list mailboxes to find Sent box:', err);
            targetFolder = 'Sent';
        }
    }

    let lock;
    try {
        lock = await client.getMailboxLock(targetFolder);
    } catch (err: any) {
        console.error(`IMAP Lock Error for folder ${targetFolder}:`, err);
        await client.logout();
        throw new Error(`Folder ${targetFolder} not found or accessible.`);
    }
    
    const emails: any[] = [];

    try {
        const mailbox: any = client.mailbox;
        const totalMessages = mailbox?.exists || 0;

        const limit = 30;
        const end = Math.max(1, totalMessages - ((page - 1) * limit));

        if (end < 1 || totalMessages === 0) {
            return [];
        }

        const start = Math.max(1, end - limit + 1);
        const range = `${start}:${end}`;

        for await (const message of client.fetch(range, { envelope: true, source: true, flags: true })) {
            try {
                const parsed: any = await simpleParser(message.source as Buffer);
                const read = message.flags ? message.flags.has('\\Seen') : true;
                
                // Extract basic attachment metadata without sending the entire buffer to the frontend
                const attachmentMeta = parsed.attachments?.map((att: any) => ({
                    filename: att.filename || 'Unknown',
                    contentType: att.contentType,
                    size: att.size
                })) || [];

                emails.push({
                    uid: message.uid,
                    subject: parsed.subject || '(No Subject)',
                    from: parsed.from?.text || 'Unknown Sender',
                    date: parsed.date?.toISOString() || new Date().toISOString(),
                    text: parsed.text || '',
                    html: parsed.html || '',
                    attachments: attachmentMeta,
                    read
                });
            } catch (parseErr) {
                // Skip unparseable messages
                console.warn('Failed to parse message UID', message.uid, parseErr);
            }
        }
    } catch (err: any) {
        console.error('IMAP Fetch Error:', err);
        throw new Error(`Error fetching messages: ${err.message}`);
    } finally {
        lock.release();
    }

    await client.logout();
    return emails.reverse(); // Newest first
}

export async function sendEmail(config: any, to: string, subject: string, text: string, html?: string, attachments?: any[]) {
    const transporter = nodemailer.createTransport({
        host: config.smtp_host,
        port: config.smtp_port,
        secure: config.smtp_secure === 1 || config.smtp_secure === true,
        auth: {
            user: config.email,
            pass: decrypt(config.password)
        },
        connectionTimeout: 10000,
    });

    try {
        const info = await transporter.sendMail({
            from: `"${config.email}" <${config.email}>`,
            to,
            subject,
            text,
            html: html || text,
            attachments
        });
        return info;
    } catch (err: any) {
        throw new Error(`Failed to send email: ${err.message}`);
    }
}

export async function fetchAttachment(config: any, folder: string = 'INBOX', uid: number, filename: string) {
    const client = new ImapFlow({
        host: config.imap_host,
        port: config.imap_port,
        secure: config.imap_secure === 1 || config.imap_secure === true,
        auth: {
            user: config.email,
            pass: decrypt(config.password)
        },
        logger: false,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        tls: {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();
    } catch (err: any) {
        throw new Error(`Failed to connect to IMAP server: ${err.message}`);
    }

    let targetFolder = folder;
    
    // Dynamically find the Sent folder if requested
    if (folder.toUpperCase() === 'SENT') {
        try {
            const mailboxes = await client.list();
            const sentBox = mailboxes.find(mb => mb.specialUse === '\\Sent' || mb.name.toLowerCase() === 'sent' || mb.name.toLowerCase() === 'sent items' || mb.name.toLowerCase() === 'sent messages');
            if (sentBox) {
                targetFolder = sentBox.path;
            } else {
                targetFolder = 'Sent';
            }
        } catch (err) {
            targetFolder = 'Sent';
        }
    }

    let lock;
    try {
        lock = await client.getMailboxLock(targetFolder);
    } catch (err: any) {
        await client.logout();
        throw new Error(`Folder ${targetFolder} not found or accessible.`);
    }

    try {
        const message = await client.fetchOne(uid.toString(), { source: true }, { uid: true });
        if (!message) throw new Error("Message not found");
        
        const parsed: any = await simpleParser(message.source as Buffer);
        const attachment = parsed.attachments?.find((a: any) => a.filename === filename);
        
        if (!attachment) throw new Error("Attachment not found");
        
        return {
            content: attachment.content, // Buffer
            contentType: attachment.contentType,
            filename: attachment.filename
        };
    } finally {
        lock.release();
        await client.logout();
    }
}

export async function markAsRead(config: any, folder: string = 'INBOX', uid: number) {
    const client = new ImapFlow({
        host: config.imap_host, port: config.imap_port,
        secure: config.imap_secure === 1 || config.imap_secure === true,
        auth: { user: config.email, pass: decrypt(config.password) },
        logger: false, tls: { rejectUnauthorized: false }
    });
    await client.connect();
    let targetFolder = folder;
    if (folder.toUpperCase() === 'SENT') {
        const mailboxes = await client.list();
        const sentBox = mailboxes.find(mb => mb.specialUse === '\\Sent' || mb.name.toLowerCase() === 'sent' || mb.name.toLowerCase() === 'sent items');
        targetFolder = sentBox ? sentBox.path : 'Sent';
    }
    let lock = await client.getMailboxLock(targetFolder);
    try {
        await client.messageFlagsAdd(uid.toString(), ['\\Seen'], { uid: true });
    } finally {
        lock.release();
        await client.logout();
    }
}

export async function moveToTrash(config: any, folder: string = 'INBOX', uid: number) {
    const client = new ImapFlow({
        host: config.imap_host, port: config.imap_port,
        secure: config.imap_secure === 1 || config.imap_secure === true,
        auth: { user: config.email, pass: decrypt(config.password) },
        logger: false, tls: { rejectUnauthorized: false }
    });
    await client.connect();
    
    const mailboxes = await client.list();
    
    let targetFolder = folder;
    if (folder.toUpperCase() === 'SENT') {
        const sentBox = mailboxes.find(mb => mb.specialUse === '\\Sent' || mb.name.toLowerCase() === 'sent' || mb.name.toLowerCase() === 'sent items');
        targetFolder = sentBox ? sentBox.path : 'Sent';
    }

    const trashBox = mailboxes.find(mb => mb.specialUse === '\\Trash' || mb.name.toLowerCase() === 'trash' || mb.name.toLowerCase() === 'deleted items' || mb.name.toLowerCase() === 'bin');
    const trashFolder = trashBox ? trashBox.path : 'Trash';

    let lock = await client.getMailboxLock(targetFolder);
    try {
        await client.messageMove(uid.toString(), trashFolder, { uid: true });
    } finally {
        lock.release();
        await client.logout();
    }
}

export async function fetchFolders(config: any) {
    const client = new ImapFlow({
        host: config.imap_host, port: config.imap_port,
        secure: config.imap_secure === 1 || config.imap_secure === true,
        auth: { user: config.email, pass: decrypt(config.password) },
        logger: false, tls: { rejectUnauthorized: false }
    });
    await client.connect();
    try {
        const mailboxes = await client.list();
        return mailboxes.map(mb => ({
            name: mb.name,
            path: mb.path,
            specialUse: mb.specialUse
        }));
    } finally {
        await client.logout();
    }
}

export async function getUnreadCount(config: any) {
    const client = new ImapFlow({
        host: config.imap_host,
        port: config.imap_port,
        secure: config.imap_secure === 1 || config.imap_secure === true,
        auth: {
            user: config.email,
            pass: decrypt(config.password)
        },
        logger: false,
        tls: {
            rejectUnauthorized: false
        }
    });

    await client.connect();
    try {
        const status = await client.status('INBOX', { unseen: true });
        return status.unseen || 0;
    } finally {
        await client.logout();
    }
}
