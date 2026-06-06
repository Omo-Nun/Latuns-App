"use client";
import { FileText } from "lucide-react";

import React, { Suspense, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Eye, Trash2, Search, Calendar, Download, ChevronLeft, ChevronRight, XCircle } from "lucide-react";
import { format } from "date-fns";
import { useSearchParams } from "next/navigation";
import { calcNetTotal, calcBalance } from "@/lib/financeUtils";

type Quotation = {
    id: number;
    quote_number: string;
    client_id?: number;
    client_name: string;
    client_address: string;
    subsidiary_name: string;
    project_type: string;
    subtotal: number;
    sundries: string;
    transportation: number;
    discount_value: number;
    total_paid: number;
    visit_status?: string;
    project_status?: string;
    doc_type?: string;
    created_at: string;
};

function QuotationsContent() {
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [meta, setMeta] = useState({ totalCount: 0, page: 1, limit: 50, totalPages: 1 });
    const [loading, setLoading] = useState(true);
    const searchParams = useSearchParams();
    const [visitedFilter, setVisitedFilter] = useState<string>(searchParams.get('visited') || 'all');
    const [startDate, setStartDate] = useState<string>(searchParams.get('startDate') || searchParams.get('date') || "");
    const [endDate, setEndDate] = useState<string>(searchParams.get('endDate') || searchParams.get('date') || "");
    const [searchTerm, setSearchTerm] = useState("");
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'created_at', direction: 'desc' });

    const fetchQuotations = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: "50",
                search: searchTerm,
                startDate,
                endDate,
                ...(visitedFilter !== 'all' ? { visited: visitedFilter } : {})
            });
            if (sortConfig) {
                params.set('sortKey', sortConfig.key);
                params.set('sortDir', sortConfig.direction);
            }
            
            const res = await fetch(`/api/quotations?${params.toString()}`);
            const result = await res.json();
            setQuotations(prev => page === 1 ? (result.data || []) : [...prev, ...(result.data || [])]);
            setMeta(result.meta || { totalCount: 0, page: 1, limit: 50, totalPages: 1 });
        } catch (error) {
            console.error("Failed to fetch quotations", error);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, startDate, endDate, visitedFilter, sortConfig]);

    // Sync with URL search params changes if navigated from same route
    useEffect(() => {
        const v = searchParams.get('visited');
        const legacyDate = searchParams.get('date');
        
        let shouldUpdate = false;

        setVisitedFilter((prev) => {
            if (v !== null && v !== prev) { shouldUpdate = true; return v; }
            return prev;
        });

        setStartDate((prev) => {
            if (legacyDate !== null && legacyDate !== prev) { shouldUpdate = true; return legacyDate; }
            return prev;
        });
        
        setEndDate((prev) => {
            if (legacyDate !== null && legacyDate !== prev) { shouldUpdate = true; return legacyDate; }
            return prev;
        });

    }, [searchParams]);

    // Trigger fetch whenever filters change manually
    useEffect(() => {
        fetchQuotations(1);
    }, [searchTerm, startDate, endDate, visitedFilter, sortConfig, fetchQuotations]);

    useEffect(() => {
        if (meta.page > 1) {
            const el = document.getElementById("first-new-item");
            if (el) {
                setTimeout(() => {
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 100);
            }
        }
    }, [quotations]);

    const handleClearFilters = () => {
        setSearchTerm("");
        setStartDate("");
        setEndDate("");
        setVisitedFilter("all");
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this quotation? This will also delete all its items and payments.")) return;
        try {
            const res = await fetch(`/api/quotations/${id}`, { method: "DELETE" });
            if (res.ok) fetchQuotations(meta.page);
        } catch (error) {
            alert("Error deleting quotation");
        }
    };

    const exportQuotations = async () => {
        // Fetch all matching without pagination for export
        const params = new URLSearchParams({
            limit: "10000",
            search: searchTerm,
            startDate,
            endDate
        });
        const res = await fetch(`/api/quotations?${params.toString()}`);
        const result = await res.json();
        const dataToExport = result.data || [];

        if (dataToExport.length === 0) return alert("No data to export");

        const headers = ["ID", "Quote Number", "Client Name", "Client Address", "Subsidiary Company", "Project Type", "Date Created", "Net Total", "Total Paid", "Balance", "Status"];
        const csvRows = [headers.join(",")];

        dataToExport.forEach((q: Quotation) => {
            const netTotal = calcNetTotal(q);
            const balance = calcBalance(q);
            const dateStr = format(new Date(q.created_at), 'yyyy-MM-dd');

            const escapeCSV = (str: string | number | null | undefined) => {
                if (str === null || str === undefined) return '""';
                const s = String(str).replace(/"/g, '""');
                return `"${s}"`;
            };

            const row = [
                q.id,
                q.quote_number,
                escapeCSV(q.client_name),
                escapeCSV(q.client_address),
                escapeCSV(q.subsidiary_name),
                escapeCSV(q.project_type),
                dateStr,
                netTotal.toFixed(2),
                q.total_paid?.toFixed(2) || "0.00",
                balance.toFixed(2),
                q.project_status || "Pending"
            ];
            csvRows.push(row.join(","));
        });

        const csvString = csvRows.join("\n");
        const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Latuns_Quotations_Export_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="pb-8">
            <div className="page-header flex justify-between items-start mb-6">
                <div className="page-header-title-container">
                    <div className="page-header-icon bg-blue-500">
                        <FileText size={24} />
                    </div>
                    <div>
                        <h1 className="page-title">Quotations</h1>
                        <p className="page-description">Manage all client quotations and invoices</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button className="btn btn-outline" onClick={exportQuotations}>
                        <Download size={16} /> Export CSV
                    </button>
                    <Link href="/quotations/new" className="btn btn-primary no-underline">
                        <Plus size={16} /> New Quotation
                    </Link>
                </div>
            </div>

            <div className="card flex gap-4 p-4 items-center mb-6">
                <div className="search-wrapper flex-1">
                    <div className="search-icon">
                        <Search size={18} />
                    </div>
                    <input
                        type="text"
                        className="form-control search-input"
                        placeholder="Search by Client Name, Address or Code"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-[160px]">
                    <div className="text-xs text-muted mb-1">From Date</div>
                    <input
                        type="date"
                        className="form-control"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                    />
                </div>
                <div className="w-[160px]">
                    <div className="text-xs text-muted mb-1">To Date</div>
                    <input
                        type="date"
                        className="form-control"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                    />
                </div>
                {(searchTerm || startDate || endDate) && (
                    <button className="btn btn-outline mt-4" onClick={handleClearFilters} style={{ color: "#ef4444", borderColor: "#fca5a5" }}>
                        <XCircle size={16} /> Clear
                    </button>
                )}
            </div>

            <div className="text-sm text-muted mb-3 pl-1">
                Showing <strong>{quotations.length}</strong> of <strong>{meta.totalCount}</strong> results
            </div>

            <div className="table-wrapper card" style={{ opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s' }}>
                <table className="table">
                    <thead>
                        <tr>
                            <th onClick={() => handleSort('id')} style={{ cursor: 'pointer' }}>
                                ID {sortConfig?.key === 'id' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                            </th>
                            <th onClick={() => handleSort('created_at')} style={{ cursor: 'pointer' }}>
                                Date {sortConfig?.key === 'created_at' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                            </th>
                            <th onClick={() => handleSort('client_name')} style={{ cursor: 'pointer' }}>
                                Client Name {sortConfig?.key === 'client_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                            </th>
                            <th onClick={() => handleSort('project_type')} style={{ cursor: 'pointer' }}>
                                Project Type {sortConfig?.key === 'project_type' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                            </th>
                            <th onClick={() => handleSort('project_status')} style={{ cursor: 'pointer' }}>
                                Status {sortConfig?.key === 'project_status' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                            </th>
                            <th style={{ textAlign: "right" }}>Balance</th>
                            <th style={{ textAlign: "right" }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {quotations.length === 0 && loading ? (
                            <tr>
                                <td colSpan={7} style={{ textAlign: "center", padding: "32px" }}>Loading quotations...</td>
                            </tr>
                        ) : quotations.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>No quotations found.</td>
                            </tr>
                        ) : (() => {
                            let lastDateStr = "";
                            let foundFirstNew = false;
                            return quotations.map((q, index) => {
                                const balance = calcBalance(q);
                                const netTotal = calcNetTotal(q);
                                const dateStrForGroup = format(new Date(q.created_at), 'MMM d, yyyy (EEEE)');
                                const dateStr = format(new Date(q.created_at), 'MMM d, yyyy');
                                const isNewDateGroup = dateStrForGroup !== lastDateStr && (sortConfig?.key === 'created_at' || !sortConfig);
                                lastDateStr = dateStrForGroup;

                                let isFirstNew = false;
                                if (meta.page > 1 && index >= (meta.page - 1) * 50 && !foundFirstNew) {
                                    isFirstNew = true;
                                    foundFirstNew = true;
                                }

                                const isNewBatch = index >= (meta.page - 1) * 50 && index < meta.page * 50;

                                return (
                                    <React.Fragment key={q.id}>
                                        {isNewDateGroup && (
                                            <tr className="bg-[var(--bg-color)]">
                                                <td colSpan={7} className="font-bold py-3 px-4 text-primary text-sm border-t" style={{ borderBottom: '2px solid var(--primary)' }}>
                                                    {dateStrForGroup}
                                                </td>
                                            </tr>
                                        )}
                                        <tr
                                            className={isNewBatch && meta.page > 1 ? "animate-row" : ""}
                                            id={isFirstNew ? "first-new-item" : undefined}
                                        >
                                            <td className="font-semibold text-muted">
                                                <Link href={`/quotations/${q.id}`} className="no-underline text-inherit">
                                                    {q.quote_number || `#QC-${String(q.id).padStart(4, '0')}`}
                                                </Link>
                                            </td>
                                    <td>{dateStr}</td>
                                    <td style={{ fontWeight: 500 }}>
                                        {q.client_id ? (
                                            <Link href={`/people/clients/${q.client_id}`} style={{ color: "var(--primary)", textDecoration: "none" }}>
                                                {q.client_name}
                                            </Link>
                                        ) : q.client_name}
                                    </td>
                                    <td style={{ fontWeight: 600, color: "var(--primary)" }}>{q.project_type || "-"}</td>
                                    <td>
                                        <span className="badge" style={{
                                            backgroundColor: q.project_status === "Completed" ? "#10b981" : q.project_status === "Started" ? "#3b82f6" : "#f59e0b",
                                            color: "white"
                                        }}>
                                            {q.project_status || "Pending"}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: "right", fontWeight: 700, color: balance > 0 ? "#ef4444" : "#10b981" }}>
                                        ₦{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="text-right">
                                        <div className="flex gap-2 justify-end">
                                            <Link href={`/quotations/${q.id}`} className="btn btn-outline p-2" title="View">
                                                <Eye size={16} />
                                            </Link>
                                            <button className="btn btn-danger p-2" onClick={() => handleDelete(q.id)} title="Delete">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </React.Fragment>
                        );
                    })})()}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {meta.page < meta.totalPages && (
                <div style={{ display: "flex", justifyContent: "center", marginTop: "24px" }}>
                    <button 
                        type="button"
                        className="btn btn-outline"
                        disabled={loading}
                        onClick={(e) => { e.preventDefault(); fetchQuotations(meta.page + 1); }}
                        style={{ padding: "10px 24px", minWidth: "200px" }}
                    >
                        {loading ? 'Loading...' : 'Load More'}
                    </button>
                </div>
            )}
        </div>
    );
}





export default function QuotationsPage() {
    return (
        <Suspense fallback={<div style={{ padding: "40px", textAlign: "center" }}>Loading...</div>}>
            <QuotationsContent />
        </Suspense>
    );
}
