import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { tasks, notifications } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id: idStr } = await params;
        const id = Number(idStr);
        const data = await request.json();
        const { text, completed, alarm_time } = data;

        const currentTaskRes = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
        const currentTask = currentTaskRes[0];
        if (!currentTask) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        const updatedText = text !== undefined ? text : currentTask.text;
        const updatedCompleted = completed !== undefined ? !!completed : currentTask.completed;
        const updatedAlarmTime = alarm_time !== undefined ? (alarm_time ? new Date(alarm_time) : null) : currentTask.alarmTime;

        // Auto-archive when completing
        const archivedAt = updatedCompleted ? new Date() : null;

        await db.update(tasks).set({
            text: updatedText,
            completed: updatedCompleted,
            alarmTime: updatedAlarmTime,
            archivedAt: archivedAt
        }).where(eq(tasks.id, id));

        // Notify creator if someone else completes their task
        if (updatedCompleted && currentTask.createdBy && currentTask.createdBy !== session.user.id) {
            await db.insert(notifications).values({
                userId: currentTask.createdBy,
                type: 'task_completed',
                title: 'Task Completed',
                message: `${session.user.username} completed the task: ${updatedText}`,
                refType: 'task',
                refId: id
            });
        }

        // Audit Log
        if (updatedCompleted && !currentTask.completed) {
            await logAudit(session.user.id, session.user.username, 'Complete', 'Tasks', `Completed task: ${updatedText}`, 'task', id);
        } else {
            await logAudit(session.user.id, session.user.username, 'Update', 'Tasks', `Updated task: ${updatedText}`, 'task', id);
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

        const { id: idStr } = await params;
        const id = Number(idStr);

        const taskRes = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
        const task = taskRes[0];
        if (!task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        // Only the task creator or an Admin can delete
        if (session.user.role_name !== 'Admin' && task.createdBy !== session.user.id) {
            return NextResponse.json({ error: 'You can only delete tasks you created' }, { status: 403 });
        }

        await db.delete(tasks).where(eq(tasks.id, id));

        await logAudit(session.user.id, session.user.username, 'Delete', 'Tasks', `Deleted task: ${task.text}`, 'task', id);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
    }
}
