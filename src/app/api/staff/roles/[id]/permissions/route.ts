import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session || session.user.role_name !== 'Admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id: roleId } = await params;
        const permissions = db.prepare('SELECT * FROM permissions WHERE role_id = ?').all(roleId);
        return NextResponse.json(permissions);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 });
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
        const { module } = data;

        // Fetch current permissions to support partial updates
        const current = db.prepare('SELECT * FROM permissions WHERE role_id = ? AND module = ?')
            .get(roleId, module) as any;

        if (!current) {
            // If for some reason the row doesn't exist, create it
            db.prepare(`
                INSERT INTO permissions (role_id, module, can_view, can_edit, can_delete)
                VALUES (?, ?, ?, ?, ?)
            `).run(
                roleId, 
                module, 
                data.can_view !== undefined ? (data.can_view ? 1 : 0) : 0,
                data.can_edit !== undefined ? (data.can_edit ? 1 : 0) : 0,
                data.can_delete !== undefined ? (data.can_delete ? 1 : 0) : 0
            );
        } else {
            const v = data.can_view !== undefined ? (data.can_view ? 1 : 0) : current.can_view;
            const e = data.can_edit !== undefined ? (data.can_edit ? 1 : 0) : current.can_edit;
            const d = data.can_delete !== undefined ? (data.can_delete ? 1 : 0) : current.can_delete;

            db.prepare(`
                UPDATE permissions 
                SET can_view = ?, can_edit = ?, can_delete = ?
                WHERE role_id = ? AND module = ?
            `).run(v, e, d, roleId, module);
        }

        // Audit Log
        const role = db.prepare('SELECT name FROM staff_roles WHERE id = ?').get(roleId) as { name: string };
        logAudit(session.user.id, session.user.username, 'Update', 'Settings', `Updated permissions for role: ${role?.name || roleId}, module: ${module}`, 'role_permissions', Number(roleId));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Permission update error:", error);
        return NextResponse.json({ error: 'Failed to update permissions' }, { status: 500 });
    }
}
