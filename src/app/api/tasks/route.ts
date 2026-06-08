import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession, requirePermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { tasks } from '@/lib/schema';
import { sql, desc } from 'drizzle-orm';
import { toSnakeCase } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const canView = await requirePermission('Tasks', 'can_view');
        if (canView) return canView;
        const url = new URL(request.url);
        const archived = url.searchParams.get('archived');
        const assignedToMe = url.searchParams.get('mine');

        // Auto-cleanup tasks archived > 7 days ago
        await db.execute(sql`DELETE FROM tasks WHERE archived_at IS NOT NULL AND archived_at <= current_timestamp - interval '7 days'`);

        // Build dynamic conditions using Drizzle's sql tagged template for safe parameterization
        const conditions: ReturnType<typeof sql>[] = [];

        if (archived === 'true') {
            conditions.push(sql`t.archived_at IS NOT NULL`);
        } else {
            conditions.push(sql`t.archived_at IS NULL`);
        }

        const qId = url.searchParams.get('quotation_id');
        if (qId) {
            conditions.push(sql`t.quotation_id = ${Number(qId)}`);
        }

        const cId = url.searchParams.get('client_id');
        if (cId) {
            conditions.push(sql`t.client_id = ${Number(cId)}`);
        }

        if (assignedToMe === 'true') {
            conditions.push(sql`t.assigned_to = ${session.user.id}`);
        } else if (session.user.role_name !== 'Admin') {
            conditions.push(sql`(t.assigned_to = ${session.user.id} OR t.created_by = ${session.user.id})`);
        }

        const whereClause = conditions.length > 0 ? sql.join(conditions, sql` AND `) : sql`1=1`;

        const tasksRes = await db.execute(sql`
            SELECT t.*, u.username as assignee_name, creator.username as creator_name,
            q.quote_number, c.name as client_name
            FROM tasks t
            LEFT JOIN users u ON t.assigned_to = u.id
            LEFT JOIN users creator ON t.created_by = creator.id
            LEFT JOIN quotations q ON t.quotation_id = q.id
            LEFT JOIN clients c ON t.client_id = c.id
            WHERE ${whereClause}
            ORDER BY t.created_at DESC
        `);

        return NextResponse.json(tasksRes.rows);
    } catch (error) {
        console.error('Fetch tasks error:', error);
        return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const data = await request.json();
        const { text, alarm_time, assigned_to, priority, quotation_id, client_id } = data;

        if (!text) {
            return NextResponse.json({ error: 'Task text is required' }, { status: 400 });
        }

        const insertRes = await db.insert(tasks).values({
            text,
            completed: false,
            alarmTime: alarm_time ? new Date(alarm_time) : null,
            assignedTo: assigned_to || session.user.id,
            createdBy: session.user.id,
            status: 'pending',
            priority: priority || 'medium',
            quotationId: quotation_id || null,
            clientId: client_id || null
        }).returning({ id: tasks.id });

        const taskId = insertRes[0].id;
        await logAudit(session.user.id, session.user.username, 'Create', 'Tasks', `Created task: ${text}`, 'task', taskId);

        return NextResponse.json({ id: taskId }, { status: 201 });
    } catch (error) {
        console.error('Add task error:', error);
        return NextResponse.json({ error: 'Failed to add task' }, { status: 500 });
    }
}
