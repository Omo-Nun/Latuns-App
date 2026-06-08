import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePermission, getSession } from '@/lib/auth';
import { agents } from '@/lib/schema';
import { eq, asc } from 'drizzle-orm';
import { toSnakeCase } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const error = await requirePermission('People', 'can_view');
    if (error) return error;

    try {
        const { searchParams } = new URL(request.url);
        const role = searchParams.get('role');
        
        let query = db.select().from(agents).orderBy(asc(agents.name));
        
        if (role) {
            query = db.select().from(agents).where(eq(agents.role, role)).orderBy(asc(agents.name)) as any;
        }
        
        const result = await query;
        return NextResponse.json(toSnakeCase(result));
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

        const insertResult = await db.insert(agents).values({
            name,
            phone: phone || '',
            role: role || 'Roof Estimator',
            imageUrl: image_url || null,
        }).returning({ id: agents.id });

        return NextResponse.json({ id: insertResult[0].id }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to add staff' }, { status: 500 });
    }
}
