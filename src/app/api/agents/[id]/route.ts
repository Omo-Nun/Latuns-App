import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePermission, getSession } from '@/lib/auth';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const error = await requirePermission('People', 'can_view');
    if (error) return error;

    try {
        const { id } = await params;
        const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
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
            const existingAgent = db.prepare('SELECT role FROM agents WHERE id = ?').get(id) as any;
            if (existingAgent && existingAgent.role === 'Admin') {
                return NextResponse.json({ error: 'Non-admins cannot modify an Admin staff' }, { status: 403 });
            }
        }

        const stmt = db.prepare('UPDATE agents SET name = ?, phone = ?, role = ?, image_url = ? WHERE id = ?');
        stmt.run(name, phone || '', role || 'Roof Estimator', image_url || null, id);

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
            const existingAgent = db.prepare('SELECT role FROM agents WHERE id = ?').get(id) as any;
            if (existingAgent && existingAgent.role === 'Admin') {
                return NextResponse.json({ error: 'Non-admins cannot delete an Admin staff' }, { status: 403 });
            }
        }

        const stmt = db.prepare('DELETE FROM agents WHERE id = ?');
        stmt.run(id);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 });
    }
}
