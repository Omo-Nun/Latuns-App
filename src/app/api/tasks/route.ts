import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const url = new URL(request.url);
        const archived = url.searchParams.get('archived');
        const assignedToMe = url.searchParams.get('mine');

        // Auto-cleanup tasks archived > 7 days ago
        db.exec("DELETE FROM tasks WHERE archived_at IS NOT NULL AND archived_at <= datetime('now', '-7 days')");

        let query = `
            SELECT t.*, u.username as assignee_name, creator.username as creator_name,
            q.quote_number, c.name as client_name
            FROM tasks t
            LEFT JOIN users u ON t.assigned_to = u.id
            LEFT JOIN users creator ON t.created_by = creator.id
            LEFT JOIN quotations q ON t.quotation_id = q.id
            LEFT JOIN clients c ON t.client_id = c.id
            WHERE 1=1
        `;
        const params: any[] = [];

        if (archived === 'true') {
            query += " AND t.archived_at IS NOT NULL";
        } else {
            query += " AND t.archived_at IS NULL";
        }

        const qId = url.searchParams.get('quotation_id');
        if (qId) {
            query += " AND t.quotation_id = ?";
            params.push(Number(qId));
        }

        const cId = url.searchParams.get('client_id');
        if (cId) {
            query += " AND t.client_id = ?";
            params.push(Number(cId));
        }

        if (assignedToMe === 'true') {
            query += " AND t.assigned_to = ?";
            params.push(session.user.id);
        } else if (session.user.role_name !== 'Admin') {
            // Non-admins only see tasks assigned to them or created by them
            query += " AND (t.assigned_to = ? OR t.created_by = ?)";
            params.push(session.user.id, session.user.id);
        }

        query += " ORDER BY t.created_at DESC";

        const tasks = db.prepare(query).all(...params);
        return NextResponse.json(tasks);
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

        const stmt = db.prepare(`
            INSERT INTO tasks (text, completed, alarm_time, assigned_to, created_by, status, priority, quotation_id, client_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const info = stmt.run(
            text, 
            0, 
            alarm_time || null, 
            assigned_to || session.user.id, 
            session.user.id, 
            'pending', 
            priority || 'medium',
            quotation_id || null,
            client_id || null
        );

        const taskId = Number(info.lastInsertRowid);
        logAudit(session.user.id, session.user.username, 'Create', 'Tasks', `Created task: ${text}`, 'task', taskId);

        return NextResponse.json({ id: taskId }, { status: 201 });
    } catch (error) {
        console.error('Add task error:', error);
        return NextResponse.json({ error: 'Failed to add task' }, { status: 500 });
    }
}
