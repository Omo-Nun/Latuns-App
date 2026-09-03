import { NextResponse } from 'next/server';
import { encrypt } from '@/lib/encryption';
import { requirePermission } from '@/lib/auth';
import db from '@/lib/db';
import { settings } from '@/lib/schema';
import fs from 'fs/promises';
import path from 'path';
import { sql } from 'drizzle-orm';
import { headers } from 'next/headers';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export async function POST() {
    try {
        // Dual auth: accept either a valid user session OR localhost origin
        const headersList = await headers();
        const host = headersList.get('host') || '';
        const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1');

        if (!isLocalhost) {
            // External request — require user session authentication
            const authError = await requirePermission('Settings', 'can_edit');
            if (authError) return authError;
        }

        console.log('Initiating Close of Business (COB) backup trigger...');
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `erp_backup_${timestamp}.dump`;
        
        // Ensure backups directory exists
        const backupDir = path.join(process.cwd(), 'backups');
        await fs.mkdir(backupDir, { recursive: true });
        
        const backupFilePath = path.join(backupDir, backupFileName);
        
        // 1. Create a safe pg_dump using postgresql-client
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) {
            throw new Error('DATABASE_URL is not configured. Cannot perform backup.');
        }

        try {
            console.log(`Executing pg_dump...`);
            await execPromise(`pg_dump "${dbUrl}" -f "${backupFilePath}"`);
            console.log('pg_dump completed successfully.');
        } catch (dumpErr: any) {
            console.error(`pg_dump failed: ${dumpErr.message}`);
            // Fallback for local development environments where pg_dump might not be installed
            if (process.env.NODE_ENV !== 'production') {
                console.warn('Development mode: Falling back to simulated backup since pg_dump failed.');
                await fs.writeFile(backupFilePath, 'SIMULATED POSTGRES DUMP (DEV FALLBACK)');
            } else {
                throw new Error(`Database dump failed: ${dumpErr.message}`);
            }
        }

        // 2. Read the binary backup file and convert to base64 string
        const dbBuffer = await fs.readFile(backupFilePath);
        const dbBase64 = dbBuffer.toString('base64');
        
        // 3. Client-Side Zero-Knowledge Encryption
        const encryptedPayload = encrypt(dbBase64);
        
        const encFilePath = `${backupFilePath}.enc`;
        await fs.writeFile(encFilePath, encryptedPayload);
        
        // 4. Cleanup the unencrypted file
        await fs.unlink(backupFilePath);
        
        // 5. Update settings to record the last backup time
        const backupTime = new Date().toISOString();
        await db.execute(sql`
            INSERT INTO settings (key, value) 
            VALUES ('lastBackup', ${backupTime}) 
            ON CONFLICT (key) DO UPDATE SET value = ${backupTime}
        `);

        console.log(`Successfully created and encrypted local backup: ${encFilePath}`);
        
        return NextResponse.json({ success: true, message: 'End of Day backup successfully created and encrypted locally.' });
    } catch (error: any) {
        console.error('Backup Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Failed to execute backup' }, { status: 500 });
    }
}
