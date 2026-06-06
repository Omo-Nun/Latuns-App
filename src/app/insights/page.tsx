"use client";

import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from "date-fns";
import { Download, Trash2, Save, Plus, BarChart3 } from "lucide-react";

const COLORS = ['#1D4ED8', '#E11D48', '#d97706', '#15803d', '#4338ca', '#be123c', '#047857'];

export default function InsightsPage() {
    const [rawQuotes, setRawQuotes] = useState<any[]>([]);
    const [rawExpenses, setRawExpenses] = useState<any[]>([]);
    const [savedCharts, setSavedCharts] = useState<any[]>([]);
    const [dashboardData, setDashboardData] = useState<any>(null);
    const [performanceData, setPerformanceData] = useState<{estimators: any[], conversion: any[]}>({ estimators: [], conversion: [] });
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [liveTileIndex, setLiveTileIndex] = useState(0);
    const [dateFilter, setDateFilter] = useState(""); // yyyy-MM

    // Data Explorer State
    const [explorerGroupBy, setExplorerGroupBy] = useState("project_type");
    const [explorerStartDate, setExplorerStartDate] = useState("");
    const [explorerEndDate, setExplorerEndDate] = useState("");
    const [explorerMetric, setExplorerMetric] = useState("finances"); // count or finances

    // Chart Builder State
    const [dataSource, setDataSource] = useState("quotes"); // quotes or expenses
    const [chartName, setChartName] = useState("");
    const [xAxis, setXAxis] = useState("client_state");
    const [yAxis, setYAxis] = useState("count");
    const [chartType, setChartType] = useState("bar");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (!settings) return;

        let intervalMs = 3000;
        if (settings.liveTileInterval) {
            const parsed = parseInt(settings.liveTileInterval, 10);
            if (!isNaN(parsed) && parsed > 0) {
                // Settings UI uses milliseconds
                intervalMs = parsed;
            }
        }

        const timer = setInterval(() => {
            setLiveTileIndex(prev => (prev + 1) % 3); // 0 = Outstanding, 1 = Paid, 2 = Net Profit
        }, intervalMs);
        return () => clearInterval(timer);
    }, [settings]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [quotesRes, chartsRes, dashRes, settingsRes] = await Promise.all([
                fetch("/api/insights"),
                fetch("/api/charts"),
                fetch("/api/dashboard?filter=all"),
                fetch("/api/settings")
            ]);
            const insightsPayload = await quotesRes.json();
            setRawQuotes(insightsPayload.quotes);
            setRawExpenses(insightsPayload.expenses);
            setPerformanceData({
                estimators: insightsPayload.estimators || [],
                conversion: insightsPayload.conversion || []
            });
            const charts = await chartsRes.json();
            const parsedCharts = Array.isArray(charts) ? charts.map((c: any) => {
                let config = c.config;
                if (typeof config === 'string') {
                    try {
                        config = JSON.parse(config);
                    } catch (e) {
                        config = {};
                    }
                }
                return { ...c, config: config || {} };
            }) : [];
            setSavedCharts(parsedCharts);
            setDashboardData(await dashRes.json());
            setSettings(await settingsRes.json());
        } catch (e) {
            console.error("Failed to load insights data", e);
        } finally {
            setLoading(false);
        }
    };

    const generateChartData = (sourceConfig: string, xAxisConfig: string, yAxisConfig: string) => {
        const grouped: Record<string, number> = {};

        if (sourceConfig === "quotes") {
            const filtered = rawQuotes.filter(q => {
                if (!dateFilter) return true;
                const d = new Date(q.created_at);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === dateFilter;
            });

            filtered.forEach(q => {
                let key = "Unknown";
                if (xAxisConfig === "client_state") key = q.client_state || "Unspecified";
                if (xAxisConfig === "client_city") key = q.client_city || "Unspecified";
                if (xAxisConfig === "subsidiary_name") key = q.subsidiary_name;
                if (xAxisConfig === "project_status") key = q.project_status || "Pending";
                if (xAxisConfig === "project_type") key = q.project_type || "Unspecified";
                if (xAxisConfig === "visit_status") key = q.visit_status || "Unspecified";
                if (xAxisConfig === "estimator_name") key = q.estimator_name || "Unassigned";
                if (xAxisConfig === "month_year") {
                    const d = new Date(q.created_at);
                    key = `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
                }

                if (!grouped[key]) grouped[key] = 0;

                if (yAxisConfig === "count") {
                    grouped[key] += 1;
                } else if (yAxisConfig === "revenue") {
                    grouped[key] += (q.grandTotal || 0);
                }
            });
        } else if (sourceConfig === "expenses") {
            const filtered = rawExpenses.filter(exp => {
                if (!dateFilter) return true;
                const d = new Date(exp.date);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === dateFilter;
            });

            filtered.forEach(exp => {
                let key = "Unknown";
                if (xAxisConfig === "category") key = exp.category || "Uncategorized";
                if (xAxisConfig === "month_year") {
                    const d = new Date(exp.date);
                    key = `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
                }

                if (!grouped[key]) grouped[key] = 0;

                if (yAxisConfig === "count") {
                    grouped[key] += 1;
                } else if (yAxisConfig === "amount") {
                    grouped[key] += (exp.amount || 0);
                }
            });
        }

        // Convert to array and sort
        const dataArray = Object.keys(grouped).map(k => ({
            name: k,
            value: (yAxisConfig === "revenue" || yAxisConfig === "amount") ? Math.round(grouped[k] * 100) / 100 : grouped[k]
        }));

        if (xAxisConfig === "month_year") {
            // Basic sort for month_year
        } else {
            // Sort by value descending
            dataArray.sort((a, b) => b.value - a.value);
        }

        return dataArray;
    };

    const previewData = useMemo(() => generateChartData(dataSource, xAxis, yAxis), [rawQuotes, rawExpenses, dataSource, xAxis, yAxis, dateFilter]);

    const handleSaveChart = async () => {
        if (!chartName.trim()) return alert("Please enter a chart name");
        setSaving(true);
        try {
            const config = { dataSource: dataSource || "quotes", xAxis, yAxis, chartType };
            const res = await fetch("/api/charts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: chartName, config })
            });
            if (res.ok) {
                setChartName("");
                fetchData(); // Reload charts
            } else {
                alert("Failed to save chart");
            }
        } catch (e) {
            alert("Error saving chart");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteChart = async (id: number) => {
        if (!confirm("Delete this saved chart?")) return;
        try {
            const res = await fetch(`/api/charts/${id}`, { method: "DELETE" });
            if (res.ok) fetchData();
        } catch (e) {
            alert("Error deleting chart");
        }
    };

    const getExplorerData = () => {
        const filtered = rawQuotes.filter(q => {
            const qDate = new Date(q.created_at).toISOString().split('T')[0];
            if (explorerStartDate && qDate < explorerStartDate) return false;
            if (explorerEndDate && qDate > explorerEndDate) return false;
            return true;
        });

        const grouped: Record<string, { count: number, value: number, paid: number, balance: number }> = {};

        filtered.forEach(q => {
            let key = q[explorerGroupBy as keyof typeof q] || "Unspecified";
            if (explorerGroupBy === "month_year") {
                const d = new Date(q.created_at);
                key = `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
            }

            if (!grouped[key]) grouped[key] = { count: 0, value: 0, paid: 0, balance: 0 };
            
            grouped[key].count += 1;
            const val = q.grandTotal || 0;
            const paid = q.total_paid || 0;
            grouped[key].value += val;
            grouped[key].paid += paid;
            grouped[key].balance += (val - paid);
        });

        return Object.keys(grouped).map(k => ({
            name: k,
            ...grouped[k]
        })).sort((a, b) => b.value - a.value);
    };

    const exportExplorerCSV = (data: any[]) => {
        const headers = ["Grouped By", "Count", "Total Value (₦)", "Total Paid (₦)", "Total Balance (₦)"];
        const rows = data.map(d => [
            `"${d.name}"`,
            d.count,
            d.value.toFixed(2),
            d.paid.toFixed(2),
            d.balance.toFixed(2)
        ]);
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Latuns_Data_Explorer_${explorerGroupBy}_${format(new Date(), 'yyyyMMdd')}.csv`;
        a.click();
    };

    const renderChart = (data: any[], type: string, yConfig: string) => {
        const formatYAxis = (val: number) => (yConfig === "revenue" || yConfig === "amount") ? `₦${(val / 1000).toFixed(0)}k` : val.toString();
        const formatTooltip = (val: any) => (yConfig === "revenue" || yConfig === "amount") ? `₦${Number(val).toLocaleString()}` : val;

        if (data.length === 0) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>No Data</div>;

        if (type === "pie") {
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                            {data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={formatTooltip} />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            );
        }

        if (type === "line") {
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickFormatter={formatYAxis} />
                        <Tooltip formatter={formatTooltip} cursor={{ fill: 'var(--bg-color)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }} />
                        <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={3} activeDot={{ r: 8 }} />
                    </LineChart>
                </ResponsiveContainer>
            );
        }

        // Default Bar
        return (
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickFormatter={formatYAxis} />
                    <Tooltip formatter={formatTooltip} cursor={{ fill: 'var(--bg-color)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }} />
                    <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={40}>
                        {data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        );
    };

    if (loading && rawQuotes.length === 0) return <div>Loading insights...</div>;

    return (
        <div>
            <div className="page-header mb-6 flex justify-between items-center">
                <div className="page-header-title-container">
                    <div className="page-header-icon bg-orange-500">
                        <BarChart3 size={24} />
                    </div>
                    <div>
                        <h1 className="page-title">Business Insights</h1>
                        <p className="page-description">Visualize your data by grouping quotations by different metrics</p>
                    </div>
                </div>
                <div className="flex gap-2 items-center">
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Filter Period:</span>
                    <select
                        className="form-control"
                        style={{ width: '180px' }}
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                    >
                        <option value="">All Time</option>
                        {Array.from(new Set([...rawQuotes, ...rawExpenses.map(e => ({ created_at: e.date }))].map(item => {
                            const d = new Date(item.created_at || item.date);
                            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        }))).filter(Boolean).sort().reverse().map(val => {
                            const [y, m] = val.split('-');
                            const d = new Date(parseInt(y), parseInt(m) - 1, 1);
                            return <option key={val} value={val}>{format(d, 'MMMM yyyy')}</option>
                        })}
                    </select>
                </div>
            </div>
            

            {/* Overview Charts */}
            {dashboardData && (
                <div className="grid grid-cols-[1fr_2fr] gap-6 mb-8 relative">

                    {/* Multi-Purpose Live Tile Link Wrapper */}
                    <a href={liveTileIndex === 2 ? "/finances?tab=expenses" : "/finances?tab=payments"} className="no-underline block h-full cursor-pointer">
                        <div className="card" style={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            height: '100%',
                            borderLeft: `4px solid ${liveTileIndex === 0 ? '#f59e0b' : liveTileIndex === 1 ? '#10b981' : '#3b82f6'}`,
                            transition: 'border-color 0.5s ease',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <h3 className="text-muted text-sm mb-2">
                                {liveTileIndex === 0 ? 'Outstanding Balance' : liveTileIndex === 1 ? 'Total Client Payments' : 'Net Business Balance'}
                            </h3>
                            <div style={{
                                fontSize: '32px',
                                fontWeight: '700',
                                color: liveTileIndex === 0 ? '#f59e0b' : liveTileIndex === 1 ? '#10b981' : '#3b82f6',
                                transition: 'color 0.5s ease'
                            }}>
                                {(() => {
                                    const filteredQuotes = rawQuotes.filter(q => {
                                        if (!dateFilter) return true;
                                        const d = new Date(q.created_at);
                                        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === dateFilter;
                                    });
                                    const filteredExpenses = rawExpenses.filter(e => {
                                        if (!dateFilter) return true;
                                        const d = new Date(e.date);
                                        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === dateFilter;
                                    });

                                    const outstanding = Math.round((filteredQuotes.reduce((sum, q) => sum + (q.grandTotal || 0) - (q.total_paid || 0), 0) + Number.EPSILON) * 100) / 100;
                                    const totalPaid = Math.round((filteredQuotes.reduce((sum, q) => sum + (q.total_paid || 0), 0) + Number.EPSILON) * 100) / 100;
                                    const totalExpenses = Math.round((filteredExpenses.reduce((sum, e) => sum + e.amount, 0) + Number.EPSILON) * 100) / 100;

                                    if (liveTileIndex === 0) return `₦${outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                                    if (liveTileIndex === 1) return `₦${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                                    return `₦${(totalPaid - totalExpenses).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                                })()}
                            </div>

                            {/* P&L Sub-metric purely for the 3rd tile */}
                            {liveTileIndex === 2 && (
                                <div className="mt-3 text-xs text-muted flex justify-between border-t border-border pt-3">
                                    {(() => {
                                        const filteredQuotes = rawQuotes.filter(q => {
                                            if (!dateFilter) return true;
                                            const d = new Date(q.created_at);
                                            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === dateFilter;
                                        });
                                        const filteredExpenses = rawExpenses.filter(e => {
                                            if (!dateFilter) return true;
                                            const d = new Date(e.date);
                                            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === dateFilter;
                                        });
                                        const totalPaid = Math.round((filteredQuotes.reduce((sum, q) => sum + (q.total_paid || 0), 0) + Number.EPSILON) * 100) / 100;
                                        const totalExpenses = Math.round((filteredExpenses.reduce((sum, e) => sum + e.amount, 0) + Number.EPSILON) * 100) / 100;
                                        return (
                                            <>
                                                <span className="text-emerald-500">+₦{totalPaid.toLocaleString()}</span>
                                                <span className="text-red-500">-₦{totalExpenses.toLocaleString()}</span>
                                            </>
                                        );
                                    })()}
                                </div>
                            )}

                        </div>
                    </a>
                    <div className="card" style={{ height: '300px' }}>
                        <h2 style={{ fontSize: '16px', marginBottom: '24px', color: 'var(--primary)' }}>Revenue vs Paid (₦)</h2>
                        {(!dashboardData?.chartData || dashboardData.chartData.length === 0) ? (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                No chart data available.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="90%">
                                <BarChart data={dashboardData.chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} dx={-10} tickFormatter={(val) => `₦${(val / 1000).toFixed(0)}k`} />
                                    <Tooltip
                                        formatter={(value: any) => `₦${Number(value).toLocaleString()}`}
                                        cursor={{ fill: 'var(--bg-color)' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }}
                                    />
                                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                                    <Bar dataKey="revenue" name="Total Revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="paid" name="Amount Paid" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            )}

            {/* Performance Dashboard Section */}
            <div className="mb-8">
                <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--primary)", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
                    <BarChart3 size={20} /> Performance & Conversion
                </h2>

                <div className="grid grid-cols-3 gap-6 mb-6">
                    {/* Sales Rep Leaderboard */}
                    <div className="card" style={{ gridColumn: "span 2", height: "350px" }}>
                        <h3 style={{ fontSize: "16px", marginBottom: "20px", color: "var(--text-main)" }}>Sales Leaderboard (by Revenue)</h3>
                        <ResponsiveContainer width="100%" height="80%">
                            <BarChart data={performanceData.estimators} layout="vertical" margin={{ left: 40, right: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="estimator_name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600 }} width={120} />
                                <Tooltip formatter={(val: any) => `₦${val.toLocaleString()}`} cursor={{ fill: 'rgba(29, 78, 216, 0.05)' }} />
                                <Bar dataKey="total_revenue" name="Total Revenue" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={20}>
                                    {performanceData.estimators.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Quick Stats / Conversion Pie */}
                    <div className="card" style={{ height: "350px" }}>
                        <h3 style={{ fontSize: "16px", marginBottom: "20px", color: "var(--text-main)" }}>Project Status Split</h3>
                        <ResponsiveContainer width="100%" height="80%">
                            <PieChart>
                                <Pie
                                    data={(() => {
                                        const counts: any = {};
                                        rawQuotes.forEach(q => {
                                            const status = q.project_status || 'Pending';
                                            counts[status] = (counts[status] || 0) + 1;
                                        });
                                        return Object.entries(counts).map(([name, value]) => ({ name, value: Number(value) }));
                                    })()}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {COLORS.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                    <div className="card" style={{ padding: "20px", borderTop: "4px solid #10b981" }}>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Avg Project Value</div>
                        <div style={{ fontSize: "24px", fontWeight: 800, color: "#10b981", marginTop: "8px" }}>
                            ₦{(() => {
                                const total = Math.round((rawQuotes.reduce((sum, q) => sum + (q.grandTotal || 0), 0) + Number.EPSILON) * 100) / 100;
                                return (total / (rawQuotes.length || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 });
                            })()}
                        </div>
                    </div>
                    <div className="card" style={{ padding: "20px", borderTop: "4px solid #3b82f6" }}>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Active Projects</div>
                        <div style={{ fontSize: "24px", fontWeight: 800, color: "#3b82f6", marginTop: "8px" }}>
                            {rawQuotes.filter(q => q.project_status === 'Started').length}
                        </div>
                    </div>
                    <div className="card" style={{ padding: "20px", borderTop: "4px solid #f59e0b" }}>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Pending Approval</div>
                        <div style={{ fontSize: "24px", fontWeight: 800, color: "#f59e0b", marginTop: "8px" }}>
                            {rawQuotes.filter(q => !q.project_status || q.project_status === 'Pending').length}
                        </div>
                    </div>
                    <div className="card" style={{ padding: "20px", borderTop: "4px solid #ef4444" }}>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Conversion Rate</div>
                        <div style={{ fontSize: "24px", fontWeight: 800, color: "#ef4444", marginTop: "8px" }}>
                            {Math.round((rawQuotes.filter(q => q.project_status === 'Completed').length / (rawQuotes.length || 1)) * 100)}%
                        </div>
                    </div>
                </div>
            </div>

            {/* Advanced Data Explorer: Side-by-Side Panels */}
            <div className="card mb-8 p-0 overflow-hidden">
                <div className="px-6 py-4 border-b flex justify-between items-center bg-[var(--bg-color)]">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <h2 style={{ fontSize: "16px", margin: 0, color: "var(--primary)" }}>Advanced Data Explorer</h2>
                        <span style={{ fontSize: '11px', backgroundColor: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>ACCESS-MODE</span>
                    </div>
                    <button className="btn btn-outline" style={{ fontSize: '13px' }} onClick={() => exportExplorerCSV(getExplorerData())}>
                        <Download size={14} /> Export Table CSV
                    </button>
                </div>
                
                <div style={{ display: "flex", minHeight: "500px" }}>
                    {/* Left Panel: Configuration */}
                    <div className="w-[320px] p-6 border-r bg-[var(--bg-color-alt)]">
                        <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '20px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Query Settings</h3>
                        
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>1. Choose Grouping (Rows)</label>
                            <select className="form-control" value={explorerGroupBy} onChange={e => setExplorerGroupBy(e.target.value)}>
                                <option value="project_type">Project Type (Product)</option>
                                <option value="client_state">Client State (Geography)</option>
                                <option value="client_city">Client City</option>
                                <option value="project_status">Completeness Status</option>
                                <option value="visit_status">Visit Status</option>
                                <option value="estimator_name">Staff / Estimator</option>
                                <option value="subsidiary_name">Subsidiary Company</option>
                                <option value="month_year">Period (Monthly)</option>
                            </select>
                        </div>
                        
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>2. Select Date Range</label>
                            <div className="flex flex-col gap-2">
                                <div className="flex flex-col gap-1">
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>From:</span>
                                    <input type="date" className="form-control" value={explorerStartDate} onChange={e => setExplorerStartDate(e.target.value)} />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>To:</span>
                                    <input type="date" className="form-control" value={explorerEndDate} onChange={e => setExplorerEndDate(e.target.value)} />
                                </div>
                                {(explorerStartDate || explorerEndDate) && (
                                    <button 
                                        onClick={() => { setExplorerStartDate(""); setExplorerEndDate(""); }}
                                        style={{ fontSize: '11px', color: 'var(--primary)', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', padding: '4px 0' }}
                                    >
                                        ✕ Clear Date Filter
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>3. Aggregation Metric</label>
                            <div className="flex flex-col gap-2">
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input type="radio" checked={explorerMetric === 'finances'} onChange={() => setExplorerMetric('finances')} />
                                    Financial Values (₦)
                                </label>
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input type="radio" checked={explorerMetric === 'count'} onChange={() => setExplorerMetric('count')} />
                                    Job Counts Only
                                </label>
                            </div>
                        </div>

                        <div style={{ marginTop: '40px', padding: '16px', backgroundColor: '#f0f9ff', borderRadius: '8px', fontSize: '12px', color: '#0369a1', border: '1px solid #bae6fd' }}>
                            <p style={{ margin: 0, lineHeight: 1.5 }}>
                                <strong>Interactive Mode:</strong> This tool mimics database aggregation. 
                                Change the grouping to see how finances are distributed across different segments of your business.
                            </p>
                        </div>
                    </div>

                    {/* Right Panel: Result Table */}
                    <div className="flex-1 p-6 overflow-x-auto bg-[var(--bg-color-alt)]">
                        <div className="mb-4 flex justify-between items-center">
                            <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>
                                {explorerMetric === 'finances' ? 'Financial Performance' : 'Operational Volume'} by {explorerGroupBy.replace('_', ' ')}
                                {(explorerStartDate || explorerEndDate) && (
                                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: '8px', fontSize: '12px' }}>
                                        ({explorerStartDate || '...'} to {explorerEndDate || '...'})
                                    </span>
                                )}
                            </h3>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                {getExplorerData().length} Segments Found
                            </span>
                        </div>

                        <div className="table-wrapper">
                            <table className="table" style={{ border: '1px solid var(--border)' }}>
                                <thead>
                                    <tr>
                                        <th style={{ backgroundColor: 'var(--bg-color)', color: 'var(--primary)' }}>{explorerGroupBy.replace('_', ' ').toUpperCase()}</th>
                                        <th style={{ textAlign: 'center', backgroundColor: 'var(--bg-color)' }}>{explorerMetric === 'finances' ? 'Jobs' : 'Volume'}</th>
                                        {explorerMetric === 'finances' && (
                                            <>
                                                <th style={{ textAlign: 'right', backgroundColor: 'var(--bg-color)' }}>Total Value (₦)</th>
                                                <th style={{ textAlign: 'right', backgroundColor: 'var(--bg-color)' }}>Total Paid (₦)</th>
                                                <th style={{ textAlign: 'right', backgroundColor: 'var(--bg-color)' }}>Balance (₦)</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {getExplorerData().map((row, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{row.name}</td>
                                            <td style={{ textAlign: 'center' }}>{row.count}</td>
                                            {explorerMetric === 'finances' && (
                                                <>
                                                    <td style={{ textAlign: 'right', fontWeight: 500 }}>{row.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    <td style={{ textAlign: 'right', color: '#10b981' }}>{row.paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{row.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                    {getExplorerData().length === 0 && (
                                        <tr>
                                            <td colSpan={explorerMetric === 'finances' ? 5 : 2} style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>
                                                No records match the current horizon/filter.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                {getExplorerData().length > 0 && (
                                    <tfoot style={{ backgroundColor: 'var(--row-odd)', borderTop: '2px solid var(--border)' }}>
                                        <tr style={{ fontWeight: 800 }}>
                                            <td>GRAND TOTALS</td>
                                            <td style={{ textAlign: 'center' }}>{getExplorerData().reduce((a, b) => a + b.count, 0)}</td>
                                            {explorerMetric === 'finances' && (
                                                <>
                                                    <td style={{ textAlign: 'right' }}>₦{(Math.round((getExplorerData().reduce((a, b) => a + b.value, 0) + Number.EPSILON) * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    <td style={{ textAlign: 'right' }}>₦{(Math.round((getExplorerData().reduce((a, b) => a + b.paid, 0) + Number.EPSILON) * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    <td style={{ textAlign: 'right' }}>₦{(Math.round((getExplorerData().reduce((a, b) => a + b.balance, 0) + Number.EPSILON) * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                </>
                                            )}
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Builder Section */}
            <div className="card mb-8">
                <h2 style={{ fontSize: "16px", marginBottom: "20px", color: "var(--primary)" }}>Custom Chart Builder</h2>

                <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-6">
                    <div className="form-group">
                        <label className="form-label">Data Source</label>
                        <select className="form-control" value={dataSource} onChange={e => {
                            const newSource = e.target.value;
                            setDataSource(newSource);
                            if (newSource === "expenses") {
                                setXAxis("category");
                                setYAxis("amount");
                            } else {
                                setXAxis("client_state");
                                setYAxis("count");
                            }
                        }}>
                            <option value="quotes">Quotations & Revenue</option>
                            <option value="expenses">Outgoing Expenses</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Grouping (X-Axis)</label>
                        <select className="form-control" value={xAxis} onChange={e => setXAxis(e.target.value)}>
                            {dataSource === "quotes" ? (
                                <>
                                    <option value="client_state">Client State</option>
                                    <option value="client_city">Client City</option>
                                    <option value="subsidiary_name">Subsidiary Company</option>
                                    <option value="project_type">Project Type (Roofing Mode)</option>
                                    <option value="project_status">Project Status</option>
                                    <option value="visit_status">Quotation / Visit Status</option>
                                    <option value="estimator_name">Roof Estimator (Sales Rep)</option>
                                    <option value="month_year">Month & Year Created</option>
                                </>
                            ) : (
                                <>
                                    <option value="category">Expense Category</option>
                                    <option value="month_year">Month & Year Recorded</option>
                                </>
                            )}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Metric (Y-Axis)</label>
                        <select className="form-control" value={yAxis} onChange={e => setYAxis(e.target.value)}>
                            {dataSource === "quotes" ? (
                                <>
                                    <option value="count">Number of Quotes</option>
                                    <option value="revenue">Total Revenue (₦)</option>
                                </>
                            ) : (
                                <>
                                    <option value="count">Number of Expenses</option>
                                    <option value="amount">Total Amount (₦)</option>
                                </>
                            )}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Chart Type</label>
                        <select className="form-control" value={chartType} onChange={e => setChartType(e.target.value)}>
                            <option value="bar">Bar Chart</option>
                            <option value="line">Line Chart</option>
                            <option value="pie">Pie Chart</option>
                        </select>
                    </div>
                </div>

                <div style={{ height: "300px", marginTop: "20px", marginBottom: "24px", padding: "16px", backgroundColor: "var(--row-odd)", borderRadius: "8px", border: "1px dashed var(--border)" }}>
                    {renderChart(previewData, chartType, yAxis)}
                </div>

                <div className="flex gap-3 items-end max-w-[400px]">
                    <div className="form-group mb-0 flex-1">
                        <input
                            type="text"
                            className="form-control"
                            placeholder="My Saved Chart Name..."
                            value={chartName}
                            onChange={e => setChartName(e.target.value)}
                        />
                    </div>
                    <button className="btn btn-primary" onClick={handleSaveChart} disabled={saving || !chartName.trim()}>
                        <Save size={16} /> Save
                    </button>
                </div>
            </div>

            {/* Saved Charts Grid */}
            {savedCharts.length > 0 && (
                <div>
                    <h2 style={{ fontSize: "20px", marginBottom: "20px", fontWeight: 600 }}>Saved Reports</h2>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(400px,1fr))] gap-6">
                        {savedCharts.map(c => {
                            const config = c.config || {};
                            const ds = config.dataSource || "quotes";
                            const xa = config.xAxis || (ds === "quotes" ? "client_state" : "category");
                            const ya = config.yAxis || (ds === "quotes" ? "count" : "amount");
                            const ct = config.chartType || "bar";
                            
                            const chartData = generateChartData(ds, xa, ya);

                            return (
                                <div key={c.id} className="card" style={{ height: "340px", position: "relative", display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                                        <div>
                                            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--primary)", margin: 0 }}>{c.name}</h3>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                {ds === 'quotes' ? 'Quotations' : 'Expenses'} • By {xa.replace('_', ' ')}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteChart(c.id)}
                                            className="btn"
                                            style={{ padding: "4px", color: "var(--text-muted)", backgroundColor: "transparent" }}
                                            title="Delete Chart"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <div style={{ flex: 1, minHeight: 0 }}>
                                        {renderChart(chartData, ct, ya)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

        </div>
    );
}
