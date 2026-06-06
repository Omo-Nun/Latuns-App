"use client";
import { CheckSquare } from "lucide-react";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Search, CheckCircle, Clock, AlertCircle, User as UserIcon, Trash2, Calendar, Filter, ChevronDown, Check, FileText } from "lucide-react";
import { format } from "date-fns";

type Task = {
    id: number;
    text: string;
    completed: boolean;
    alarm_time: string | null;
    assigned_to: number | null;
    assignee_name: string | null;
    created_by: number;
    creator_name: string;
    priority: 'low' | 'medium' | 'high';
    status: string;
    created_at: string;
};

type User = {
    id: number;
    username: string;
    role_name: string;
};

export default function TasksPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Filter states
    const [filter, setFilter] = useState('active');
    const [search, setSearch] = useState('');
    const [selectedAssignee, setSelectedAssignee] = useState<number | 'all'>('all');

    // New Task states
    const [isAdding, setIsAdding] = useState(false);
    const [newTask, setNewTask] = useState({
        text: '',
        assigned_to: null as number | null,
        priority: 'medium' as 'low' | 'medium' | 'high',
        alarm_time: ''
    });

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [tasksRes, usersRes, meRes] = await Promise.all([
                fetch('/api/tasks'),
                fetch('/api/users'),
                fetch('/api/auth/me')
            ]);

            if (tasksRes.ok) setTasks(await tasksRes.json());
            if (usersRes.ok) setUsers(await usersRes.json());
            if (meRes.ok) {
                const meData = await meRes.json();
                setCurrentUser(meData.user);
            }
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTask.text.trim()) return;

        try {
            const res = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newTask,
                    assigned_to: newTask.assigned_to || currentUser?.id
                })
            });

            if (res.ok) {
                setNewTask({ text: '', assigned_to: null, priority: 'medium', alarm_time: '' });
                setIsAdding(false);
                fetchTasks();
            }
        } catch (error) {
            alert("Failed to add task");
        }
    };

    const fetchTasks = async () => {
        const res = await fetch(`/api/tasks?archived=${filter === 'archived'}`);
        if (res.ok) setTasks(await res.json());
    };

    const toggleTask = async (id: number, completed: boolean) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !completed } : t));
        
        await fetch(`/api/tasks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: !completed })
        });
        
        if (filter !== 'archived') {
            // Re-fetch to handle auto-archiving if implemented on backend
            setTimeout(fetchTasks, 500);
        }
    };

    const deleteTask = async (id: number) => {
        if (!confirm("Are you sure?")) return;
        setTasks(prev => prev.filter(t => t.id !== id));
        await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    };

    const filteredTasks = tasks.filter(t => {
        const matchesSearch = t.text.toLowerCase().includes(search.toLowerCase());
        const matchesAssignee = selectedAssignee === 'all' || t.assigned_to === selectedAssignee;
        return matchesSearch && matchesAssignee;
    });

    const getPriorityColor = (p: string) => {
        switch (p) {
            case 'high': return 'var(--danger)';
            case 'medium': return 'var(--warning)';
            case 'low': return 'var(--primary)';
            default: return 'var(--text-muted)';
        }
    };

    return (
        <div>
            <div className="page-header">
                <div className="page-header-title-container">
                    <div className="page-header-icon bg-indigo-500">
                        <CheckSquare size={24} />
                    </div>
                    <div>
                        <h1 className="page-title">Tasks & Delegation</h1>
                        <p className="page-description">Manage work assignments and track progress across the team</p>
                    </div>
                </div>
                <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
                    <Plus size={16} /> New Task
                </button>
            </div>

            <div className="card mb-6 p-4 flex justify-between items-center gap-4 flex-wrap">
                <div className="search-wrapper max-w-[400px] flex-1">
                    <div className="search-icon">
                        <Search size={18} />
                    </div>
                    <input 
                        type="text" 
                        className="form-control search-input" 
                        placeholder="Search tasks..." 
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex gap-3 items-center">
                    <select 
                        className="form-control w-[200px]"
                        value={selectedAssignee as any}
                        onChange={e => setSelectedAssignee(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    >
                        <option value="all">All Assignees</option>
                        {users.map(u => (
                            <option key={u.id} value={u.id}>{u.username} ({u.role_name})</option>
                        ))}
                    </select>

                    <div className="flex bg-[var(--sidebar-hover)] rounded-[var(--radius-lg)] p-1 border border-[var(--border)] shadow-inner">
                        <button 
                            onClick={() => { setFilter('active'); fetchTasks(); }}
                            className={`px-4 py-1.5 rounded-md text-[13px] cursor-pointer border-none transition-all ${filter === 'active' ? 'bg-[var(--bg-color-alt)] text-primary font-bold shadow-sm' : 'bg-transparent text-muted font-medium shadow-none hover:text-[var(--text-main)]'}`}
                        >
                            Active
                        </button>
                        <button 
                            onClick={() => { setFilter('archived'); fetchTasks(); }}
                            className={`px-4 py-1.5 rounded-md text-[13px] cursor-pointer border-none transition-all ${filter === 'archived' ? 'bg-[var(--bg-color-alt)] text-primary font-bold shadow-sm' : 'bg-transparent text-muted font-medium shadow-none hover:text-[var(--text-main)]'}`}
                        >
                            Archived
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="text-center p-14 text-muted">Loading tasks...</div>
            ) : filteredTasks.length === 0 ? (
                <div className="card text-center p-14 text-muted">
                    No tasks found matching your filters.
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {filteredTasks.map(task => (
                        <div key={task.id} className="card p-4 flex items-center gap-4" style={{ 
                            borderLeft: `4px solid ${getPriorityColor(task.priority)}`
                        }}>
                            <div 
                                onClick={() => toggleTask(task.id, task.completed)}
                                className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer shrink-0 text-white"
                                style={{ 
                                    border: `2px solid ${task.completed ? 'var(--primary)' : 'var(--border)'}`,
                                    backgroundColor: task.completed ? 'var(--primary)' : 'transparent',
                                }}
                            >
                                {task.completed && <Check size={14} strokeWidth={3} />}
                            </div>

                            <div className="flex-1">
                                <div style={{ 
                                    fontSize: '16px', 
                                    fontWeight: 500, 
                                    color: task.completed ? 'var(--text-muted)' : 'var(--text-main)',
                                    textDecoration: task.completed ? 'line-through' : 'none'
                                }}>
                                    {task.text}
                                </div>
                                <div className="flex gap-4 mt-2 flex-wrap">
                                    <div className="flex items-center gap-1 text-xs text-muted">
                                        <UserIcon size={14} /> 
                                        Assigned to: <span className="font-semibold">{task.assignee_name || 'Unassigned'}</span>
                                    </div>
                                    {task.alarm_time && (
                                        <div className="flex items-center gap-1 text-xs text-accent">
                                            <Clock size={14} /> 
                                            Due: {format(new Date(task.alarm_time), 'PP p')}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1 text-xs text-muted">
                                        <AlertCircle size={14} className="text-primary" />
                                        Priority: <span className="capitalize">{task.priority}</span>
                                    </div>

                                    {(task as any).quote_number && (
                                        <Link href={`/quotations/${(task as any).quotation_id}`} className="no-underline">
                                            <div className="flex items-center gap-1 text-xs text-primary font-semibold">
                                                <FileText size={14} /> 
                                                Quote: {(task as any).quote_number}
                                            </div>
                                        </Link>
                                    )}

                                    {(task as any).client_name && !(task as any).quote_number && (
                                        <Link href={`/people/clients/${(task as any).client_id}`} className="no-underline">
                                            <div className="flex items-center gap-1 text-xs text-primary font-semibold">
                                                <UserIcon size={14} /> 
                                                Client: {(task as any).client_name}
                                            </div>
                                        </Link>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-2">
                                {(currentUser?.role_name === 'Admin' || task.created_by === currentUser?.id) && (
                                    <button className="btn btn-outline p-2 text-danger" onClick={() => deleteTask(task.id)}>
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Task Modal */}
            {isAdding && (
                <div className="modal-overlay" onClick={() => setIsAdding(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <form onSubmit={handleAddTask}>
                            <div className="modal-header">
                                <div className="modal-title">Create New Task</div>
                            </div>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Task Description</label>
                                    <textarea 
                                        className="form-control" 
                                        rows={3} 
                                        placeholder="What needs to be done?"
                                        value={newTask.text}
                                        onChange={e => setNewTask({...newTask, text: e.target.value})}
                                        required
                                        autoFocus
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="form-group">
                                        <label className="form-label">Assign To</label>
                                        <select 
                                            className="form-control"
                                            value={newTask.assigned_to || ''}
                                            onChange={e => setNewTask({...newTask, assigned_to: e.target.value ? Number(e.target.value) : null})}
                                        >
                                            <option value="">Assign to Me</option>
                                            {users.map(u => (
                                                <option key={u.id} value={u.id}>{u.username}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Priority</label>
                                        <select 
                                            className="form-control"
                                            value={newTask.priority}
                                            onChange={e => setNewTask({...newTask, priority: e.target.value as any})}
                                        >
                                            <option value="low">Low</option>
                                            <option value="medium">Medium</option>
                                            <option value="high">High</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Due Date & Time (Optional)</label>
                                    <input 
                                        type="datetime-local" 
                                        className="form-control"
                                        value={newTask.alarm_time}
                                        onChange={e => setNewTask({...newTask, alarm_time: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setIsAdding(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Create Task</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
