import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { permissions, staffRoles } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';

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
        const result = await db.select().from(permissions).where(eq(permissions.roleId, Number(roleId)));
        return NextResponse.json(result.map(p => ({
            ...p,
            can_view: p.canView,
            can_edit: p.canEdit,
            can_delete: p.canDelete
        })));
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

        const { id: roleIdStr } = await params;
        const roleId = Number(roleIdStr);
        const data = await request.json();
        const { module } = data;

        // Fetch current permissions to support partial updates
        const currentRes = await db.select()
            .from(permissions)
            .where(and(eq(permissions.roleId, roleId), eq(permissions.module, module)))
            .limit(1);
        const current = currentRes[0];

        if (!current) {
            // If for some reason the row doesn't exist, create it
            await db.insert(permissions).values({
                roleId,
                module,
                canView: data.can_view !== undefined ? (data.can_view ? true : false) : false,
                canEdit: data.can_edit !== undefined ? (data.can_edit ? true : false) : false,
                canDelete: data.can_delete !== undefined ? (data.can_delete ? true : false) : false,
            });
        } else {
            const v = data.can_view !== undefined ? (data.can_view ? true : false) : current.canView;
            const e = data.can_edit !== undefined ? (data.can_edit ? true : false) : current.canEdit;
            const d = data.can_delete !== undefined ? (data.can_delete ? true : false) : current.canDelete;

            await db.update(permissions)
                .set({ canView: v, canEdit: e, canDelete: d })
                .where(and(eq(permissions.roleId, roleId), eq(permissions.module, module)));
        }

        // Audit Log
        const roleRes = await db.select({ name: staffRoles.name }).from(staffRoles).where(eq(staffRoles.id, roleId)).limit(1);
        const role = roleRes[0];
        await logAudit(session.user.id, session.user.username, 'Update', 'Settings', `Updated permissions for role: ${role?.name || roleId}, module: ${module}`, 'role_permissions', roleId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Permission update error:", error);
        return NextResponse.json({ error: 'Failed to update permissions' }, { status: 500 });
    }
}
