import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { staffRoles } from '@/lib/schema';
import { asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const roles = await db.select().from(staffRoles).orderBy(asc(staffRoles.name));
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

        const insertResult = await db.insert(staffRoles).values({ name }).returning({ id: staffRoles.id });

        return NextResponse.json({ id: insertResult[0].id, name }, { status: 201 });
    } catch (error: any) {
        if (error.message?.includes('unique constraint') || error.message?.includes('duplicate key')) {
            return NextResponse.json({ error: 'Role already exists' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to add role' }, { status: 500 });
    }
}
