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

        const numericRoleId = Number(roleId);

        // Standard sub-permissions that should exist for every role
        const standardSubs: { module: string; subModule: string }[] = [
            { module: 'Settings', subModule: 'General' },
            { module: 'Settings', subModule: 'Staff' },
            { module: 'Settings', subModule: 'Node Management' },
            { module: 'People', subModule: 'Clients' },
            { module: 'People', subModule: 'Staff' },
            { module: 'Inventory', subModule: 'Items' },
            { module: 'Inventory', subModule: 'Assets' },
            { module: 'Inventory', subModule: 'Requests' },
            { module: 'Finances', subModule: 'Revenue' },
            { module: 'Finances', subModule: 'Expenses' },
        ];

        // Fetch existing sub-permissions
        const existing = await db.select().from(subPermissions).where(eq(subPermissions.roleId, numericRoleId));

        // Auto-seed any missing standard sub-permissions
        for (const std of standardSubs) {
            const exists = existing.some(e => e.module === std.module && e.subModule === std.subModule);
            if (!exists) {
                try {
                    await db.insert(subPermissions).values({
                        roleId: numericRoleId,
                        module: std.module,
                        subModule: std.subModule,
                        allowed: false,
                    });
                } catch { /* ignore duplicate key errors */ }
            }
        }

        // Re-fetch after seeding
        const result = await db.select().from(subPermissions).where(eq(subPermissions.roleId, numericRoleId));
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

        // Try to update existing row
        const updateResult = await db.update(subPermissions)
            .set({ allowed: allowedVal })
            .where(and(
                eq(subPermissions.roleId, roleId),
                eq(subPermissions.module, module),
                eq(subPermissions.subModule, sub_module)
            ))
            .returning();

        // If no row existed, insert a new one
        if (updateResult.length === 0) {
            await db.insert(subPermissions).values({
                roleId,
                module,
                subModule: sub_module,
                allowed: allowedVal,
            });
        }

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
