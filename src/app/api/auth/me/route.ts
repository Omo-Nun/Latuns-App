import { NextResponse } from 'next/server';
import { getSession, getPermissions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await getSession();

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const permissions = session.user.role_id ? await getPermissions(session.user.role_id) : [];

    return NextResponse.json({
        user: session.user,
        permissions: permissions
    });
}
