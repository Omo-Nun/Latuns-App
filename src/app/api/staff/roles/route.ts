import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const roles = db.prepare('SELECT * FROM staff_roles ORDER BY name ASC').all();
        return NextResponse.json(roles);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { name } = await request.json();

        if (!name) {
            return NextResponse.json({ error: 'Role name is required' }, { status: 400 });
        }

        const stmt = db.prepare('INSERT INTO staff_roles (name) VALUES (?)');
        const info = stmt.run(name);

        return NextResponse.json({ id: info.lastInsertRowid, name }, { status: 201 });
    } catch (error: any) {
        if (error.message?.includes('UNIQUE constraint failed')) {
            return NextResponse.json({ error: 'Role already exists' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to add role' }, { status: 500 });
    }
}
