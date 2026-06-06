"use client";
import { LayoutDashboard } from "lucide-react";

import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, Package, Calendar, Users, Briefcase, FileText,
  TrendingUp, ArrowRight, ChevronLeft, ChevronRight,
  AlertTriangle, Trash2, MoreVertical, CalendarDays
} from "lucide-react";

export default function Dashboard() {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [currentTime, setCurrentTime] = useState(new Date());

  const [data, setData] = useState<any>({
    quoteCount: 0,
    invCount: 0,
    todayQuotes: 0,
    yesterdayQuotes: 0,
    todayVisited: 0,
    yesterdayVisited: 0,
    totalVisited: 0,
    totalNotVisited: 0,
    totalSent: 0,
    lowStockItems: [],
    rejectedStockRequests: [],
  });
  const [loading, setLoading] = useState(true);

  // Stock alert cycling
  const [alertIndex, setAlertIndex] = useState(0);
  const [liveTileInterval, setLiveTileInterval] = useState(3000);

  // Tasks state
  const [tasks, setTasks] = useState<any[]>([]);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("medium");
  const [showArchivedTasks, setShowArchivedTasks] = useState(false);
  const [glowArchive, setGlowArchive] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Data fetch
  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard?filter=${filter}`)
      .then(res => res.json())
      .then(resData => {
        setData(resData);
        setLoading(false);
        setAlertIndex(0);
      });

    fetch('/api/settings').then(res => res.json()).then(settings => {
      if (settings.liveTileInterval) {
        setLiveTileInterval(parseInt(settings.liveTileInterval, 10));
      }
    }).catch(() => {});

    fetch('/api/auth/me').then(res => res.json()).then(data => {
      if (data.user) setCurrentUser(data.user);
    }).catch(() => {});
  }, [filter]);

  // Auto-cycle stock alerts
  useEffect(() => {
    if (!data.lowStockItems?.length) return;
    const timer = setInterval(() => {
      setAlertIndex(prev => (prev + 1) % data.lowStockItems.length);
    }, liveTileInterval);
    return () => clearInterval(timer);
  }, [data.lowStockItems, liveTileInterval]);

  // Tasks fetch
  useEffect(() => {
    fetchTasks(showArchivedTasks);
  }, [showArchivedTasks]);

  const fetchTasks = async (archived = showArchivedTasks) => {
    const res = await fetch(`/api/tasks?archived=${archived}`);
    if (res.ok) setTasks(await res.json());
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const alarm_time = newTaskDate ? new Date(newTaskDate).toISOString() : null;
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: newTaskText, alarm_time, priority: newTaskPriority })
    });
    if (res.ok) {
      setNewTaskText("");
      setNewTaskDate("");
      setNewTaskPriority("medium");
      fetchTasks();
    }
  };

  const toggleTask = async (id: number, completed: boolean) => {
    setTasks(tasks.filter(t => t.id !== id));
    if (!completed) {
      setGlowArchive(true);
      setTimeout(() => setGlowArchive(false), 1200);
    }
    await fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !completed })
    });
  };

  const deleteTask = async (id: number) => {
    setOpenMenuId(null);
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    fetchTasks();
  };

  const navAlert = (dir: 1 | -1) => {
    const len = data.lowStockItems?.length || 1;
    setAlertIndex(prev => (prev + dir + len) % len);
  };

  const currentAlert = data.lowStockItems?.[alertIndex];
  const isCritical = currentAlert?.stock_qty <= (currentAlert?.min_stock ?? 10);
  const alertSeverity = isCritical ? 'critical' : 'warning';

  const formatTaskDate = (dt: string) => {
    try { return format(new Date(dt), 'MMM dd, yyyy'); }
    catch { return dt; }
  };

  const priorityLabel = (p: string) => {
    if (p === 'high') return 'High';
    if (p === 'low') return 'Low';
    return 'Medium';
  };

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header items-center flex justify-between">
        <div className="page-header-title-container">
          <div className="page-header-icon bg-indigo-500">
            <LayoutDashboard size={24} />
          </div>
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-description" suppressHydrationWarning>
              Overview of your business metrics &bull; {format(currentTime, 'PPPP p')}
            </p>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          {/* Filter dropdown with calendar icon */}
          <div className="relative flex items-center">
            <CalendarDays size={14} className="absolute left-3.5 text-muted pointer-events-none z-[1]" />
            <select
              className="form-control w-44 cursor-pointer"
              style={{ paddingLeft: '44px' }}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="year">This Year</option>
              <option value="month">Last 30 Days</option>
              <option value="week">Last 7 Days</option>
            </select>
          </div>
          {/* Create Quotation — lighter blue matching all quotations card */}
          <Link
            href="/quotations/new"
            className="btn btn-primary shadow-md text-white"
            style={{ backgroundColor: '#2563eb' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1d4ed8'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#2563eb'}
          >
            <Plus size={16} /> Create Quotation
          </Link>
        </div>
      </div>

      {/* ── Top 4 Metric Pills ── */}
      <div className="dash-metrics-grid">
        {/* Today's Quotes — Blue */}
        <Link href={`/quotations?date=${format(new Date(), 'yyyy-MM-dd')}`} className="dash-metric-pill">
          <div className="dash-metric-icon-badge blue">
            <FileText size={20} strokeWidth={2} />
          </div>
          <div className="dash-metric-pill-content">
            <div className="dash-metric-pill-label">Today's Quotes</div>
            <div className="dash-metric-pill-value">{loading ? "—" : data.todayQuotes}</div>
            <div className="dash-metric-pill-trend">— 0% vs yesterday</div>
          </div>
        </Link>

        {/* Clients Visited Today — Green */}
        <Link href={`/quotations?date=${format(new Date(), 'yyyy-MM-dd')}&visited=Visited`} className="dash-metric-pill">
          <div className="dash-metric-icon-badge green">
            <Users size={20} strokeWidth={2} />
          </div>
          <div className="dash-metric-pill-content">
            <div className="dash-metric-pill-label">Clients Visited Today</div>
            <div className="dash-metric-pill-value">{loading ? "—" : data.todayVisited}</div>
            <div className="dash-metric-pill-trend">— 0% vs yesterday</div>
          </div>
        </Link>

        {/* Yesterday's Quotes — Purple */}
        <Link href={`/quotations?date=${format(new Date(Date.now() - 86400000), 'yyyy-MM-dd')}`} className="dash-metric-pill">
          <div className="dash-metric-icon-badge purple">
            <Calendar size={20} strokeWidth={2} />
          </div>
          <div className="dash-metric-pill-content">
            <div className="dash-metric-pill-label">Yesterday's Quotes</div>
            <div className="dash-metric-pill-value">{loading ? "—" : data.yesterdayQuotes}</div>
            <div className="dash-metric-pill-trend">— 0% vs previous day</div>
          </div>
        </Link>

        {/* Visited Yesterday — Cyan */}
        <Link href={`/quotations?date=${format(new Date(Date.now() - 86400000), 'yyyy-MM-dd')}&visited=Visited`} className="dash-metric-pill">
          <div className="dash-metric-icon-badge cyan">
            <Briefcase size={20} strokeWidth={2} />
          </div>
          <div className="dash-metric-pill-content">
            <div className="dash-metric-pill-label">Visited Yesterday</div>
            <div className="dash-metric-pill-value">{loading ? "—" : data.yesterdayVisited}</div>
            <div className="dash-metric-pill-trend">— 0% vs previous day</div>
          </div>
        </Link>
      </div>

      {/* ── Summary 3 Cards ── */}
      <div className="dash-summary-grid">
        {/* Total Quotations — Dark Blue */}
        <div className="dash-summary-card">
          <div className="dash-summary-card-body">
            <div className="dash-summary-card-label">
              <TrendingUp size={15} color="#1d4ed8" />
              Total Quotations
            </div>
            <div className="dash-summary-card-value" style={{ color: '#1d4ed8' }}>
              {loading ? "—" : data.quoteCount}
            </div>
            <Link href="/quotations" className="dash-summary-card-link" style={{ color: '#1d4ed8' }}>
              View all quotations <ArrowRight size={13} />
            </Link>
          </div>
          {/* Filled illustration */}
          <div className="dash-summary-card-illustration" style={{ background: 'rgba(29,78,216,0.08)' }}>
            <FileText size={72} color="#1d4ed8" strokeWidth={1.5} fill="rgba(29,78,216,0.15)" />
          </div>
        </div>

        {/* Inventory Items — Green */}
        <div className="dash-summary-card">
          <div className="dash-summary-card-body">
            <div className="dash-summary-card-label">
              <Package size={15} color="#059669" />
              Inventory Items
            </div>
            <div className="dash-summary-card-value" style={{ color: '#059669' }}>
              {loading ? "—" : data.invCount}
            </div>
            <Link href="/inventory" className="dash-summary-card-link" style={{ color: '#059669' }}>
              View inventory <ArrowRight size={13} />
            </Link>
          </div>
          {/* Filled illustration */}
          <div className="dash-summary-card-illustration" style={{ background: 'rgba(5,150,105,0.08)' }}>
            <Package size={72} color="#059669" strokeWidth={1.5} fill="rgba(5,150,105,0.15)" />
          </div>
        </div>

        {/* Clients Not Visited — Amber (matches mockup orange) */}
        <div className="dash-summary-card">
          <div className="dash-summary-card-body">
            <div className="dash-summary-card-label">
              <Users size={15} color="#d97706" />
              Clients Not Visited
            </div>
            <div className="dash-summary-card-value" style={{ color: '#d97706' }}>
              {loading ? "—" : data.totalNotVisited}
            </div>
            <Link href="/quotations?visited=Not Visited" className="dash-summary-card-link" style={{ color: '#d97706' }}>
              View clients <ArrowRight size={13} />
            </Link>
          </div>
          {/* Filled illustration */}
          <div className="dash-summary-card-illustration" style={{ background: 'rgba(217,119,6,0.08)' }}>
            <Users size={72} color="#d97706" strokeWidth={1.5} fill="rgba(217,119,6,0.15)" />
          </div>
        </div>
      </div>

      {/* ── Stock Alert Banner ── */}
      {data.lowStockItems?.length > 0 && currentAlert && (
        <div
          onClick={() => router.push('/inventory?tab=store&filter=alerts')}
          className="cursor-pointer mb-6"
        >
          <div className={`dash-stock-alert ${alertSeverity}`}>
            {/* Filled circle with white triangle icon */}
            <div className={`dash-stock-alert-icon ${alertSeverity}`}>
              <AlertTriangle size={24} strokeWidth={2.5} />
            </div>

            <div className="dash-stock-alert-body">
              <div className={`dash-stock-alert-header ${alertSeverity}`}>
                Stock Alert ({data.lowStockItems.length} items)
              </div>
              <div className="dash-stock-alert-name">{currentAlert.name}</div>
              <div className="dash-stock-alert-sub">
                Current Stock:&nbsp;
                <strong className={isCritical ? 'text-danger' : 'text-warning'}>
                  {currentAlert.stock_qty} {currentAlert.unit || 'pcs'}
                </strong>
                <span className={`dash-stock-alert-badge ${alertSeverity}`} style={{ marginLeft: '4px' }}>
                  {isCritical ? 'Critical' : 'Low Level'}
                </span>
              </div>
            </div>

            <div className="dash-stock-alert-actions" onClick={e => e.stopPropagation()}>
              <button
                className="btn btn-outline"
                style={{ fontSize: '13px', padding: '7px 16px', whiteSpace: 'nowrap' }}
                onClick={() => router.push('/inventory?tab=store&filter=alerts')}
              >
                Restock Now
              </button>
              {data.lowStockItems.length > 1 && (
                <>
                  <button
                    className="dash-stock-alert-nav"
                    onClick={e => { e.preventDefault(); navAlert(-1); }}
                    title="Previous"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    className="dash-stock-alert-nav"
                    onClick={e => { e.preventDefault(); navAlert(1); }}
                    title="Next"
                  >
                    <ChevronRight size={16} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tasks & Reminders ── */}
      <div className="dash-tasks-section">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-base font-bold text-main m-0">
            Tasks &amp; Reminders
          </h2>
          <button
            className={`btn btn-outline ${glowArchive ? 'archive-glow' : ''}`}
            style={{ padding: '5px 12px', fontSize: '12px', color: 'var(--primary)', fontWeight: 600 }}
            onClick={() => setShowArchivedTasks(!showArchivedTasks)}
          >
            {showArchivedTasks ? 'View Active Tasks' : 'View Archived'}
          </button>
        </div>

        {/* Add Task Row */}
        {!showArchivedTasks && (
          <form onSubmit={addTask} className="dash-task-input-row">
            <input
              type="text"
              className="form-control"
              placeholder="Add a new task..."
              value={newTaskText}
              onChange={e => setNewTaskText(e.target.value)}
              style={{ flex: 1, fontSize: '14px' }}
            />
            <input
              type="date"
              className="form-control"
              value={newTaskDate}
              onChange={e => setNewTaskDate(e.target.value)}
              style={{ width: '160px', fontSize: '14px' }}
            />
            <select
              className="form-control"
              value={newTaskPriority}
              onChange={e => setNewTaskPriority(e.target.value)}
              style={{ width: '120px', fontSize: '14px' }}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <button
              type="submit"
              className="btn btn-primary shadow-sm"
              disabled={!newTaskText.trim()}
            >
              Add Task
            </button>
          </form>
        )}

        {/* Rejected stock request alerts */}
        {!showArchivedTasks && data.rejectedStockRequests?.map((req: any) => (
          <div key={`req-${req.quotation_id}`} className="dash-rejected-req">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
              <div style={{ color: '#ef4444', fontSize: '18px' }}>⚠️</div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#991b1b' }}>
                  Rejected Stock Request: {req.client_name}
                </div>
                <div style={{ fontSize: '12px', marginTop: '2px', color: '#b91c1c' }}>
                  Quote #{req.quote_number || req.quotation_id} &bull; {req.project_type || 'Project'}
                </div>
              </div>
            </div>
            <Link
              href={`/quotations/${req.quotation_id}`}
              className="btn btn-danger py-2 px-3 text-xs border-none"
            >
              Fix &amp; Re-Issue
            </Link>
          </div>
        ))}

        {/* Task rows */}
        <div ref={menuRef}>
          {tasks.length === 0 && !data.rejectedStockRequests?.length ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '28px 0', fontSize: '14px' }}>
              No tasks found.
            </div>
          ) : (
            tasks.slice(0, 5).map(task => {
              const overdue = task.alarm_time && !task.completed && new Date(task.alarm_time) < currentTime;
              const priority = (task.priority || 'medium').toLowerCase();
              return (
                <div key={task.id} className={`dash-task-row ${overdue ? 'overdue' : ''}`}>
                  <input
                    type="checkbox"
                    className="dash-task-checkbox"
                    checked={!!task.completed}
                    onChange={() => toggleTask(task.id, !!task.completed)}
                  />
                  <div className={`dash-task-text ${task.completed ? 'completed' : ''}`}>
                    {task.text}
                    {overdue && (
                      <span style={{ fontSize: '11px', color: '#ef4444', marginLeft: '6px' }}>Overdue</span>
                    )}
                  </div>
                  {task.alarm_time && (
                    <div className="dash-task-date">
                      <CalendarDays size={13} />
                      {formatTaskDate(task.alarm_time)}
                    </div>
                  )}
                  <span className={`dash-priority-badge ${priority}`}>
                    {priorityLabel(priority)}
                  </span>
                  <div className="dash-task-action-menu" style={{ position: 'relative' }}>
                    <button
                      className="dash-task-action-btn"
                      onClick={() => setOpenMenuId(openMenuId === task.id ? null : task.id)}
                      title="Actions"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {openMenuId === task.id && (
                      <div className="dash-task-dropdown">
                        <button onClick={() => { toggleTask(task.id, !!task.completed); setOpenMenuId(null); }}>
                          {task.completed ? '↩ Unarchive' : '✓ Complete'}
                        </button>
                        {(currentUser?.role_name === 'Admin' || task.created_by === currentUser?.id) && (
                          <button className="danger" onClick={() => deleteTask(task.id)}>
                            <Trash2 size={13} /> Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* View all tasks link */}
        {tasks.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <Link href="/tasks" className="dash-summary-card-link" style={{ color: 'var(--primary)', fontSize: '13px' }}>
              View all tasks <ArrowRight size={13} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
