import { cookies } from 'next/headers';
import db from './db';
import { sessions, users, staffRoles, permissions, subPermissions } from './schema';
import { eq, and, lt, sql } from 'drizzle-orm';
import crypto from 'crypto';

const SCRYPT_PARAMS = {
    keylen: 64,
    cost: 16384,
    blocksize: 8,
    parallelization: 1
};

export function hashPassword(password: string) {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = crypto.scryptSync(password, salt, SCRYPT_PARAMS.keylen, {
        cost: SCRYPT_PARAMS.cost,
        blockSize: SCRYPT_PARAMS.blocksize,
        parallelization: SCRYPT_PARAMS.parallelization
    });
    return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash: string) {
    // Legacy SHA-256 check
    if (!storedHash.startsWith('scrypt:')) {
        const legacyHash = crypto.createHash('sha256').update(password).digest('hex');
        return legacyHash === storedHash;
    }

    const [, salt, hash] = storedHash.split(':');
    const derivedKey = crypto.scryptSync(password, salt, SCRYPT_PARAMS.keylen, {
        cost: SCRYPT_PARAMS.cost,
        blockSize: SCRYPT_PARAMS.blocksize,
        parallelization: SCRYPT_PARAMS.parallelization
    });
    return derivedKey.toString('hex') === hash;
}

export async function getSession() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;

    if (!sessionId) return null;

    try {
        // Prune expired sessions to prevent table bloat
        try {
            await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
        } catch (e) {
            // Ignore if DB is locked
        }

        const result = await db
            .select({
                userId: sessions.userId,
                username: users.username,
                roleId: users.roleId,
                roleName: staffRoles.name,
                lastActive: sessions.lastActive,
            })
            .from(sessions)
            .innerJoin(users, eq(sessions.userId, users.id))
            .innerJoin(staffRoles, eq(users.roleId, staffRoles.id))
            .where(and(
                eq(sessions.id, sessionId),
                sql`${sessions.expiresAt} > NOW()`
            ))
            .limit(1);

        const session = result[0];
        if (!session) return null;

        // Bump last_active timestamp if it's been more than 1 minute to reduce write churn
        const lastActiveMs = session.lastActive ? new Date(session.lastActive).getTime() : 0;
        if (Date.now() - lastActiveMs > 60000) {
            try {
                await db.update(sessions)
                    .set({ lastActive: new Date() })
                    .where(eq(sessions.id, sessionId));
            } catch (e) {
                // Ignore errors during silent bumps
            }
        }

        return {
            user: {
                id: session.userId,
                username: session.username,
                role_id: session.roleId,
                role_name: session.roleName
            }
        };
    } catch (error) {
        return null;
    }
}

export async function getPermissions(roleId: number) {
    try {
        const result = await db.select().from(permissions).where(eq(permissions.roleId, roleId));
        return result.map(p => ({
            ...p,
            can_view: p.canView,
            can_edit: p.canEdit,
            can_delete: p.canDelete
        }));
    } catch (error) {
        return [];
    }
}

export async function checkPermission(module: string, action: 'can_view' | 'can_edit' | 'can_delete') {
    const session = await getSession();
    if (!session) return false;
    if (session.user.role_name === 'Admin') return true;
    if (!session.user.role_id) return false;

    try {
        const actionColumn = action === 'can_view' ? permissions.canView
            : action === 'can_edit' ? permissions.canEdit
            : permissions.canDelete;

        const result = await db
            .select({ allowed: actionColumn })
            .from(permissions)
            .where(and(
                eq(permissions.roleId, session.user.role_id),
                eq(permissions.module, module)
            ))
            .limit(1);

        return result[0]?.allowed === true;
    } catch (error) {
        return false;
    }
}

import { NextResponse } from 'next/server';

export async function requirePermission(module: string, action: 'can_view' | 'can_edit' | 'can_delete') {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (session.user.role_name === 'Admin') return null;

    const hasPerm = await checkPermission(module, action);
    if (!hasPerm) {
        return NextResponse.json({ error: `Forbidden: You do not have ${action.replace('can_', '')} permissions for ${module}` }, { status: 403 });
    }

    return null; // All good
}

export async function requireSubPermission(module: string, sub_module: string) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Admins have all sub-permissions
    if (session.user.role_name === 'Admin') return null;
    if (!session.user.role_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const result = await db
        .select({ allowed: subPermissions.allowed })
        .from(subPermissions)
        .where(and(
            eq(subPermissions.roleId, session.user.role_id),
            eq(subPermissions.module, module),
            eq(subPermissions.subModule, sub_module)
        ))
        .limit(1);

    const subPerm = result[0];
    if (!subPerm || !subPerm.allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return null;
}
