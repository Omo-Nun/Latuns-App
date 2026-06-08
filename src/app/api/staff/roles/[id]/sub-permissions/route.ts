import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { subPermissions, staffRoles } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';

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
        const result = await db.select().from(subPermissions).where(eq(subPermissions.roleId, Number(roleId)));
        return NextResponse.json(result.map(p => ({
            ...p,
            sub_module: p.subModule
        })));
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

        const { id: roleIdStr } = await params;
        const roleId = Number(roleIdStr);
        const data = await request.json();
        const { module, sub_module, allowed } = data;

        if (!module || !sub_module) {
            return NextResponse.json({ error: 'Module and Sub-module are required' }, { status: 400 });
        }

        const allowedVal = allowed ? true : false;

        await db.update(subPermissions)
            .set({ allowed: allowedVal })
            .where(and(
                eq(subPermissions.roleId, roleId),
                eq(subPermissions.module, module),
                eq(subPermissions.subModule, sub_module)
            ));

        // Audit Log
        const roleRes = await db.select({ name: staffRoles.name }).from(staffRoles).where(eq(staffRoles.id, roleId)).limit(1);
        const role = roleRes[0];
        
        await logAudit(
            session.user.id, 
            session.user.username, 
            'Update', 
            'Settings', 
            `Updated sub-permissions for role: ${role?.name || roleId}, module: ${module}, sub-module: ${sub_module} to ${allowed ? 'Allowed' : 'Blocked'}`, 
            'role_sub_permissions', 
            roleId
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Sub-permission update error:", error);
        return NextResponse.json({ error: 'Failed to update sub-permissions' }, { status: 500 });
    }
}
