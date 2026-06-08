import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePermission, getSession } from '@/lib/auth';
import { agents } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const error = await requirePermission('People', 'can_view');
    if (error) return error;

    try {
        const { id } = await params;
        const result = await db.select().from(agents).where(eq(agents.id, Number(id))).limit(1);
        const agent = result[0];
        if (!agent) {
            return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
        }
        return NextResponse.json(agent);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch staff details' }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const error = await requirePermission('People', 'can_edit');
    if (error) return error;

    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id } = await params;
        const data = await request.json();
        const { name, phone, role, image_url } = data;

        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        if (session.user.role_name !== 'Admin') {
            if (role === 'Admin') {
                return NextResponse.json({ error: 'Non-admins cannot assign the Admin role' }, { status: 403 });
            }
            const existingAgentRes = await db.select({ role: agents.role }).from(agents).where(eq(agents.id, Number(id))).limit(1);
            const existingAgent = existingAgentRes[0];
            if (existingAgent && existingAgent.role === 'Admin') {
                return NextResponse.json({ error: 'Non-admins cannot modify an Admin staff' }, { status: 403 });
            }
        }

        await db.update(agents).set({
            name,
            phone: phone || '',
            role: role || 'Roof Estimator',
            imageUrl: image_url || null,
        }).where(eq(agents.id, Number(id)));

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update staff' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const error = await requirePermission('People', 'can_delete');
    if (error) return error;

    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id } = await params;
        
        if (session.user.role_name !== 'Admin') {
            const existingAgentRes = await db.select({ role: agents.role }).from(agents).where(eq(agents.id, Number(id))).limit(1);
            const existingAgent = existingAgentRes[0];
            if (existingAgent && existingAgent.role === 'Admin') {
                return NextResponse.json({ error: 'Non-admins cannot delete an Admin staff' }, { status: 403 });
            }
        }

        await db.delete(agents).where(eq(agents.id, Number(id)));

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 });
    }
}
