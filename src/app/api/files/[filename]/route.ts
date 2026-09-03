import { NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';
import { getSession } from '@/lib/auth';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ filename: string }> }
) {
    try {
        // 1. Check Authentication
        const session = await getSession();
        if (!session) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const { filename } = await params;
        
        // 2. Validate Filename & Prevent Path Traversal
        if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return new NextResponse('Invalid filename', { status: 400 });
        }

        // 3. Resolve the path to the persistent upload directory
        const uploadDir = path.join(process.cwd(), 'upload');
        const filepath = path.join(uploadDir, filename);

        // 4. Ensure the resolved path is actually inside the upload directory (double-check traversal)
        if (!filepath.startsWith(uploadDir)) {
            return new NextResponse('Forbidden path', { status: 403 });
        }

        // 5. Check if file exists
        try {
            await stat(filepath);
        } catch (e) {
            return new NextResponse('File not found', { status: 404 });
        }

        // 6. Serve the file
        const fileBuffer = await readFile(filepath);
        
        // Determine a basic content type from the extension
        const ext = path.extname(filename).toLowerCase();
        let contentType = 'application/octet-stream';
        
        if (['.png'].includes(ext)) contentType = 'image/png';
        else if (['.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
        else if (['.gif'].includes(ext)) contentType = 'image/gif';
        else if (['.webp'].includes(ext)) contentType = 'image/webp';
        else if (['.pdf'].includes(ext)) contentType = 'application/pdf';
        else if (['.csv'].includes(ext)) contentType = 'text/csv';
        else if (['.txt'].includes(ext)) contentType = 'text/plain';

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400, immutable'
            }
        });
    } catch (error) {
        console.error('File serving error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
