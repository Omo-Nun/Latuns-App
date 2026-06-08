import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '@/lib/db';
import { logAudit } from '@/lib/audit';
import crypto from 'crypto';
import { hashPassword, verifyPassword } from '@/lib/auth';

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

        if (password.length < 8) {
            return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
        }

        const trimmedUsername = username.trim();
        const trimmedPassword = password.trim();

        const user = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(trimmedUsername) as any;

        if (!user || !verifyPassword(trimmedPassword, user.password_hash)) {
            return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
        }
        
        // Reset rate limit on success
        rateLimit.delete(ip);

        // Upgrade hash if it's legacy
        if (!user.password_hash.startsWith('scrypt:')) {
            const newHash = hashPassword(password);
            db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id);
        }

        // Create session
        const sessionId = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
        const userAgent = request.headers.get('user-agent') || 'Unknown';
        const now = new Date().toISOString();

        db.prepare('INSERT INTO sessions (id, user_id, expires_at, ip_address, user_agent, last_active) VALUES (?, ?, ?, ?, ?, ?)')
            .run(sessionId, user.id, expiresAt, ip, userAgent, now);

        // Set cookie
        const cookieStore = await cookies();
        cookieStore.set('session_id', sessionId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production' && request.url.startsWith('https://'),
            sameSite: 'lax',
            path: '/',
            maxAge: 7 * 24 * 60 * 60, // 7 days
        });

        // Audit log
        logAudit(user.id, user.username, 'Login', 'Auth', 'User logged in successfully');

        return NextResponse.json({ success: true, user: { id: user.id, username: user.username, role_id: user.role_id } });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
