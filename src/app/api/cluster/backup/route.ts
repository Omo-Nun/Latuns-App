import { NextResponse } from 'next/server';
import { encrypt } from '@/lib/encryption';
import db from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

export async function POST() {
    try {
        console.log('Initiating Close of Business (COB) backup trigger...');
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `erp_backup_${timestamp}.db`;
        
        // Ensure backups directory exists
        const backupDir = path.join(process.cwd(), 'backups');
        await fs.mkdir(backupDir, { recursive: true });
        
        const backupFilePath = path.join(backupDir, backupFileName);
        
        // 1. Create a safe, consistent snapshot of the SQLite database
        db.exec(`VACUUM INTO '${backupFilePath}'`);
        
        // 2. Read the binary backup file and convert to base64 string
        const dbBuffer = await fs.readFile(backupFilePath);
        const dbBase64 = dbBuffer.toString('base64');
        
        // 3. Client-Side Zero-Knowledge Encryption
        const encryptedPayload = encrypt(dbBase64);
        
        const encFilePath = `${backupFilePath}.enc`;
        await fs.writeFile(encFilePath, encryptedPayload);
        
        // 4. Cleanup the unencrypted SQLite file
        await fs.unlink(backupFilePath);
        
        // 5. Update settings to record the last backup time
        db.prepare(`
            INSERT INTO settings (key, value) 
            VALUES ('lastBackup', ?) 
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `).run(new Date().toISOString());

        console.log(`Successfully created and encrypted local backup: ${encFilePath}`);
        
        return NextResponse.json({ success: true, message: 'End of Day backup successfully created and encrypted locally.' });
    } catch (error: any) {
        console.error('Backup Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Failed to execute backup' }, { status: 500 });
    }
}
