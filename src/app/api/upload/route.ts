import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        // 1. Authentication Check
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // 2. Path Traversal Protection
        // Remove spaces, remove invalid characters, and ensure only the basename is used.
        const originalBasename = path.basename(file.name);
        const safeName = originalBasename.replace(/[^a-zA-Z0-9.-]/g, '-');
        const filename = `${Date.now()}-${safeName}`;
        
        // 3. Volume Persistence
        // Write to the persistent 'upload' directory at the root, which is synced by Syncthing.
        const uploadDir = path.join(process.cwd(), 'upload');
        await mkdir(uploadDir, { recursive: true });
        const filepath = path.join(uploadDir, filename);

        await writeFile(filepath, buffer);

        // 4. Return new file-serving route URL
        return NextResponse.json({ url: `/api/files/${filename}` });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }
}
