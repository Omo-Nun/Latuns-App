"use client";
import { Users } from "lucide-react";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Download, Filter, BarChart3, X, ChevronDown } from "lucide-react";
import { format } from "date-fns";

export default function ClientsPage() {
    const router = useRouter();
    const [clients, setClients] = useState<any[]>([]);
    const [meta, setMeta] = useState({ page: 1, limit: 50, totalPages: 1 });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'created_at', direction: 'desc' });
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [paymentFilter, setPaymentFilter] = useState<string>("all");
    const [showStatusDropdown, setShowStatusDropdown] = useState(false);
    const [showPaymentDropdown, setShowPaymentDropdown] = useState(false);
    const [showStats, setShowStats] = useState(false);

    useEffect(() => {
        const savedSort = localStorage.getItem("latuns_clients_sort");
        if (savedSort) {
            try {
                setSortConfig(JSON.parse(savedSort));
            } catch (e) { }
        }
        checkPermissions();
    }, []);

    useEffect(() => {
        fetchClients(1, searchTerm);
    }, [searchTerm]);

    useEffect(() => {
        if (meta.page > 1) {
            const el = document.getElementById("first-new-item");
            if (el) {
                setTimeout(() => {
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 100);
            }
        }
    }, [clients]);

    // Close dropdowns on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const t = e.target as HTMLElement;
            if (!t.closest('.status-dropdown-wrapper')) setShowStatusDropdown(false);
            if (!t.closest('.payment-dropdown-wrapper')) setShowPaymentDropdown(false);
        };
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, []);

    const checkPermissions = async () => {
        try {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
                const userData = await res.json();
                if (userData.user && userData.user.role_name !== 'Admin') {
                    const sRes = await fetch(`/api/staff/roles/${userData.user.role_id}/sub-permissions`);
                    if (sRes.ok) {
                        const perms = await sRes.json();
                        const clientPerm = perms.find((p: any) => p.module === 'People' && p.sub_module === 'Clients');
                        const staffPerm = perms.find((p: any) => p.module === 'People' && p.sub_module === 'Staff');
                        
                        if (clientPerm && !clientPerm.allowed) {
                            if (staffPerm && staffPerm.allowed) {
                                router.push('/people/staff');
                            } else {
                                router.push('/');
                            }
                        }
                        setStaffAllowed(!!staffPerm?.allowed || userData.user.role_name === 'Admin');
                    }
                } else {
                    setStaffAllowed(true);
                }
            }
        } catch { /* silent */ }
    };

    const [staffAllowed, setStaffAllowed] = useState(true);

    const fetchClients = async (page = 1, search = "") => {
        setLoading(true);
        try {
            const res = await fetch(`/api/clients?page=${page}&limit=50&search=${encodeURIComponent(search)}`);
            const result = await res.json();
            if (result.data) {
                setClients(prev => page === 1 ? result.data : [...prev, ...result.data]);
                setMeta(result.meta || { page: 1, limit: 50, totalPages: 1 });
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const sortedClients = [...clients].sort((a, b) => {
        let aValue: any = a[sortConfig.key];
        let bValue: any = b[sortConfig.key];

        if (sortConfig.key === 'location') {
            aValue = (a.city || '') + (a.state || '');
            bValue = (b.city || '') + (b.state || '');
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const filteredClients = sortedClients.filter(c => {
        // Search filter
        const matchesSearch = c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.phone?.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Status filter
        const matchesStatus = statusFilter === 'all' || 
            (c.latest_project_status || '').toLowerCase() === statusFilter.toLowerCase();
        
        // Payment filter
        let matchesPayment = true;
        if (paymentFilter !== 'all') {
            const balance = c.outstanding_balance ?? 0;
            const totalVal = c.total_value ?? 0;
            if (paymentFilter === 'paid') matchesPayment = totalVal > 0 && balance <= 0;
            else if (paymentFilter === 'partial') matchesPayment = balance > 0 && balance < totalVal;
            else if (paymentFilter === 'unpaid') matchesPayment = totalVal > 0 && balance >= totalVal;
        }
        
        return matchesSearch && matchesStatus && matchesPayment;
    });

    const handleSort = (key: string) => {
        setSortConfig(prev => {
            const newConfig: { key: string, direction: 'asc' | 'desc' } = {
                key,
                direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
            };
            localStorage.setItem("latuns_clients_sort", JSON.stringify(newConfig));
            return newConfig;
        });
    };

    const exportClients = () => {
        if (clients.length === 0) return alert("No clients to export.");
        const headers = ["Name", "Phone", "City", "State", "Total Quotations", "Total Value (₦)"];
        const rows = clients.map((c: any) => [
            `"${(c.name || '').replace(/"/g, '""')}"`,
            `"${(c.phone || '').replace(/"/g, '""')}"`,
            `"${(c.city || '').replace(/"/g, '""')}"`,
            `"${(c.state || '').replace(/"/g, '""')}"`,
            c.total_quotations || 0,
            (c.total_value || 0).toFixed(2)
        ]);
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `Latuns_Clients_${format(new Date(), 'yyyyMMdd')}.csv`;
        a.click();
    };

    // Statistics calculations
    const totalClients = clients.length;
    
    const statusCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};
    const visitCounts: Record<string, number> = {};
    
    let totalProjects = 0;
    let totalVisits = 0;

    clients.forEach(c => {
        const status = c.latest_project_status || 'Unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;

        if (c.project_types && Array.isArray(c.project_types)) {
            c.project_types.forEach((pt: string) => {
                const type = pt || 'Unknown';
                typeCounts[type] = (typeCounts[type] || 0) + 1;
                totalProjects++;
            });
        }
        
        if (c.visit_statuses && Array.isArray(c.visit_statuses)) {
            c.visit_statuses.forEach((vs: string) => {
                const v = vs || 'Unknown';
                visitCounts[v] = (visitCounts[v] || 0) + 1;
                totalVisits++;
            });
        }
    });

    const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (paymentFilter !== 'all' ? 1 : 0);

    return (
        <div>
            <div className="page-header mb-4">
                <div className="page-header-title-container">
                    <div className="page-header-icon bg-purple-500">
                        <Users size={24} />
                    </div>
                    <div>
                        <h1 className="page-title">People & Directory</h1>
                        <p className="page-description">Manage client profiles and company roof estimators</p>
                    </div>
                    <div className="tab-bar">
                        <div className="tab-btn active">Client Profiles</div>
                        {staffAllowed && <Link href="/people/staff" className="tab-btn">Staff Directory</Link>}
                    </div>
                </div>
                <button className="btn btn-outline" onClick={exportClients}>
                    <Download size={16} /> Export CSV
                </button>
            </div>

            <div className="card mb-6 p-4" style={{ overflow: 'visible' }}>
                <div className="flex gap-3 items-center flex-wrap">
                    <div className="search-wrapper max-w-[400px]">
                        <div className="search-icon">
                            <Search size={18} />
                        </div>
                        <input
                            type="text"
                            className="form-control search-input"
                            placeholder="Search clients by name or phone..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Project Status Filter */}
                    <div className="relative status-dropdown-wrapper">
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowStatusDropdown(!showStatusDropdown); setShowPaymentDropdown(false); }}
                            className={`btn btn-outline text-[13px] flex items-center gap-1.5 ${statusFilter !== 'all' ? '!border-primary !text-primary font-bold' : ''}`}
                        >
                            <Filter size={14} />
                            {statusFilter === 'all' ? 'Project Status' : statusFilter}
                            <ChevronDown size={14} />
                        </button>
                        {showStatusDropdown && (
                            <div className="absolute top-full left-0 mt-1 bg-[var(--bg-color-alt)] border border-[var(--border)] rounded-lg shadow-lg z-50 min-w-[160px] py-1" style={{ animation: 'fadeIn 0.15s ease' }}>
                                {['all', 'Pending', 'Started', 'Completed', 'Halted'].map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => { setStatusFilter(opt); setShowStatusDropdown(false); }}
                                        className={`w-full text-left px-4 py-2 text-[13px] border-none cursor-pointer transition-colors ${statusFilter === opt ? 'bg-[var(--sidebar-active-bg)] text-primary font-bold' : 'bg-transparent text-[var(--text-main)] hover:bg-[var(--sidebar-hover)]'}`}
                                    >
                                        {opt === 'all' ? 'All Statuses' : opt}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Payment Stage Filter */}
                    <div className="relative payment-dropdown-wrapper">
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowPaymentDropdown(!showPaymentDropdown); setShowStatusDropdown(false); }}
                            className={`btn btn-outline text-[13px] flex items-center gap-1.5 ${paymentFilter !== 'all' ? '!border-primary !text-primary font-bold' : ''}`}
                        >
                            <Filter size={14} />
                            {paymentFilter === 'all' ? 'Payment Stage' : paymentFilter}
                            <ChevronDown size={14} />
                        </button>
                        {showPaymentDropdown && (
                            <div className="absolute top-full left-0 mt-1 bg-[var(--bg-color-alt)] border border-[var(--border)] rounded-lg shadow-lg z-50 min-w-[160px] py-1" style={{ animation: 'fadeIn 0.15s ease' }}>
                                {['all', 'Paid', 'Partial', 'Unpaid'].map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => { setPaymentFilter(opt.toLowerCase()); setShowPaymentDropdown(false); }}
                                        className={`w-full text-left px-4 py-2 text-[13px] border-none cursor-pointer transition-colors ${paymentFilter === opt.toLowerCase() ? 'bg-[var(--sidebar-active-bg)] text-primary font-bold' : 'bg-transparent text-[var(--text-main)] hover:bg-[var(--sidebar-hover)]'}`}
                                    >
                                        {opt === 'all' ? 'All Stages' : opt}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {activeFilterCount > 0 && (
                        <button
                            onClick={() => { setStatusFilter('all'); setPaymentFilter('all'); }}
                            className="btn text-[12px] px-2 py-1 text-red-500 bg-red-50 border border-red-200 hover:bg-red-100 rounded-md cursor-pointer"
                        >
                            Clear Filters ({activeFilterCount})
                        </button>
                    )}

                    {/* Statistics Button */}
                    <button
                        onClick={() => setShowStats(true)}
                        className="btn btn-outline text-[13px] flex items-center gap-1.5 ml-auto"
                    >
                        <BarChart3 size={14} /> Statistics
                    </button>
                </div>
            </div>

            <div className="table-wrapper" style={{ opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s' }}>
                <table className="table">
                    <thead>
                        <tr>
                            <th onClick={() => handleSort('name')} className="cursor-pointer">
                                Name {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                            </th>
                            <th>Phone Number</th>
                            <th onClick={() => handleSort('location')} className="cursor-pointer">
                                Location {sortConfig.key === 'location' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                            </th>
                            <th onClick={() => handleSort('total_quotations')} className="cursor-pointer text-right">
                                Total Quotes {sortConfig.key === 'total_quotations' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                            </th>
                            <th onClick={() => handleSort('total_value')} className="cursor-pointer text-right">
                                Total Value {sortConfig.key === 'total_value' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                            </th>
                            <th onClick={() => handleSort('created_at')} className="cursor-pointer text-right">
                                Date Joined {sortConfig.key === 'created_at' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {clients.length === 0 && loading ? (
                            <tr>
                                <td colSpan={6} className="text-center p-8">Loading clients...</td>
                            </tr>
                        ) : filteredClients.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center p-8 text-muted">No clients found. Note: Client Profiles are auto-generated when you create new Quotations.</td>
                            </tr>
                        ) : (() => {
                            let lastDateStr = "";
                            let foundFirstNew = false;
                            return filteredClients.map(client => {
                                const dateStr = format(new Date(client.created_at || client.updated_at || Date.now()), 'MMM d, yyyy (EEEE)');
                                const isNewDateGroup = dateStr !== lastDateStr && (sortConfig.key === 'created_at' || sortConfig.key === 'updated_at');
                                lastDateStr = dateStr;

                                const originalIndex = clients.indexOf(client);
                                let isFirstNew = false;
                                if (meta.page > 1 && originalIndex >= (meta.page - 1) * 50 && !foundFirstNew) {
                                    isFirstNew = true;
                                    foundFirstNew = true;
                                }

                                const isNewBatch = originalIndex >= (meta.page - 1) * 50 && originalIndex < meta.page * 50;

                                return (
                                    <React.Fragment key={client.id}>
                                        {isNewDateGroup && (
                                            <tr className="bg-[var(--bg-color)]">
                                                <td colSpan={6} className="font-bold px-5 py-2.5 text-primary text-sm border-t" style={{ borderBottom: '2px solid var(--primary)' }}>
                                                    {dateStr}
                                                </td>
                                            </tr>
                                        )}
                                        <tr
                                            className={isNewBatch && meta.page > 1 ? "animate-row" : ""}
                                            id={isFirstNew ? "first-new-item" : undefined}
                                        >
                                            <td className="font-semibold">
                                                <Link href={`/people/clients/${client.id}`} className="text-inherit no-underline">{client.name}</Link>
                                            </td>
                                            <td>{client.phone || "-"}</td>
                                            <td>{[client.city, client.state].filter(Boolean).join(", ") || "-"}</td>
                                            <td className="text-right">{client.total_quotations || 0}</td>
                                            <td className="text-right font-semibold text-primary">₦{(client.total_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            <td className="text-right text-xs text-muted">
                                                {client.created_at ? format(new Date(client.created_at), 'MMM d, yyyy HH:mm') : '-'}
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                );
                            });
                        })()}
                    </tbody>
                </table>
            </div>

            {meta.page < meta.totalPages && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px', marginBottom: '24px' }}>
                    <button 
                        className="btn btn-outline" 
                        type="button"
                        disabled={loading}
                        onClick={(e) => { e.preventDefault(); fetchClients(meta.page + 1, searchTerm); }}
                        style={{ padding: '10px 24px', minWidth: '200px' }}
                    >
                        {loading ? 'Loading...' : 'Load More'}
                    </button>
                </div>
            )}

            {/* Statistics Modal */}
            {showStats && (
                <div className="modal-overlay" onClick={() => setShowStats(false)}>
                    <div className="modal-content" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title flex items-center gap-2"><BarChart3 size={20} /> Client Statistics</h2>
                            <button onClick={() => setShowStats(false)} className="btn btn-outline p-1.5" style={{ border: 'none' }}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-3 gap-3 mb-6">
                                <div style={{ background: 'var(--bg-color)', borderRadius: 'var(--radius-md)', padding: '16px', textAlign: 'center', border: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)' }}>{totalClients}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Clients</div>
                                </div>
                                <div style={{ background: 'var(--bg-color)', borderRadius: 'var(--radius-md)', padding: '16px', textAlign: 'center', border: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)' }}>{totalProjects}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Projects</div>
                                </div>
                                <div style={{ background: 'var(--bg-color)', borderRadius: 'var(--radius-md)', padding: '16px', textAlign: 'center', border: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent)' }}>{totalVisits}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Visits</div>
                                </div>
                            </div>

                            {/* Status Breakdown */}
                            <div style={{ marginBottom: '24px' }}>
                                <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-main)' }}>Project Status Breakdown</h3>
                                <div className="flex flex-col gap-2">
                                    {Object.entries(statusCounts).map(([status, count]) => {
                                        const pct = totalClients > 0 ? Math.round((count / totalClients) * 100) : 0;
                                        const colorMap: Record<string, string> = {
                                            'Pending': '#f59e0b', 'Started': '#3b82f6', 'Completed': '#10b981', 'Halted': '#ef4444', 'Unknown': '#94a3b8'
                                        };
                                        const color = colorMap[status] || '#94a3b8';
                                        return (
                                            <div key={status} className="flex items-center gap-3">
                                                <div style={{ width: '90px', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>{status}</div>
                                                <div style={{ flex: 1, height: '8px', backgroundColor: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: '4px', transition: 'width 0.5s ease' }} />
                                                </div>
                                                <div style={{ fontSize: '12px', fontWeight: 700, color, minWidth: '50px', textAlign: 'right' }}>{count} ({pct}%)</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Project Types */}
                            <div style={{ marginBottom: '24px' }}>
                                <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-main)' }}>Project Type Frequencies</h3>
                                <div className="flex flex-col gap-2">
                                    {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([type, count], i) => {
                                        const pct = totalProjects > 0 ? Math.round((count / totalProjects) * 100) : 0;
                                        const color = i % 2 === 0 ? 'var(--primary)' : 'var(--accent)';
                                        return (
                                            <div key={type} className="flex items-center gap-3">
                                                <div style={{ width: '120px', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>{type}</div>
                                                <div style={{ flex: 1, height: '8px', backgroundColor: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: '4px', transition: 'width 0.5s ease' }} />
                                                </div>
                                                <div style={{ fontSize: '12px', fontWeight: 700, color, minWidth: '50px', textAlign: 'right' }}>{count} ({pct}%)</div>
                                            </div>
                                        );
                                    })}
                                    {Object.keys(typeCounts).length === 0 && (
                                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No project types available</div>
                                    )}
                                </div>
                            </div>

                            {/* Visits */}
                            <div>
                                <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-main)' }}>Visits Breakdown</h3>
                                <div className="flex flex-col gap-2">
                                    {Object.entries(visitCounts).sort((a, b) => b[1] - a[1]).map(([vstatus, count]) => {
                                        const pct = totalVisits > 0 ? Math.round((count / totalVisits) * 100) : 0;
                                        const color = vstatus.toLowerCase() === 'visited' ? '#10b981' : (vstatus.toLowerCase() === 'pending' ? '#f59e0b' : '#3b82f6');
                                        return (
                                            <div key={vstatus} className="flex items-center gap-3">
                                                <div style={{ width: '120px', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>{vstatus}</div>
                                                <div style={{ flex: 1, height: '8px', backgroundColor: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: '4px', transition: 'width 0.5s ease' }} />
                                                </div>
                                                <div style={{ fontSize: '12px', fontWeight: 700, color, minWidth: '50px', textAlign: 'right' }}>{count} ({pct}%)</div>
                                            </div>
                                        );
                                    })}
                                    {Object.keys(visitCounts).length === 0 && (
                                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No visit data available</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
