import { cookies } from 'next/headers';
import db from './db';
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
            db.prepare(`DELETE FROM sessions WHERE expires_at <= DATETIME('now')`).run();
        } catch (e) {
            // Ignore if DB is locked
        }

        const session = db.prepare(`
            SELECT s.*, u.username, u.role_id, r.name as role_name 
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            JOIN staff_roles r ON u.role_id = r.id
            WHERE s.id = ? AND s.expires_at > DATETIME('now')
        `).get(sessionId) as any;

        if (!session) return null;

        // Bump last_active timestamp if it's been more than 1 minute to reduce write locks
        const lastActiveMs = session.last_active ? new Date(session.last_active).getTime() : 0;
        if (Date.now() - lastActiveMs > 60000) {
            try {
                db.prepare(`UPDATE sessions SET last_active = DATETIME('now') WHERE id = ?`).run(sessionId);
            } catch (e) {
                // Ignore DB locks during silent bumps
            }
        }

        return {
            user: {
                id: session.user_id,
                username: session.username,
                role_id: session.role_id,
                role_name: session.role_name
            }
        };
    } catch (error) {
        return null;
    }
}

export async function getPermissions(roleId: number) {
    try {
        const permissions = db.prepare('SELECT * FROM permissions WHERE role_id = ?').all(roleId) as any[];
        return permissions;
    } catch (error) {
        return [];
    }
}

export async function checkPermission(module: string, action: 'can_view' | 'can_edit' | 'can_delete') {
    const session = await getSession();
    if (!session) return false;
    if (session.user.role_name === 'Admin') return true;

    try {
        const perm = db.prepare(`SELECT ${action} FROM permissions WHERE role_id = ? AND module = ?`)
            .get(session.user.role_id, module) as any;
        return perm && perm[action] === 1;
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

    const subPerm = db.prepare('SELECT allowed FROM sub_permissions WHERE role_id = ? AND module = ? AND sub_module = ?')
        .get(session.user.role_id, module, sub_module) as { allowed: number } | undefined;

    if (!subPerm || !subPerm.allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return null;
}

