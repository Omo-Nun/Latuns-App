import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePermission, getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const error = await requirePermission('People', 'can_view');
    if (error) return error;

    try {
        const { searchParams } = new URL(request.url);
        const role = searchParams.get('role');
        
        let query = 'SELECT * FROM agents';
        let params: any[] = [];
        
        if (role) {
            query += ' WHERE role = ?';
            params.push(role);
        }
        
        query += ' ORDER BY name ASC';
        
        const agents = db.prepare(query).all(...params);
        return NextResponse.json(agents);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const error = await requirePermission('People', 'can_edit');
    if (error) return error;

    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const data = await request.json();
        const { name, phone, role, image_url } = data;

        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        if (session.user.role_name !== 'Admin' && role === 'Admin') {
            return NextResponse.json({ error: 'Non-admins cannot create Admin staff' }, { status: 403 });
        }

        const stmt = db.prepare('INSERT INTO agents (name, phone, role, image_url) VALUES (?, ?, ?, ?)');
        const info = stmt.run(name, phone || '', role || 'Roof Estimator', image_url || null);

        return NextResponse.json({ id: info.lastInsertRowid }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to add staff' }, { status: 500 });
    }
}
