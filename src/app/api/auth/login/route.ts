import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '@/lib/db';
import { users, sessions } from '@/lib/schema';
import { logAudit } from '@/lib/audit';
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { hashPassword, verifyPassword, createStatelessSessionToken } from '@/lib/auth';

const rateLimit = new Map<string, { count: number, resetTime: number }>();

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const limit = rateLimit.get(ip);
    if (limit && limit.resetTime > now) {
        if (limit.count >= 5) return false;
        limit.count++;
    } else {
        rateLimit.set(ip, { count: 1, resetTime: now + 15 * 60 * 1000 });
    }
    return true;
}

export async function POST(request: Request) {
    try {
        const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
        
        if (!checkRateLimit(ip)) {
            return NextResponse.json({ error: 'Too many failed login attempts. Please try again in 15 minutes.' }, { status: 429 });
        }

        const { username, password } = await request.json();

        if (!username || !password) {
            return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
        }

        if (password.length < 4) {
            return NextResponse.json({ error: 'Password must be at least 4 characters long' }, { status: 400 });
        }

        const trimmedUsername = username.trim();
        const trimmedPassword = password.trim();

        const result = await db.select().from(users)
            .where(sql`LOWER(${users.username}) = LOWER(${trimmedUsername})`)
            .limit(1);
        const user = result[0];

        if (!user || !verifyPassword(trimmedPassword, user.passwordHash)) {
            return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
        }
        
        // Reset rate limit on success
        rateLimit.delete(ip);

        // Upgrade hash if it's legacy (ignore error if DB is in read-only standby mode)
        if (!user.passwordHash.startsWith('scrypt:')) {
            try {
                const newHash = hashPassword(password);
                await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));
            } catch (e) {
                // Ignore hash upgrade failure on standby nodes
            }
        }

        // Create session
        let finalSessionId: string;
        const cookieStore = await cookies();

        try {
            const sessionId = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
            const userAgent = request.headers.get('user-agent') || 'Unknown';
            const now = new Date();

            await db.insert(sessions).values({
                id: sessionId,
                userId: user.id,
                expiresAt,
                ipAddress: ip,
                userAgent,
                lastActive: now,
            });

            try {
                await logAudit(user.id, user.username, 'Login', 'Auth', 'User logged in successfully');
            } catch (e) {
                // Ignore audit log error if DB write fails
            }

            finalSessionId = sessionId;
        } catch (dbWriteError: any) {
            console.warn('DB session write failed (Standby Read-Only mode detected). Falling back to stateless encrypted session cookie.', dbWriteError.message);
            finalSessionId = createStatelessSessionToken({
                id: user.id,
                username: user.username,
                role_id: user.roleId,
                role_name: user.roleId === 1 ? 'Admin' : 'Staff'
            });
        }

        // Set cookie
        cookieStore.set('session_id', finalSessionId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production' && request.url.startsWith('https://'),
            sameSite: 'lax',
            path: '/',
            maxAge: 7 * 24 * 60 * 60, // 7 days
        });

        return NextResponse.json({ success: true, user: { id: user.id, username: user.username, role_id: user.roleId } });
    } catch (error: any) {
        console.error('Login error:', error);
        
        // Provide a clearer error message for database connection issues
        if (error.cause?.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
            return NextResponse.json({ error: 'Database connection failed. Ensure the database is running.' }, { status: 500 });
        }
        
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}
