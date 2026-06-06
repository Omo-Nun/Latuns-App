import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: roleId } = await params;
        const session = await getSession();
        if (!session || (session.user.role_name !== 'Admin' && String(session.user.role_id) !== String(roleId))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }
        const subPermissions = db.prepare('SELECT * FROM sub_permissions WHERE role_id = ?').all(roleId);
        return NextResponse.json(subPermissions);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch sub-permissions' }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session || session.user.role_name !== 'Admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id: roleId } = await params;
        const data = await request.json();
        const { module, sub_module, allowed } = data;

        if (!module || !sub_module) {
            return NextResponse.json({ error: 'Module and Sub-module are required' }, { status: 400 });
        }

        const allowedVal = allowed ? 1 : 0;

        db.prepare(`
            UPDATE sub_permissions 
            SET allowed = ?
            WHERE role_id = ? AND module = ? AND sub_module = ?
        `).run(allowedVal, roleId, module, sub_module);

        // Audit Log
        const role = db.prepare('SELECT name FROM staff_roles WHERE id = ?').get(roleId) as { name: string };
        logAudit(
            session.user.id, 
            session.user.username, 
            'Update', 
            'Settings', 
            `Updated sub-permissions for role: ${role?.name || roleId}, module: ${module}, sub-module: ${sub_module} to ${allowed ? 'Allowed' : 'Blocked'}`, 
            'role_sub_permissions', 
            Number(roleId)
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Sub-permission update error:", error);
        return NextResponse.json({ error: 'Failed to update sub-permissions' }, { status: 500 });
    }
}
