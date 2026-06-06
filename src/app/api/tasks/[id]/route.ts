import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id } = await params;
        const data = await request.json();
        const { text, completed, alarm_time } = data;

        const currentTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
        if (!currentTask) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        const updatedText = text !== undefined ? text : currentTask.text;
        const updatedCompleted = completed !== undefined ? (completed ? 1 : 0) : currentTask.completed;
        const updatedAlarmTime = alarm_time !== undefined ? alarm_time : currentTask.alarm_time;

        // Auto-archive when completing
        const archived_at = updatedCompleted === 1 ? new Date().toISOString() : null;

        const stmt = db.prepare('UPDATE tasks SET text = ?, completed = ?, alarm_time = ?, archived_at = ? WHERE id = ?');
        stmt.run(updatedText, updatedCompleted, updatedAlarmTime, archived_at, id);

        // Notify creator if someone else completes their task
        if (updatedCompleted === 1 && currentTask.created_by && currentTask.created_by !== session.user.id) {
            db.prepare(`
                INSERT INTO notifications (user_id, type, title, message, ref_type, ref_id)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(
                currentTask.created_by,
                'task_completed',
                'Task Completed',
                `${session.user.username} completed the task: ${updatedText}`,
                'task',
                id
            );
        }

        // Audit Log
        if (updatedCompleted === 1 && currentTask.completed === 0) {
            logAudit(session.user.id, session.user.username, 'Complete', 'Tasks', `Completed task: ${updatedText}`, 'task', Number(id));
        } else {
            logAudit(session.user.id, session.user.username, 'Update', 'Tasks', `Updated task: ${updatedText}`, 'task', Number(id));
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id } = await params;

        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
        if (!task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        // Only the task creator or an Admin can delete
        if (session.user.role_name !== 'Admin' && task.created_by !== session.user.id) {
            return NextResponse.json({ error: 'You can only delete tasks you created' }, { status: 403 });
        }

        const stmt = db.prepare('DELETE FROM tasks WHERE id = ?');
        stmt.run(id);

        logAudit(session.user.id, session.user.username, 'Delete', 'Tasks', `Deleted task: ${task.text}`, 'task', Number(id));

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
    }
}
