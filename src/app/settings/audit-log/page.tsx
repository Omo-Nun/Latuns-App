"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { History, Search, Filter, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { format } from 'date-fns';

export default function AuditLogPage() {
    const router = useRouter();
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    const [filters, setFilters] = useState({
        user: '',
        module: '',
        action: ''
    });

    const modules = ['Auth', 'Quotations', 'Inventory', 'Tasks', 'Settings', 'People', 'Users'];
    const actions = ['Login', 'Logout', 'Create', 'Update', 'Delete', 'Approve', 'Reject', 'Complete'];

    useEffect(() => {
        fetchLogs();
    }, [page, filters]);

    useEffect(() => {
        if (page > 1) {
            const el = document.getElementById("first-new-item");
            if (el) {
                setTimeout(() => {
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 100);
            }
        }
    }, [logs]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                user: filters.user,
                module: filters.module,
                action: filters.action
            });
            const res = await fetch(`/api/audit-log?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setLogs(prev => page === 1 ? data.logs : [...prev, ...data.logs]);
                setTotalPages(data.totalPages);
                setTotalCount(data.totalCount);
            } else if (res.status === 403) {
                router.push('/');
            }
        } catch (error) {
            console.error("Failed to fetch logs", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
        setPage(1);
    };

    const exportToCsv = () => {
        const headers = ["Timestamp", "User", "Action", "Module", "Description"];
        const rows = logs.map(log => [
            format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
            log.username || 'System',
            log.action,
            log.module || '-',
            log.description
        ]);
        
        const csvContent = "data:text/csv;charset=utf-8," 
            + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Latuns_Audit_Log_${format(new Date(), 'yyyyMMdd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="container" style={{ paddingBottom: '40px' }}>
            <div className="page-header" style={{ marginBottom: '24px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                        <History size={16} /> Activity Audit
                    </div>
                    <h1 className="page-title">System Audit Log</h1>
                    <p className="page-description">Track all significant actions across the system</p>
                </div>
                <button className="btn btn-outline" onClick={exportToCsv}>
                    <Download size={16} /> Export CSV
                </button>
            </div>

            <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '12px' }}>Search User</label>
                        <div className="search-wrapper">
                            <div className="search-icon">
                                <Search size={18} />
                            </div>
                            <input 
                                type="text" 
                                name="user"
                                value={filters.user}
                                onChange={handleFilterChange}
                                className="form-control search-input" 
                                placeholder="Username..." 
                                style={{ fontSize: '13px' }} 
                            />
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '12px' }}>Module</label>
                        <select name="module" value={filters.module} onChange={handleFilterChange} className="form-control" style={{ fontSize: '13px' }}>
                            <option value="">All Modules</option>
                            {modules.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '12px' }}>Action</label>
                        <select name="action" value={filters.action} onChange={handleFilterChange} className="form-control" style={{ fontSize: '13px' }}>
                            <option value="">All Actions</option>
                            {actions.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="card" style={{ overflow: 'hidden', opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s' }}>
                <table className="table">
                    <thead>
                        <tr>
                            <th style={{ width: '180px' }}>Timestamp</th>
                            <th style={{ width: '120px' }}>User</th>
                            <th style={{ width: '100px' }}>Action</th>
                            <th style={{ width: '100px' }}>Module</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.length === 0 && loading ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading logs...</td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No audit logs found</td></tr>
                        ) : (() => {
                            let foundFirstNew = false;
                            return logs.map((log, index) => {
                                let isFirstNew = false;
                                if (page > 1 && index >= (page - 1) * 50 && !foundFirstNew) {
                                    isFirstNew = true;
                                    foundFirstNew = true;
                                }
                                const isNewBatch = index >= (page - 1) * 50 && index < page * 50;
                                return (
                                    <tr 
                                        key={log.id} 
                                        className={isNewBatch && page > 1 ? "animate-row" : ""} 
                                        id={isFirstNew ? "first-new-item" : undefined}
                                    >
                                    <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                        {format(new Date(log.created_at), 'MMM d, yyyy • HH:mm:ss')}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '24px', height: '24px', borderRadius: '12px', backgroundColor: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 }}>
                                                {log.username?.[0].toUpperCase() || 'S'}
                                            </div>
                                            <span style={{ fontWeight: 600, fontSize: '13px' }}>{log.username || 'System'}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`badge badge-${log.action.toLowerCase() === 'delete' || log.action.toLowerCase() === 'reject' ? 'danger' : log.action.toLowerCase() === 'create' || log.action.toLowerCase() === 'approve' || log.action.toLowerCase() === 'complete' ? 'success' : 'primary'}`} style={{ fontSize: '11px' }}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '13px', fontWeight: 500 }}>{log.module}</td>
                                    <td style={{ fontSize: '13px', color: 'var(--text-main)' }}>{log.description}</td>
                                </tr>
                                );
                            });
                        })()}
                    </tbody>
                </table>

                {page < totalPages && (
                    <div style={{ padding: '16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <button 
                            className="btn btn-outline" 
                            disabled={loading}
                            type="button"
                            style={{ padding: '8px 24px', minWidth: '200px' }} 
                            onClick={(e) => { e.preventDefault(); setPage(p => p + 1); }}
                        >
                            {loading ? 'Loading...' : 'Load More'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
