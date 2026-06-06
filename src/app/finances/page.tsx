"use client";
import { CreditCard } from "lucide-react";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpDown, Search, Download, Plus, Trash2, X, TrendingDown, Calendar, FileText, Settings as LucideSettings } from "lucide-react";
import { format } from "date-fns";
import { useSearchParams, useRouter } from 'next/navigation';
import { calcGrandTotal, calcNetTotal } from "@/lib/financeUtils";
import { toast } from "@/components/Toast";
import { downloadCsv } from "@/lib/csvUtils";

interface Payment {
    id: number;
    quotation_id: number;
    amount: number;
    date?: string;
    created_at: string;
    note?: string;
    client_name?: string;
    quote_number?: string;
    project_type?: string;
    total_paid?: number;
    sundries?: string | number;
    transportation?: string | number;
    subtotal?: number;
    discount_value?: number;
    discount_type?: 'amount' | 'percent';
}

interface Client {
    id: number;
    name: string;
    phone?: string;
}

type ExpenseItem = {
    id: number;
    category: string;
    amount: number;
    date: string;
    note: string;
};

// Default Categories if none are found in settings
const DEFAULT_CATEGORIES = ["Stock Purchase", "Fuel & Transport", "Salaries & Wages", "Equipment & Tools", "Marketing", "Utility Bills", "Miscellaneous"];

function FinancesContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const tabParam = searchParams.get('tab') as 'payments' | 'expenses' | null;
    const [activeTab, setActiveTab] = useState<'payments' | 'expenses'>(tabParam === 'expenses' ? 'expenses' : 'payments');
    const [perms, setPerms] = useState<{ revenue: boolean; expenses: boolean } | null>(null);

        useEffect(() => {
        async function checkPermissions() {
            try {
                const meRes = await fetch('/api/auth/me');
                if (!meRes.ok) {
                    router.replace('/insights');
                    return;
                }
                const userData = await meRes.json();
                if (!userData.user) {
                    router.replace('/insights');
                    return;
                }

                if (userData.user.role_name === 'Admin') {
                    setPerms({ revenue: true, expenses: true });
                    return;
                }

                const sRes = await fetch(`/api/staff/roles/${userData.user.role_id}/sub-permissions`);
                if (!sRes.ok) {
                    router.replace('/insights');
                    return;
                }
                const allPerms = await sRes.json();
                const financePerms = allPerms.filter((p: any) => p.module === 'Finances');
                
                const rev = !!financePerms.find((p: any) => p.sub_module === 'Revenue')?.allowed;
                const exp = !!financePerms.find((p: any) => p.sub_module === 'Expenses')?.allowed;
                
                setPerms({ revenue: rev, expenses: exp });

                if (!rev && !exp) {
                    router.replace('/insights');
                    return;
                }

                if (tabParam === 'expenses' && !exp) {
                    setActiveTab('payments');
                    router.replace('/finances?tab=payments', { scroll: false }); if (window.scrollY > 80) window.scrollTo({ top: 80, behavior: 'instant' });;
                } else if ((!tabParam || tabParam === 'payments') && !rev && exp) {
                    setActiveTab('expenses');
                    router.replace('/finances?tab=expenses', { scroll: false }); if (window.scrollY > 80) window.scrollTo({ top: 80, behavior: 'instant' });;
                } else if (tabParam === 'payments' || tabParam === 'expenses') {
                    setActiveTab(tabParam);
                }
            } catch (error) {
                console.error("Permission check failed", error);
                router.replace('/insights');
            }
        }
        checkPermissions();
    }, [tabParam, router]);



    // ==========================================
    // PAYMENTS STATE & LOGIC
    // ==========================================
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loadingPayments, setLoadingPayments] = useState(true);
    const [paymentSortConfig, setPaymentSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [paymentSearchTerm, setPaymentSearchTerm] = useState("");

    // New Date Range Filters
    const [paymentStartDate, setPaymentStartDate] = useState("");
    const [paymentEndDate, setPaymentEndDate] = useState("");
 
    // Bulk Payment State
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>("");
    const [clientOutstanding, setClientOutstanding] = useState<any[]>([]);
    const [loadingClientDocs, setLoadingClientDocs] = useState(false);
    const [bulkDate, setBulkDate] = useState(new Date().toISOString().split('T')[0]);
    const [bulkAllocations, setBulkAllocations] = useState<Record<number, string>>({});
    const [savingBulk, setSavingBulk] = useState(false);

    useEffect(() => {
        fetchPayments();
        fetchClients();
    }, []);
 
    const fetchPayments = () => {
        setLoadingPayments(true);
        fetch('/api/payments')
            .then(res => res.json())
            .then(data => {
                setPayments(data);
                setLoadingPayments(false);
            })
            .catch(err => {
                console.error(err);
                setLoadingPayments(false);
            });
    };
 
    const fetchClients = () => {
        fetch('/api/clients')
            .then(res => res.json())
            .then(data => setClients(data))
            .catch(err => console.error(err));
    };

    const handlePaymentSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (paymentSortConfig && paymentSortConfig.key === key && paymentSortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setPaymentSortConfig({ key, direction });
    };

    const filteredPayments = payments.filter(p => {
        const search = paymentSearchTerm.toLowerCase();
        const matchesSearch =
            (p.client_name?.toLowerCase().includes(search)) ||
            (p.quote_number?.toLowerCase().includes(search)) ||
            (p.project_type?.toLowerCase().includes(search)) ||
            (p.note?.toLowerCase().includes(search));

        let matchesDate = true;
        const pDate = p.date ? new Date(p.date) : new Date(p.created_at);
        pDate.setHours(0, 0, 0, 0);

        if (paymentStartDate) {
            const start = new Date(paymentStartDate);
            start.setHours(0, 0, 0, 0);
            if (pDate < start) matchesDate = false;
        }

        if (paymentEndDate) {
            const end = new Date(paymentEndDate);
            end.setHours(23, 59, 59, 999);
            if (pDate > end) matchesDate = false;
        }

        return matchesSearch && matchesDate;
    });

    const sortedPayments = [...filteredPayments].sort((a, b) => {
        if (!paymentSortConfig) return 0;

        const { key, direction } = paymentSortConfig;

        let aValue: any = a[key as keyof Payment];
        let bValue: any = b[key as keyof Payment];

        if (key === 'client_name' || key === 'quote_number' || key === 'project_type' || key === 'note') {
            const aStr = String(aValue || '');
            const bStr = String(bValue || '');
            return direction === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
        } else if (key === 'date' || key === 'created_at') {
            aValue = new Date(a.date || a.created_at).getTime();
            bValue = new Date(b.date || b.created_at).getTime();
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
            return direction === 'asc' ? aValue - bValue : bValue - aValue;
        }

        if (aValue < bValue) return direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    const exportPayments = () => {
        if (sortedPayments.length === 0) return toast.error("No records to export.");

        const headers = ["Date", "Quote ID", "Client Name", "Project Type", "Grand Total", "Amount Paid", "Outstanding", "Note"];
        
        let sumAmount = 0;
        const rows = sortedPayments.map(p => {
            sumAmount += (p.amount || 0);
            const grandTotal = calcGrandTotal(p);
            const balance = grandTotal - (p.total_paid || 0);
            const dateStr = format(new Date(p.date || p.created_at), 'yyyy-MM-dd');

            return [
                dateStr,
                p.quote_number,
                p.client_name,
                p.project_type || "-",
                grandTotal.toFixed(2),
                (p.amount || 0).toFixed(2),
                balance.toFixed(2),
                p.note || "-"
            ];
        });

        // Add summary row
        rows.push(["", "", "", "", "Totals", sumAmount.toFixed(2), "", ""]);

        downloadCsv(headers, rows, "Latuns_Client_Payments");
    };

    const SortIcon = () => <ArrowUpDown size={14} style={{ display: 'inline', marginLeft: '4px', verticalAlign: 'middle', color: 'var(--text-muted)' }} />;
 
    const handleClientChange = async (clientId: string) => {
        setSelectedClientId(clientId);
        if (!clientId) {
            setClientOutstanding([]);
            return;
        }
        setLoadingClientDocs(true);
        try {
            const res = await fetch(`/api/clients/${clientId}`);
            const data = await res.json();
 
            // Filter for roots with balance > 0
            const allQuotes = data.quotations || [];
 
            // Identify children to exclude them from the list
            const childIds = new Set<number>();
            allQuotes.forEach((q: any) => {
                if (q.linked_quotations) {
                    try {
                        const ids = JSON.parse(q.linked_quotations);
                        ids.forEach((id: number) => childIds.add(id));
                    } catch { }
                }
            });
 
            const roots = allQuotes.filter((q: any) => !childIds.has(q.id));
            const outstanding = roots.filter((q: any) => (calcNetTotal(q) - q.total_paid) > 0.01); // 0.01 to avoid precision issues
 
            setClientOutstanding(outstanding);
            const initialAlloc: Record<number, string> = {};
            outstanding.forEach((q: any) => initialAlloc[q.id] = "");
            setBulkAllocations(initialAlloc);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingClientDocs(false);
        }
    };
 
    const handleSaveBulk = async () => {
        const allocations = Object.entries(bulkAllocations)
            .map(([id, amount]) => ({ quotationId: parseInt(id), amount: parseFloat(amount) || 0 }))
            .filter(a => a.amount > 0);
 
        if (allocations.length === 0) return alert("Please enter at least one allocation.");
 
        setSavingBulk(true);
        try {
            const res = await fetch("/api/payments/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientId: selectedClientId, date: bulkDate, allocations })
            });
 
            if (res.ok) {
                setIsBulkModalOpen(false);
                setSelectedClientId("");
                setClientOutstanding([]);
                fetchPayments();
            } else {
                alert("Failed to process bulk payment.");
            }
        } catch (err) {
            alert("Error processing bulk payment.");
        } finally {
            setSavingBulk(false);
        }
    };

    // ==========================================
    // EXPENSES STATE & LOGIC
    // ==========================================
    const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
    const [expenseCategories, setExpenseCategories] = useState<string[]>(DEFAULT_CATEGORIES);
    const [loadingExpenses, setLoadingExpenses] = useState(true);

    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [expenseFormData, setExpenseFormData] = useState({ category: "", amount: "", date: new Date().toISOString().split('T')[0], note: "" });
    const [savingExpense, setSavingExpense] = useState(false);

    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [savingCategory, setSavingCategory] = useState(false);

    // Expense filters
    const [expenseSearchTerm, setExpenseSearchTerm] = useState("");
    const [expenseMonthYearFilter, setExpenseMonthYearFilter] = useState("");

    useEffect(() => {
        fetchSettings();
        fetchExpenses();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch("/api/settings");
            const data = await res.json();
            if (data.expenseCategories) {
                try {
                    const parsed = JSON.parse(data.expenseCategories);
                    setExpenseCategories(parsed);
                    setExpenseFormData(prev => ({ ...prev, category: parsed[0] || "" }));
                } catch (e) {
                    setExpenseFormData(prev => ({ ...prev, category: DEFAULT_CATEGORIES[0] }));
                }
            } else {
                setExpenseFormData(prev => ({ ...prev, category: DEFAULT_CATEGORIES[0] }));
            }
        } catch (error) {
            console.error("Failed to fetch settings", error);
            setExpenseFormData(prev => ({ ...prev, category: DEFAULT_CATEGORIES[0] }));
        }
    };

    const fetchExpenses = async () => {
        setLoadingExpenses(true);
        try {
            const res = await fetch("/api/expenses");
            const data = await res.json();
            setExpenses(data);
        } catch (error) {
            console.error("Failed to fetch expenses", error);
        } finally {
            setLoadingExpenses(false);
        }
    };

    const handleSaveCategory = async () => {
        if (!newCategoryName.trim()) return;
        if (expenseCategories.includes(newCategoryName.trim())) {
            alert("Category already exists.");
            return;
        }

        setSavingCategory(true);
        const updatedCategories = [...expenseCategories, newCategoryName.trim()];

        try {
            const currentSettingsRes = await fetch("/api/settings");
            const currentSettings = await currentSettingsRes.json();

            const updatedSettings = {
                ...currentSettings,
                expenseCategories: JSON.stringify(updatedCategories)
            };

            const res = await fetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatedSettings)
            });

            if (res.ok) {
                setExpenseCategories(updatedCategories);
                setNewCategoryName("");
                toast.success("Category added successfully");
                // Auto-select the newly added category if it's the first one, or if we want to
                if (!expenseFormData.category) {
                    setExpenseFormData(prev => ({ ...prev, category: updatedCategories[0] }));
                }
            } else {
                toast.error("Failed to save category");
            }
        } catch (e) {
            toast.error("Error saving category");
        } finally {
            setSavingCategory(false);
        }
    };

    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [categoryToRename, setCategoryToRename] = useState<{ old: string, new: string } | null>(null);

    const handleDeleteCategory = async (catToDelete: string) => {
        if (!confirm(`Are you sure you want to delete the category "${catToDelete}"? Existing expenses will retain it.`)) return;

        setSavingCategory(true);
        const updatedCategories = expenseCategories.filter(c => c !== catToDelete);

        try {
            const currentSettingsRes = await fetch("/api/settings");
            const currentSettings = await currentSettingsRes.json();

            const updatedSettings = {
                ...currentSettings,
                expenseCategories: JSON.stringify(updatedCategories)
            };

            const res = await fetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatedSettings)
            });

            if (res.ok) {
                setExpenseCategories(updatedCategories);
                toast.success("Category deleted");
                if (expenseFormData.category === catToDelete && updatedCategories.length > 0) {
                    setExpenseFormData(prev => ({ ...prev, category: updatedCategories[0] }));
                } else if (updatedCategories.length === 0) {
                    setExpenseFormData(prev => ({ ...prev, category: "" }));
                }
            } else {
                toast.error("Failed to delete category");
            }
        } catch (e) {
            toast.error("Error deleting category");
        } finally {
            setSavingCategory(false);
        }
    };
 
    const handleRenameCategory = async () => {
        if (!categoryToRename || !categoryToRename.new.trim() || categoryToRename.new === categoryToRename.old) {
            setIsRenameModalOpen(false);
            return;
        }
 
        setSavingCategory(true);
        const oldName = categoryToRename.old;
        const newName = categoryToRename.new.trim();
        const updatedCategories = expenseCategories.map(c => c === oldName ? newName : c);
 
        try {
            const currentSettingsRes = await fetch("/api/settings");
            const currentSettings = await currentSettingsRes.json();
 
            const updatedSettings = {
                ...currentSettings,
                expenseCategories: JSON.stringify(updatedCategories),
                oldCategoryName: oldName,
                newCategoryName: newName
            };
 
            const res = await fetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatedSettings)
            });
 
            if (res.ok) {
                setExpenseCategories(updatedCategories);
                toast.success("Category renamed and expenses updated");
                fetchExpenses(); // Refresh to see updated category names
                setIsRenameModalOpen(false);
            } else {
                toast.error("Failed to rename category");
            }
        } catch (e) {
            toast.error("Error renaming category");
        } finally {
            setSavingCategory(false);
        }
    };

    const handleExpenseSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingExpense(true);
        try {
            const res = await fetch("/api/expenses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    category: expenseFormData.category,
                    amount: parseFloat(expenseFormData.amount),
                    date: expenseFormData.date,
                    note: expenseFormData.note
                }),
            });

            if (res.ok) {
                await fetchExpenses();
                toast.success("Expense recorded");
                setIsExpenseModalOpen(false);
                setExpenseFormData({ category: expenseCategories[0] || "", amount: "", date: new Date().toISOString().split('T')[0], note: "" });
            } else {
                toast.error("Failed to save expense");
            }
        } catch (error) {
            toast.error("Error saving expense");
        } finally {
            setSavingExpense(false);
        }
    };

    const handleDeleteExpense = async (id: number) => {
        if (!confirm("Are you sure you want to delete this expense permanently?")) return;
        try {
            const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("Expense deleted");
                fetchExpenses();
            }
        } catch (error) {
            toast.error("Error deleting expense");
        }
    };

    // Filter Expenses
    const filteredExpenses = expenses.filter(exp => {
        const search = expenseSearchTerm.toLowerCase();
        const matchesSearch =
            (exp.category.toLowerCase().includes(search)) ||
            (exp.note?.toLowerCase().includes(search));

        let matchesDate = true;
        if (expenseMonthYearFilter) {
            const d = new Date(exp.date);
            const yyyyMM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            matchesDate = yyyyMM === expenseMonthYearFilter;
        }

        return matchesSearch && matchesDate;
    });

    const totalFilteredExpenses = Math.round((filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0) + Number.EPSILON) * 100) / 100;

    const exportExpenses = () => {
        if (filteredExpenses.length === 0) return toast.error("No expenses to export.");

        const headers = ["Date", "Category", "Note/Description", "Amount"];
        
        let sumAmount = 0;
        const rows = filteredExpenses.map(exp => {
            sumAmount += exp.amount;
            const dateStr = format(new Date(exp.date), 'yyyy-MM-dd');
            return [
                dateStr,
                exp.category,
                exp.note || "-",
                exp.amount.toFixed(2)
            ];
        });

        // Add summary row
        rows.push(["", "Total", "", sumAmount.toFixed(2)]);

        downloadCsv(headers, rows, "Latuns_Expenses_Ledger");
    };

    if (!perms) return <div className="p-8 text-center">Verifying permissions...</div>;

    return (
        <div>
            <div className="page-header mb-5">
                <div className="page-header-title-container">
                    <div className="page-header-icon bg-emerald-500">
                        <CreditCard size={24} />
                    </div>
                    <div>
                        <h1 className="page-title mb-0">Financial Hub</h1>
                        <p className="page-description">Manage incoming client payments and outgoing business expenses</p>
                    </div>
                    {/* TAB SELECTOR */}
            <div className="tab-bar">
                {perms?.revenue && (
                    <button
                        onClick={() => { setActiveTab('payments'); router.replace('/finances?tab=payments', { scroll: false }); if (window.scrollY > 80) window.scrollTo({ top: 80, behavior: 'instant' });; }}
                        className={`tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
                    >
                        Client Payments
                    </button>
                )}
                {perms?.expenses && (
                    <button
                        onClick={() => { setActiveTab('expenses'); router.replace('/finances?tab=expenses', { scroll: false }); if (window.scrollY > 80) window.scrollTo({ top: 80, behavior: 'instant' });; }}
                        className={`tab-btn ${activeTab === 'expenses' ? 'active' : ''}`}
                    >
                        <TrendingDown size={16} color={activeTab === 'expenses' ? '#ef4444' : 'currentColor'} /> Outgoing Expenses
                    </button>
                )}
            </div>
                </div>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    {activeTab === 'payments' && (
                        <>
                            <button className="btn btn-outline" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }} onClick={() => setIsBulkModalOpen(true)}>
                                <Plus size={16} /> Bulk Payment
                            </button>
                            <button className="btn btn-outline" onClick={exportPayments}>
                                <Download size={16} /> Export Payments CSV
                            </button>
                        </>
                    )}
                    {activeTab === 'expenses' && (
                        <>
                            <div className="header-valuation-card" style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", padding: "10px 16px", borderRadius: "8px", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
                                <span style={{ fontSize: "13px", color: "#ef4444", fontWeight: 700, marginRight: "8px" }}>Total Outgoing</span>
                                <span style={{ fontSize: "18px", color: "#ef4444", fontWeight: 800 }}>₦{totalFilteredExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <button className="btn btn-outline" onClick={exportExpenses}>
                                <Download size={16} /> Export Expenses
                            </button>
                            <button className="btn btn-primary" onClick={() => setIsExpenseModalOpen(true)}>
                                <Plus size={16} /> Record Expense
                            </button>
                        </>
                    )}
                </div>
            </div>

            

            {/* PAYMENTS CONTENT */}
            {activeTab === 'payments' && (
                <div>
                    <div className="card mb-6 flex gap-4 p-4 items-center">
                        <div className="search-wrapper flex-1">
                            <div className="search-icon">
                                <Search size={18} />
                            </div>
                            <input
                                type="text"
                                className="form-control search-input"
                                placeholder="Search by Client Name, Quote # or Note"
                                value={paymentSearchTerm}
                                onChange={e => setPaymentSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2 items-center">
                            <div className="flex flex-col">
                                <input
                                    type="date"
                                    className="form-control p-2 w-[140px]"
                                    value={paymentStartDate}
                                    onChange={e => setPaymentStartDate(e.target.value)}
                                />
                            </div>
                            <span className="text-muted font-semibold">-</span>
                            <div className="flex flex-col">
                                <input
                                    type="date"
                                    className="form-control p-2 w-[140px]"
                                    value={paymentEndDate}
                                    onChange={e => setPaymentEndDate(e.target.value)}
                                />
                            </div>
                            {(paymentStartDate || paymentEndDate) && (
                                <button
                                    className="btn btn-outline"
                                    style={{ padding: '8px', alignSelf: 'flex-end', height: '38px' }}
                                    onClick={() => { setPaymentStartDate(""); setPaymentEndDate(""); }}
                                    title="Clear Dates"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="table-wrapper">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th onClick={() => handlePaymentSort('date')} style={{ cursor: 'pointer' }}>
                                        Date <SortIcon />
                                    </th>
                                    <th onClick={() => handlePaymentSort('quote_number')} style={{ cursor: 'pointer' }}>
                                        Quote ID <SortIcon />
                                    </th>
                                    <th onClick={() => handlePaymentSort('client_name')} style={{ cursor: 'pointer' }}>
                                        Client Name <SortIcon />
                                    </th>
                                    <th onClick={() => handlePaymentSort('project_type')} style={{ cursor: 'pointer' }}>
                                        Project Type <SortIcon />
                                    </th>
                                    <th style={{ textAlign: "right" }}>
                                        Grand Total
                                    </th>
                                    <th onClick={() => handlePaymentSort('amount')} style={{ cursor: 'pointer', textAlign: "right" }}>
                                        Amount Paid <SortIcon />
                                    </th>
                                    <th style={{ textAlign: "right" }}>
                                        Outstanding
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingPayments ? (
                                    <tr><td colSpan={7} style={{ textAlign: "center", padding: "32px" }}>Loading payment records...</td></tr>
                                ) : sortedPayments.length === 0 ? (
                                    <tr><td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>No payment records found.</td></tr>
                                ) : (
                                    sortedPayments.map((p) => {
                                        const grandTotal = calcGrandTotal(p);
                                        const balance = grandTotal - (p.total_paid || 0);

                                        return (
                                            <tr key={p.id}>
                                                <td>{format(new Date(p.date || p.created_at), 'MMM d, yyyy')}</td>
                                                <td style={{ fontWeight: 600, color: "var(--text-muted)" }}>{p.quote_number || `#QC-${String(p.quotation_id).padStart(4, '0')}`}</td>
                                                <td style={{ fontWeight: 500 }}>
                                                    <Link href={`/quotations/${p.quotation_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                                        {p.client_name}
                                                    </Link>
                                                </td>
                                                <td style={{ fontWeight: 600, color: "var(--primary)" }}>{p.project_type || "-"}</td>
                                                <td style={{ textAlign: "right", fontWeight: 600 }}>
                                                     ₦{(grandTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                                <td style={{ textAlign: "right", fontWeight: 700, color: "var(--success)" }}>
                                                     ₦{p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                                <td style={{ textAlign: "right", fontWeight: 700, color: balance > 0 ? "var(--accent)" : "var(--success)" }}>
                                                     ₦{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
             )}

             {/* EXPENSES CONTENT */}
             {activeTab === 'expenses' && (
                 <div>
                     <div className="card mb-6 flex gap-4 p-4 items-center">
                         <div className="search-wrapper flex-1">
                             <div className="search-icon">
                                 <Search size={18} />
                             </div>
                             <input
                                 type="text"
                                 className="form-control search-input"
                                 placeholder="Search by Note / Description..."
                                 value={expenseSearchTerm}
                                 onChange={e => setExpenseSearchTerm(e.target.value)}
                             />
                         </div>
                         <div className="flex gap-2 items-center">
                             <div className="flex flex-col">
                                 <label className="text-xs font-semibold text-muted">Filter by Month</label>
                                 <input
                                     type="month"
                                     className="form-control"
                                     style={{ height: '38px', fontSize: '13px' }}
                                     value={expenseMonthYearFilter}
                                     onChange={e => setExpenseMonthYearFilter(e.target.value)}
                                 />
                             </div>
                             {(expenseMonthYearFilter) && (
                                 <button
                                     className="btn btn-outline"
                                     style={{ padding: '8px', alignSelf: 'flex-end', height: '38px' }}
                                     onClick={() => setExpenseMonthYearFilter("")}
                                     title="Clear Date"
                                 >
                                     <X size={16} />
                                 </button>
                             )}
                         </div>
                         <button className="btn btn-outline" style={{ alignSelf: 'flex-end', height: '38px' }} onClick={() => setIsCategoryModalOpen(true)}>
                             <LucideSettings size={16} /> Manage Categories
                         </button>
                     </div>

                     <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                         <table className="table" style={{ width: "100%", fontSize: "14px" }}>
                             <thead>
                                 <tr>
                                     <th>Date</th>
                                     <th>Category</th>
                                     <th>Note / Description</th>
                                     <th style={{ textAlign: "right" }}>Amount (₦)</th>
                                     <th style={{ width: "80px", textAlign: "right" }}></th>
                                 </tr>
                             </thead>
                             <tbody>
                                 {loadingExpenses ? (
                                     <tr><td colSpan={5} style={{ textAlign: "center", padding: "32px" }}>Loading expenses...</td></tr>
                                 ) : filteredExpenses.length === 0 ? (
                                     <tr><td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>No expenses recorded for this selection.</td></tr>
                                 ) : (
                                     filteredExpenses.map(exp => (
                                         <tr key={exp.id}>
                                             <td style={{ fontWeight: 500 }}><Calendar size={14} style={{ display: 'inline', marginRight: '6px', color: 'var(--text-muted)' }} />{format(new Date(exp.date), 'MMM d, yyyy')}</td>
                                             <td><span className="badge bg-[var(--sidebar-hover)] text-[var(--text-muted)]">{exp.category}</span></td>
                                             <td style={{ color: "var(--text-muted)" }}><FileText size={14} style={{ display: 'inline', marginRight: '6px', color: '#cbd5e1' }} />{exp.note || "-"}</td>
                                             <td style={{ textAlign: "right", fontWeight: 700, color: '#b91c1c' }}>{exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                             <td style={{ textAlign: "right" }}>
                                                 <button className="btn btn-outline" style={{ padding: "6px", color: '#ef4444', borderColor: '#fee2e2' }} onClick={() => handleDeleteExpense(exp.id)} title="Delete Expense">
                                                     <Trash2 size={16} />
                                                 </button>
                                             </td>
                                         </tr>
                                     ))
                                 )}
                             </tbody>
                         </table>
                     </div>
                 </div>
             )}

             {/* BULK PAYMENT MODAL */}
             {isBulkModalOpen && (
                 <div className="modal-overlay" onClick={() => setIsBulkModalOpen(false)}>
                     <div className="modal-content" style={{ maxWidth: "700px" }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Record Bulk Payment</div>
                            <button className="btn-close" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setIsBulkModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>
 
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Select Client</label>
                                <select className="form-control" value={selectedClientId} onChange={e => handleClientChange(e.target.value)}>
                                    <option value="">-- Select Client --</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
 
                            {selectedClientId && (
                                <>
                                    <div className="form-group">
                                        <label className="form-label">Payment Date</label>
                                        <input type="date" className="form-control" value={bulkDate} onChange={e => setBulkDate(e.target.value)} />
                                    </div>
 
                                    <div className="card" style={{ padding: 0, marginTop: "20px", overflow: "hidden" }}>
                                        <h3 style={{ fontSize: "14px", padding: "12px 16px", borderBottom: "1px solid var(--border)", margin: 0, backgroundColor: "var(--row-odd)" }}>Outstanding Projects</h3>
                                        {loadingClientDocs ? (
                                            <div style={{ padding: "20px", textAlign: "center" }}>Loading projects...</div>
                                        ) : clientOutstanding.length === 0 ? (
                                            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>No outstanding projects for this client.</div>
                                        ) : (
                                            <table className="table" style={{ margin: 0 }}>
                                                <thead>
                                                    <tr>
                                                        <th>Project</th>
                                                        <th style={{ textAlign: "right" }}>Outstanding</th>
                                                        <th style={{ width: "160px", textAlign: "right" }}>Payment Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {clientOutstanding.map(q => {
                                                        const outstanding = calcNetTotal(q) - q.total_paid;
                                                        return (
                                                            <tr key={q.id}>
                                                                <td>
                                                                    <div style={{ fontWeight: 600 }}>{q.quote_number}</div>
                                                                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{q.project_type}</div>
                                                                </td>
                                                                <td style={{ textAlign: "right", fontWeight: 600 }}>₦{outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                                <td>
                                                                    <input
                                                                        type="number"
                                                                        className="form-control"
                                                                        placeholder="0.00"
                                                                        style={{ textAlign: "right" }}
                                                                        value={bulkAllocations[q.id] || ""}
                                                                        onChange={e => setBulkAllocations({ ...bulkAllocations, [q.id]: e.target.value })}
                                                                    />
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                <tfoot>
                                                    <tr style={{ backgroundColor: "var(--row-odd)" }}>
                                                        <td style={{ fontWeight: 700 }}>Total To Record</td>
                                                        <td colSpan={2} style={{ textAlign: "right", fontSize: "18px", fontWeight: 800, color: "var(--primary)" }}>
                                                            ₦{(Math.round((Object.values(bulkAllocations).reduce((acc, val) => acc + (parseFloat(val) || 0), 0) + Number.EPSILON) * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
 
                        <div className="modal-footer" style={{ marginTop: "20px" }}>
                            <button className="btn btn-outline" onClick={() => setIsBulkModalOpen(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSaveBulk} disabled={savingBulk || !selectedClientId || clientOutstanding.length === 0}>
                                {savingBulk ? "Processing..." : "Record Bulk Payment"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
 
            {/* RECORD EXPENSE MODAL */}
            {isExpenseModalOpen && (
                <div className="modal-overlay" onClick={() => setIsExpenseModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <form onSubmit={handleExpenseSubmit}>
                            <div className="modal-header">
                                <div className="modal-title">Record Expense</div>
                                <button type="button" className="btn" style={{ padding: "4px", background: "transparent" }} onClick={() => setIsExpenseModalOpen(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Category</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <select className="form-control" value={expenseFormData.category} onChange={e => setExpenseFormData({ ...expenseFormData, category: e.target.value })} required>
                                            {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <button type="button" className="btn btn-outline" onClick={() => { setIsExpenseModalOpen(false); setIsCategoryModalOpen(true); }} title="Manage Categories">
                                            <LucideSettings size={18} />
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Amount (₦)</label>
                                    <input type="number" min="0" step="any" className="form-control" value={expenseFormData.amount} onChange={e => setExpenseFormData({ ...expenseFormData, amount: e.target.value })} required autoFocus />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Date</label>
                                    <input type="date" className="form-control" value={expenseFormData.date} onChange={e => setExpenseFormData({ ...expenseFormData, date: e.target.value })} required />
                                </div>
                                <div className="form-group mb-0">
                                    <label className="form-label">Description / Note</label>
                                    <input type="text" className="form-control" placeholder="e.g. Bought 50 bags of cement..." value={expenseFormData.note} onChange={e => setExpenseFormData({ ...expenseFormData, note: e.target.value })} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setIsExpenseModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={savingExpense}>{savingExpense ? "Recording..." : "Save Expense"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MANAGE CATEGORIES MODAL */}
            {isCategoryModalOpen && (
                <div className="modal-overlay" onClick={() => setIsCategoryModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Manage Expense Categories</div>
                            <button type="button" className="btn" style={{ padding: "4px", background: "transparent" }} onClick={() => setIsCategoryModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="New Category Name..."
                                    value={newCategoryName}
                                    onChange={e => setNewCategoryName(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleSaveCategory();
                                        }
                                    }}
                                />
                                <button type="button" className="btn btn-primary" onClick={handleSaveCategory} disabled={savingCategory || !newCategoryName.trim()}>
                                    Add
                                </button>
                            </div>

                            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                                {expenseCategories.map(cat => (
                                    <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                                        <span style={{ fontWeight: 500 }}>{cat}</span>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button
                                                type="button"
                                                className="btn btn-outline"
                                                style={{ padding: '6px', color: 'var(--primary)', borderColor: 'transparent' }}
                                                onClick={() => { setCategoryToRename({ old: cat, new: cat }); setIsRenameModalOpen(true); }}
                                                disabled={savingCategory}
                                                title="Rename Category"
                                            >
                                                <FileText size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-outline"
                                                style={{ padding: '6px', color: '#ef4444', borderColor: 'transparent' }}
                                                onClick={() => handleDeleteCategory(cat)}
                                                disabled={savingCategory}
                                                title="Delete Category"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {expenseCategories.length === 0 && (
                                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>No categories defined.</div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-outline" onClick={() => setIsCategoryModalOpen(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* RENAME CATEGORY MODAL */}
            {isRenameModalOpen && categoryToRename && (
                <div className="modal-overlay" onClick={() => setIsRenameModalOpen(false)}>
                    <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Rename Category</div>
                            <button type="button" className="btn" style={{ padding: "4px", background: "transparent" }} onClick={() => setIsRenameModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">New name for &quot;{categoryToRename.old}&quot;</label>
                                <input 
                                    type="text" 
                                    className="form-control" 
                                    value={categoryToRename.new} 
                                    onChange={e => setCategoryToRename({ ...categoryToRename, new: e.target.value })}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleRenameCategory();
                                        }
                                    }}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-outline" onClick={() => setIsRenameModalOpen(false)}>Cancel</button>
                            <button 
                                type="button" 
                                className="btn btn-primary" 
                                onClick={handleRenameCategory} 
                                disabled={savingCategory || !categoryToRename.new.trim() || categoryToRename.new === categoryToRename.old}
                            >
                                {savingCategory ? "Renaming..." : "Rename Category"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function FinancesPage() {
    return (
        <Suspense fallback={<div style={{ padding: "40px", textAlign: "center" }}>Loading Financial Hub...</div>}>
            <FinancesContent />
        </Suspense>
    );
}
