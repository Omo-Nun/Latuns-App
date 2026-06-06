"use client";

import { useState, useEffect, useRef, memo, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";

import { ArrowLeft, Download, Image as ImageIcon, Plus, Edit, Trash2, Printer, MapPin, CheckSquare, Check } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "@/components/Toast";
import { AlertCircle, X } from "lucide-react";
import { numberToWords } from "@/lib/numberToWords";
import { calcGrandTotal, calcNetTotal, isCompositeDoc } from "@/lib/financeUtils";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { DEFAULT_TEMPLATE, type QuotationTemplate } from "@/app/settings/quotation-template/page";
import { QuotationPrintTemplate } from "@/app/components/QuotationPrintTemplate";

// Derive the active template for a given project type from raw settings data
function resolveTemplate(settingsData: any, projectType?: string): QuotationTemplate {
    if (!settingsData?.quotationTemplates) return { ...DEFAULT_TEMPLATE };
    try {
        const parsed = typeof settingsData.quotationTemplates === 'string' 
            ? JSON.parse(settingsData.quotationTemplates) 
            : settingsData.quotationTemplates;
        const configs = parsed.configs || {};
        if (projectType) {
            const key = projectType.toLowerCase().replace(/\s+/g, "_");
            if (configs[key]) return { ...DEFAULT_TEMPLATE, ...configs[key] };
        }
        if (configs["default"]) return { ...DEFAULT_TEMPLATE, ...configs["default"] };
    } catch { }
    return { ...DEFAULT_TEMPLATE };
}

export default function QuotationDetailPage() {
    const { id } = useParams();
    const router = useRouter();

    const [data, setData] = useState<any>(null);
    const [tasks, setTasks] = useState<any[]>([]);
    const [settings, setSettings] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    // New Task states for this quote
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [newTask, setNewTask] = useState({ text: '', assigned_to: null as number | null, priority: 'medium' as 'low' | 'medium' | 'high' });
    const [users, setUsers] = useState<any[]>([]);

    const activeTemplate = useMemo(() => resolveTemplate(settings, data?.project_type), [settings, data?.project_type]);

    const exportRef = useRef<HTMLDivElement>(null);

    // Payment Modal State
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [payAmount, setPayAmount] = useState("");
    const [payNote, setPayNote] = useState("");
    const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
    const [savingPay, setSavingPay] = useState(false);
    const [payMode, setPayMode] = useState<'add' | 'edit'>('add');
    const [editPaymentId, setEditPaymentId] = useState<number | null>(null);

    // Print State
    const [printMode, setPrintMode] = useState<'none' | 'quote' | 'ledger'>('none');

    const ledgerExportRef = useRef<HTMLDivElement>(null);

    // Custom Confirmation State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        confirmText: string;
        isDestructive?: boolean;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        confirmText: '',
        onConfirm: () => { }
    });

    useEffect(() => {
        Promise.all([
            fetch(`/api/quotations/${id}`).then(res => res.json()),
            fetch(`/api/settings`).then(res => res.json()),
            fetch(`/api/tasks?quotation_id=${id}`).then(res => res.json()),
            fetch(`/api/users`).then(res => res.json())
        ]).then(([quoteData, settingsData, taskData, userData]) => {
            if (quoteData.error) {
                toast.error(quoteData.error);
                router.push("/quotations");
                return;
            }
            setData(quoteData);
            setSettings(settingsData);
            setTasks(taskData);
            setUsers(userData);
            setLoading(false);
        }).catch(err => {
            toast.error("Failed to load quotation details");
            setLoading(false);
        });
    }, [id, router]);

    const fetchTasks = async () => {
        const res = await fetch(`/api/tasks?quotation_id=${id}`);
        if (res.ok) setTasks(await res.json());
    };

    const fetchQuote = async () => {
        const res = await fetch(`/api/quotations/${id}`);
        setData(await res.json());
    };

    const handleDelete = async () => {
        setConfirmModal({
            isOpen: true,
            title: "Delete Quotation",
            message: "Are you sure you want to permanently delete this quotation? All associated payments and records will be lost. This action cannot be undone.",
            confirmText: "Delete Permanently",
            isDestructive: true,
            onConfirm: async () => {
                const res = await fetch(`/api/quotations/${id}`, { method: "DELETE" });
                if (res.ok) {
                    toast.success("Quotation deleted successfully");
                    router.push("/quotations");
                } else {
                    toast.error("Error deleting quotation");
                }
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const handleToggleVisited = async () => {
        const statuses = ["Not Visited", "Visited", "Sent"];
        const currentIndex = statuses.indexOf(data.visit_status || "Not Visited");
        const nextStatus = statuses[(currentIndex + 1) % statuses.length];

        await fetch(`/api/quotations/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ visit_status: nextStatus })
        });
        fetchQuote();
    };

    const handleCycleProjectStatus = async () => {
        const statuses = ["Pending", "Started", "Halted", "Completed"];
        const currentIndex = statuses.indexOf(data.project_status || "Pending");
        const nextStatus = statuses[(currentIndex + 1) % statuses.length];

        // Warn if cycling backward (wrapping Completed → Pending)
        if (nextStatus === "Pending" && data.project_status === "Completed") {
            setConfirmModal({
                isOpen: true,
                title: "Status Reversal",
                message: "This will move the project status from COMPLETED back to PENDING. Are you sure?",
                confirmText: "Revert Status",
                onConfirm: () => proceedCycle(nextStatus)
            });
            return;
        }

        proceedCycle(nextStatus);
    };

    const proceedCycle = async (nextStatus: string) => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        await fetch(`/api/quotations/${id}/project-status`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ project_status: nextStatus })
        });

        if (nextStatus === "Started" && data.project_status !== "Started") {
            const isComposite = isCompositeDoc(data.doc_type);
            let linkedIds: number[] = [];
            if (isComposite && data.linked_quotations) {
                try { linkedIds = JSON.parse(data.linked_quotations); } catch { }
            }

            const idsToIssue = isComposite && linkedIds.length > 0 ? linkedIds : [Number(id)];

            setConfirmModal({
                isOpen: true,
                title: "Issue Materials",
                message: `Project marked as STARTED. Would you like to send Stock Requests to Inventory for the quoted materials${isComposite && linkedIds.length > 0 ? ` (${linkedIds.length} child projects)` : ''}?`,
                confirmText: "Send Stock Requests",
                onConfirm: async () => {
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    let successCount = 0;
                    let failCount = 0;
                    for (const targetId of idsToIssue) {
                        try {
                            const issueRes = await fetch(`/api/quotations/${targetId}/auto-issue`, { method: "POST" });
                            if (issueRes.ok) successCount++; else failCount++;
                        } catch (e) { failCount++; }
                    }
                    if (successCount > 0) toast.success(`Successfully created ${successCount} Pending Stock Request${successCount > 1 ? 's' : ''}`);
                    if (failCount > 0) toast.error(`${failCount} Stock Request${failCount > 1 ? 's' : ''} could not be created`);
                    fetchQuote();
                }
            });
        }
        fetchQuote();
    };

    // Manual stock request handler (for re-issuing after rejection)
    const [requestingStock, setRequestingStock] = useState(false);
    const handleRequestStock = async () => {
        if (requestingStock) return;
        const latestReq = data?.latest_stock_request;

        const isComposite = isCompositeDoc(data?.doc_type);
        let linkedIds: number[] = [];
        if (isComposite && data?.linked_quotations) {
            try { linkedIds = JSON.parse(data.linked_quotations); } catch { }
        }
        const idsToIssue = isComposite && linkedIds.length > 0 ? linkedIds : [Number(id)];

        if (latestReq?.status === 'pending') {
            setConfirmModal({
                isOpen: true,
                title: "Duplicate Request",
                message: "A stock request is already pending. Send another one anyway?",
                confirmText: "Send Anyway",
                onConfirm: () => proceedRequestStock(idsToIssue)
            });
            return;
        }

        proceedRequestStock(idsToIssue);
    };

    const proceedRequestStock = async (idsToIssue: number[]) => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setRequestingStock(true);
        let successCount = 0, failCount = 0;
        for (const targetId of idsToIssue) {
            try {
                const res = await fetch(`/api/quotations/${targetId}/auto-issue`, { method: 'POST' });
                if (res.ok) successCount++; else failCount++;
            } catch { failCount++; }
        }
        setRequestingStock(false);
        if (successCount > 0) toast.success(`Stock Request${successCount > 1 ? 's' : ''} created!`);
        if (failCount > 0) toast.error(`${failCount} request${failCount > 1 ? 's' : ''} failed`);
        fetchQuote();
    };

    const handlePrintQuote = () => {
        setPrintMode('quote');
        requestAnimationFrame(() => {
            setTimeout(() => {
                window.print();
                setPrintMode('none');
            }, 300);
        });
    };

    const handlePrintLedger = () => {
        setPrintMode('ledger');
        requestAnimationFrame(() => {
            setTimeout(() => {
                window.print();
                setPrintMode('none');
            }, 300);
        });
    };

    const handleAddPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingPay(true);
        try {
            const targetId = data.parent_ledger ? data.parent_ledger.id : id;
            const url = payMode === 'add' ? `/api/quotations/${targetId}/payments` : `/api/quotations/${targetId}/payments`;
            const method = payMode === 'add' ? 'POST' : 'PUT';
            const body = payMode === 'add' ?
                { amount: parseFloat(payAmount), date: payDate, note: payNote } :
                { paymentId: editPaymentId, amount: parseFloat(payAmount), date: payDate, note: payNote };

            const res = await fetch(url, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                setIsPayModalOpen(false);
                setPayAmount("");
                setPayNote("");
                toast.success(`Payment ${payMode === 'add' ? 'recorded' : 'updated'} successfully`);
                fetchQuote();
            } else {
                toast.error(`Failed to ${payMode} payment`);
            }
        } catch (e) {
            toast.error(`Error ${payMode === 'add' ? 'adding' : 'updating'} payment`);
        } finally {
            setSavingPay(false);
        }
    };

    const handleEditPayment = (p: any) => {
        if (outstanding <= 0) {
            setConfirmModal({
                isOpen: true,
                title: "Edit Paid Record",
                message: "Warning: This project is fully paid. Editing payments will change the balance calculation. Proceed?",
                confirmText: "Proceed to Edit",
                onConfirm: () => {
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    startEditPayment(p);
                }
            });
            return;
        }
        startEditPayment(p);
    };

    const startEditPayment = (p: any) => {
        setPayMode('edit');
        setEditPaymentId(p.id);
        setPayAmount(p.amount.toString());
        setPayDate(p.date.split('T')[0]);
        setPayNote(p.note || "");
        setIsPayModalOpen(true);
    };

    const openAddPayment = () => {
        setPayMode('add');
        setEditPaymentId(null);
        setPayAmount("");
        setPayDate(new Date().toISOString().split('T')[0]);
        setPayNote("");
        setIsPayModalOpen(true);
    };

    const exportLedgerPdf = async () => {
        if (!ledgerExportRef.current) return;
        setExporting(true);

        try {
            await new Promise(r => setTimeout(r, 100));

            const canvas = await html2canvas(ledgerExportRef.current, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL("image/jpeg", 1.0);

            const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);

            const timestamp = format(new Date(), 'yyyyMMdd_HHmm');
            const fileName = `Latuns_Ledger_QC-${data.quote_number || id}_${timestamp}.pdf`;
            pdf.save(fileName);
            toast.success("Ledger PDF exported");
        } catch (err) {
            toast.error("Failed to export Ledger PDF");
        } finally {
            setExporting(false);
        }
    };
    const exportLedgerJpg = async () => {
        if (!ledgerExportRef.current) return;
        setExporting(true);
        try {
            await new Promise(r => setTimeout(r, 100));
            const canvas = await html2canvas(ledgerExportRef.current, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL("image/jpeg", 1.0);
            const timestamp = format(new Date(), 'yyyyMMdd_HHmm');
            const fileName = `Latuns_Ledger_QC-${data.quote_number || id}_${timestamp}.jpg`;

            if ('showSaveFilePicker' in window) {
                try {
                    const res = await fetch(imgData);
                    const blob = await res.blob();
                    // @ts-ignore
                    const handle = await window.showSaveFilePicker({
                        suggestedName: fileName,
                        types: [{ description: 'JPEG Image', accept: { 'image/jpeg': ['.jpg', '.jpeg'] } }]
                    });
                    const writable = await handle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                } catch (err: any) {
                    if (err.name !== 'AbortError') throw err;
                }
            } else {
                const link = document.createElement('a');
                link.download = fileName;
                link.href = imgData;
                link.click();
            }
            toast.success("Ledger JPG exported");
        } catch (err) {
            toast.error("Failed to export Ledger JPG");
        } finally {
            setExporting(false);
        }
    };

    const exportPDF = async (type: 'quote' | 'receipt') => {
        if (!exportRef.current) return;
        setExporting(true);

        try {
            // Small delay to ensure rendering is complete
            await new Promise(r => setTimeout(r, 100));

            const canvas = await html2canvas(exportRef.current, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL("image/jpeg", 1.0);

            const pdf = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4"
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);

            const timestamp = format(new Date(), 'yyyyMMdd_HHmm');
            const fileName = `Latuns_${type === 'quote' ? 'Quotation' : 'Receipt'}_${data.quote_number || id}_${timestamp}.pdf`;
            const blob = pdf.output('blob');

            if ('showSaveFilePicker' in window) {
                try {
                    // @ts-ignore
                    const handle = await window.showSaveFilePicker({
                        suggestedName: fileName,
                        types: [{ description: 'PDF Document', accept: { 'application/pdf': ['.pdf'] } }]
                    });
                    const writable = await handle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                } catch (err: any) {
                    if (err.name !== 'AbortError') throw err;
                }
            } else {
                // Fallback
                pdf.save(fileName);
            }
        } catch (err) {
            console.error(err);
            alert("Failed to export PDF");
        } finally {
            setExporting(false);
        }
    };

    const exportJPG = async () => {
        if (!exportRef.current) return;
        setExporting(true);
        try {
            await new Promise(r => setTimeout(r, 100));
            const canvas = await html2canvas(exportRef.current, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL("image/jpeg", 1.0);
            const timestamp = format(new Date(), 'yyyyMMdd_HHmm');
            const fileName = `Latuns_Quotation_${data.quote_number || id}_${timestamp}.jpg`;

            if ('showSaveFilePicker' in window) {
                try {
                    const res = await fetch(imgData);
                    const blob = await res.blob();
                    // @ts-ignore
                    const handle = await window.showSaveFilePicker({
                        suggestedName: fileName,
                        types: [{ description: 'JPEG Image', accept: { 'image/jpeg': ['.jpg', '.jpeg'] } }]
                    });
                    const writable = await handle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                } catch (err: any) {
                    if (err.name !== 'AbortError') throw err;
                }
            } else {
                const link = document.createElement('a');
                link.download = fileName;
                link.href = imgData;
                link.click();
            }
        } catch (err) {
            alert("Failed to export JPG");
        } finally {
            setExporting(false);
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
                    quotation_id: Number(id),
                    client_id: data.client_id
                })
            });
            if (res.ok) {
                toast.success("Task added to project");
                setIsTaskModalOpen(false);
                setNewTask({ text: '', assigned_to: null, priority: 'medium' });
                fetchTasks();
            }
        } catch (e) {
            toast.error("Failed to add task");
        }
    };

    const toggleTask = async (taskId: number, completed: boolean) => {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !completed } : t));
        await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: !completed })
        });
        fetchTasks();
    };

    if (loading || !data) return <div>Loading details...</div>;

    // Recalculate grand total
    const nativeGrandTotal = calcGrandTotal(data);
    const nativeNetTotal = calcNetTotal(data);

    // Parent Ledger Sync Overrides
    const isSynced = !!data.parent_ledger;
    const grandTotal = isSynced ? data.parent_ledger.grandTotal : nativeGrandTotal;
    const netTotal = isSynced ? data.parent_ledger.netTotal || grandTotal : nativeNetTotal;
    const totalPaid = isSynced ? data.parent_ledger.total_paid : data.total_paid;
    const outstanding = netTotal - totalPaid;
    const effectivePayments = isSynced ? data.parent_ledger.payments : data.payments;

    return (
        <div>
            <div className={`page-header ${printMode !== 'none' ? 'print-hide' : ''}`} style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                    <button onClick={() => router.push('/quotations')} className="btn btn-outline" style={{ padding: "8px" }}>
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <h1 className="page-title" style={{ marginBottom: 0 }}>Quotation {data.quote_number || `#QC-${String(data.id).padStart(4, '0')}`}</h1>
                        <p className="page-description">Created on {format(new Date(data.created_at), 'PPP')}</p>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                    <Link href={`/quotations/${id}/edit`} className="btn btn-outline" style={{ borderColor: "var(--primary)", color: "var(--primary)" }}>
                        <Edit size={16} /> Edit
                    </Link>
                    <button className="btn btn-outline" style={{ borderColor: "red", color: "red" }} onClick={handleDelete}>
                        <Trash2 size={16} /> Delete
                    </button>

                    <button
                        className="btn btn-outline"
                        style={{
                            borderColor: data.visit_status === "Visited" ? "#15803d" : data.visit_status === "Sent" ? "#3b82f6" : "var(--border)",
                            color: data.visit_status === "Visited" ? "#15803d" : data.visit_status === "Sent" ? "#3b82f6" : "var(--text-muted)",
                            backgroundColor: data.visit_status === "Visited" ? "#f0fdf4" : data.visit_status === "Sent" ? "#eff6ff" : "transparent"
                        }}
                        onClick={handleToggleVisited}
                    >
                        <MapPin size={16} /> Status: {data.visit_status || "Not Visited"}
                    </button>

                    <button className="btn btn-outline" onClick={handlePrintQuote} disabled={exporting}>
                        <Printer size={16} /> Print Quote
                    </button>

                    <button className="btn btn-outline" onClick={() => exportPDF('quote')} disabled={exporting}>
                        <Download size={16} /> {exporting ? "Wait..." : "PDF Quote"}
                    </button>
                    <button className="btn btn-outline" onClick={exportJPG} disabled={exporting}>
                        <ImageIcon size={16} /> {exporting ? "Wait..." : "JPG Quote"}
                    </button>
                </div>
            </div>

            <div style={{ display: "flex", gap: "24px" }} className={printMode !== 'none' ? 'print-hide' : ''}>
                {/* Left Column: Quote Details */}
                <div style={{ flex: 1 }}>
                    {data.latest_stock_request?.status === 'rejected' && (
                        <div style={{
                            backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px 16px',
                            marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <div>
                                <div style={{ fontWeight: 700, color: '#b91c1c', fontSize: '14px', marginBottom: '2px' }}>⚠️ Stock Request Rejected</div>
                                <div style={{ fontSize: '13px', color: '#991b1b' }}>Please review your item quantities and submit a new request to the store.</div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn btn-outline" style={{ borderColor: '#fca5a5', color: '#b91c1c' }} onClick={async () => {
                                    setConfirmModal({
                                        isOpen: true,
                                        title: "Dismiss Notification",
                                        message: "Are you sure you want to dismiss this notification without sending a new stock request?",
                                        confirmText: "Dismiss",
                                        onConfirm: async () => {
                                            setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                            setRequestingStock(true);
                                            await fetch(`/api/quotations/${id}/auto-issue`, { method: 'DELETE' });
                                            setRequestingStock(false);
                                            fetchQuote();
                                        }
                                    });
                                }} disabled={requestingStock}>
                                    Dismiss
                                </button>
                                <button className="btn btn-primary" style={{ backgroundColor: '#b91c1c', border: 'none' }} onClick={handleRequestStock} disabled={requestingStock}>
                                    {requestingStock ? "Sending..." : "Re-Issue Stock"}
                                </button>
                            </div>
                        </div>
                    )}


                    {data.project_type && (
                        <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap" }}>
                            <div style={{
                                backgroundColor: data.project_type.toLowerCase() === 'stone coated' ? '#b91c1c' : data.project_type.toLowerCase() === 'aluminium' ? '#4338ca' : '#d97706',
                                color: 'white',
                                fontWeight: 600,
                                fontSize: '14px',
                                padding: '6px 16px',
                                borderRadius: '20px',
                                textTransform: 'uppercase',
                                letterSpacing: '1px'
                            }}>
                                {data.project_type} PROJECT
                            </div>

                            <button
                                onClick={handleCycleProjectStatus}
                                style={{
                                    backgroundColor:
                                        data.project_status === "Completed" ? "#10b981" :
                                            data.project_status === "Started" ? "#3b82f6" :
                                                data.project_status === "Halted" ? "#ef4444" : "#f59e0b",
                                    color: "white",
                                    border: "none",
                                    fontWeight: 600,
                                    fontSize: "13px",
                                    padding: "6px 16px",
                                    borderRadius: "20px",
                                    cursor: "pointer",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.5px",
                                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                                    transition: "background-color 0.2s"
                                }}
                                title="Click to cycle project status"
                            >
                                Status: {data.project_status || "Pending"}
                            </button>
                        </div>
                    )}
                    <div className="card" style={{ marginBottom: "24px" }}>
                        <h2 style={{ fontSize: "16px", color: "var(--text-muted)", marginBottom: "8px", fontWeight: 600 }}>Client Information</h2>
                        <Link href={`/people/clients/${data.client_id}`} style={{ textDecoration: 'none', display: 'inline-block', marginBottom: "4px" }}>
                            <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--primary)", transition: "color 0.2s" }} 
                                 onMouseEnter={(e) => e.currentTarget.style.color = "var(--accent)"}
                                 onMouseLeave={(e) => e.currentTarget.style.color = "var(--primary)"}>
                                {data.client_name} ↗
                            </div>
                        </Link>
                        {data.client_phone && <div className="print-hide" style={{ color: "var(--text-muted)", marginBottom: "4px", display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '14px' }}>📞</span> {data.client_phone}
                        </div>}
                        <div style={{ color: "var(--text-muted)" }}>{data.client_address || "No address provided"}</div>
                    </div>

                    <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: "24px" }}>
                        <table className="table" style={{ width: "100%" }}>
                            <thead>
                                <tr>
                                    <th>Description</th>
                                    <th>Qty</th>
                                    <th>Unit</th>
                                    <th>Unit Cost</th>
                                    <th style={{ textAlign: "right" }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.items.map((item: any) => (
                                    <tr key={item.id}>
                                        <td style={{ fontWeight: 500 }}>{item.description}</td>
                                        <td>{item.qty}</td>
                                        <td>{item.unit}</td>
                                        <td>₦{item.unit_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        <td style={{ textAlign: "right", fontWeight: 600 }}>₦{item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Payment Ledger */}
                    <div className="card">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                            <h2 style={{ fontSize: "18px", margin: 0 }}>Payment Ledger</h2>
                            <div style={{ display: "flex", gap: "10px" }}>
                                {effectivePayments && effectivePayments.length > 0 && (
                                    <>
                                        <button className="btn btn-outline" style={{ padding: "6px 12px" }} onClick={handlePrintLedger} disabled={exporting}>
                                            <Printer size={16} /> Print Ledger
                                        </button>
                                        <button className="btn btn-outline" style={{ padding: "6px 12px" }} onClick={exportLedgerPdf} disabled={exporting}>
                                            <Download size={16} /> Export PDF
                                        </button>
                                        <button className="btn btn-outline" style={{ padding: "6px 12px" }} onClick={exportLedgerJpg} disabled={exporting}>
                                            <ImageIcon size={16} /> Export JPG
                                        </button>
                                    </>
                                )}
                                {outstanding > 0 && (
                                    <button className="btn btn-accent" style={{ padding: "6px 16px" }} onClick={openAddPayment}>
                                        <Plus size={16} /> Add Payment
                                    </button>
                                )}
                            </div>
                        </div>

                        {isSynced && (
                            <div style={{ marginBottom: "16px", padding: "12px", backgroundColor: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.3)", borderRadius: "var(--radius-md)", color: "#1d4ed8", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                                <div style={{ fontWeight: 600 }}>Sync Active:</div>
                                This Payment Ledger is synchronized to Master Document
                                <Link href={`/quotations/${data.parent_ledger.id}`} style={{ fontWeight: 700, marginLeft: "4px", color: "#1d4ed8" }}>
                                    {data.parent_ledger.quote_number || `PS-${data.parent_ledger.id}`}
                                </Link>. All payments recorded here apply directly to that combined balance.
                            </div>
                        )}

                        <div style={{ display: "flex", gap: "24px", marginBottom: "20px" }}>
                            <div style={{ flex: 1, backgroundColor: "var(--bg-color)", padding: "16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                                <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: 600 }}>Net Total {isSynced && "(Master)"}</div>
                                <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--primary)" }}>₦{netTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                            </div>
                            <div style={{ flex: 1, backgroundColor: "rgba(16, 185, 129, 0.1)", padding: "16px", borderRadius: "var(--radius-md)", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                                <div style={{ fontSize: "13px", color: "#10b981", marginBottom: "4px", fontWeight: 600 }}>Total Paid {isSynced && "(Master)"}</div>
                                <div style={{ fontSize: "24px", fontWeight: 700, color: "#10b981" }}>₦{totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                            </div>
                            <div style={{ flex: 1, backgroundColor: outstanding > 0 ? "rgba(245, 158, 11, 0.1)" : "var(--bg-color)", padding: "16px", borderRadius: "var(--radius-md)", border: `1px solid ${outstanding > 0 ? "rgba(245, 158, 11, 0.3)" : "var(--border)"}` }}>
                                <div style={{ fontSize: "13px", color: outstanding > 0 ? "#f59e0b" : "var(--text-muted)", marginBottom: "4px", fontWeight: 600 }}>Outstanding Balance</div>
                                <div style={{ fontSize: "24px", fontWeight: 700, color: outstanding > 0 ? "#f59e0b" : "var(--text-muted)" }}>₦{outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                            </div>
                        </div>

                        {effectivePayments && effectivePayments.length > 0 ? (
                            <table className="table" style={{ width: "100%", fontSize: "14px" }}>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Note</th>
                                        <th style={{ textAlign: "right" }}>Amount Paid</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {effectivePayments.map((p: any) => (
                                        <tr key={p.id}>
                                            <td>{format(new Date(p.date), 'MMM d, yyyy')}</td>
                                            <td style={{ color: "var(--text-muted)" }}>{p.note || "-"}</td>
                                            <td style={{ textAlign: "right", fontWeight: 600, color: "#10b981" }}>
                                                ₦{p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                <button onClick={() => handleEditPayment(p)} className="btn btn-outline" style={{ display: "inline-flex", padding: "4px 8px", marginLeft: "10px", borderColor: "transparent", color: "var(--primary)" }} title="Edit Payment">
                                                    <Edit size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)", backgroundColor: "var(--bg-color)", borderRadius: "var(--radius-md)" }}>
                                No payments have been recorded yet.
                            </div>
                        )}
                    </div>

                    {/* Project Tasks Card */}
                    <div className="card" style={{ marginTop: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h2 style={{ fontSize: '18px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <CheckSquare size={18} color="var(--primary)" /> Project Tasks & Delegation
                            </h2>
                            <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '13px' }} onClick={() => setIsTaskModalOpen(true)}>
                                <Plus size={14} /> New Task
                            </button>
                        </div>

                        {tasks.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)' }}>
                                No tasks linked to this project yet.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {tasks.map((task: any) => (
                                    <div key={task.id} style={{ 
                                        padding: '12px', 
                                        borderRadius: '8px', 
                                        border: '1px solid var(--border)', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '12px',
                                        backgroundColor: task.completed ? 'var(--row-odd)' : 'white'
                                    }}>
                                        <div 
                                            onClick={() => toggleTask(task.id, task.completed)}
                                            style={{ 
                                                width: '20px', height: '20px', 
                                                borderRadius: '50%', 
                                                border: `2px solid ${task.completed ? 'var(--primary)' : 'var(--border)'}`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                cursor: 'pointer',
                                                backgroundColor: task.completed ? 'var(--primary)' : 'transparent',
                                                color: 'white',
                                                flexShrink: 0
                                            }}
                                        >
                                            {task.completed && <Check size={12} strokeWidth={3} />}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ 
                                                fontSize: '14px', 
                                                fontWeight: 500, 
                                                color: task.completed ? 'var(--text-muted)' : 'var(--text-main)',
                                                textDecoration: task.completed ? 'line-through' : 'none'
                                            }}>
                                                {task.text}
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                Assigned to: <span style={{ fontWeight: 600 }}>{task.assignee_name || 'Me'}</span> 
                                                {task.alarm_time && ` • Due: ${format(new Date(task.alarm_time), 'MMM d, p')}`}
                                            </div>
                                        </div>
                                        <div style={{ 
                                            fontSize: '10px', 
                                            textTransform: 'uppercase', 
                                            padding: '2px 6px', 
                                            borderRadius: '4px',
                                            backgroundColor: task.priority === 'high' ? '#fee2e2' : task.priority === 'medium' ? '#fef3c7' : '#dbeafe',
                                            color: task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#d97706' : '#3b82f6',
                                            fontWeight: 700
                                        }}>
                                            {task.priority}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Hidden Export Template - Uses QuotationPrintTemplate for consistent design from template builder */}
            <div className={printMode === 'quote' ? 'print-show' : ''} style={{ position: "absolute", left: "-9999px", top: 0, opacity: printMode === 'quote' ? 1 : 0, zIndex: -1 }}>
                <div ref={exportRef}>
                    <QuotationPrintTemplate
                        data={{
                            ...data,
                            subtotal: data.subtotal,
                            items: data.items,
                        }}
                        settings={settings}
                    />
                </div>
            </div>

            {/* Hidden Export Template For Ledger */}
            {(() => {
                const tpl = activeTemplate;
                const pad = { compact: "24px 28px", normal: "40px 40px", spacious: "48px 56px" }[tpl.padding] || "40px";
                const pc = tpl.primaryColor;
                const ac = tpl.accentColor;
                return (
                    <div className={printMode === 'ledger' ? 'print-show' : ''} style={{ position: "absolute", left: "-9999px", top: 0, opacity: printMode === 'ledger' ? 1 : 0, zIndex: -1 }}>
                        <div ref={ledgerExportRef} style={{ width: "800px", maxWidth: "100%", padding: pad, backgroundColor: "#ffffff", color: "black", fontFamily: "'Inter', sans-serif" }}>

                            {/* Header */}
                            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `4px solid ${ac}`, paddingBottom: "24px", marginBottom: "32px", alignItems: "flex-start" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "400px" }}>
                                    <img src="/logo.png" alt="Company Logo" style={{ height: `${tpl.logoHeight}px`, objectFit: "contain" }} />
                                    <div style={{ fontSize: "12px", color: "#475569", lineHeight: 1.5 }}>
                                        {tpl.showAddress && settings.companyAddress && <div>{settings.companyAddress}</div>}
                                        {tpl.showPhone && settings.companyPhone && <div>Tel: {settings.companyPhone}</div>}
                                        {tpl.showEmail && settings.companyEmail && <div>Email: {settings.companyEmail}</div>}
                                        {tpl.showWebsite && settings.companyWebsite && <div>Web: {settings.companyWebsite}</div>}
                                    </div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <h2 style={{ fontSize: "28px", margin: 0, fontWeight: 800, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: "2px" }}>Payment Ledger</h2>
                                    <div style={{ fontSize: "14px", color: "#64748b", marginTop: "8px", fontWeight: 600 }}>{data.quote_number || `QC-${String(data.id).padStart(4, '0')}`}</div>
                                    <div style={{ fontSize: "14px", color: "#64748b", marginTop: "4px" }}>Date Printed: {format(new Date(), 'MMM d, yyyy')}</div>
                                </div>
                            </div>

                            {/* Detailed Payment Export Layout - Matched aesthetics */}
                            <div style={{ marginBottom: "32px", padding: "20px", backgroundColor: "#f8fafc", borderRadius: "8px", borderLeft: `4px solid ${pc}` }}>
                                <div style={{ fontSize: "12px", textTransform: "uppercase", color: "#64748b", fontWeight: 700, letterSpacing: "1px", marginBottom: "8px" }}>Ledger Record For</div>
                                <div style={{ fontSize: "20px", fontWeight: 800, color: pc, marginBottom: "4px" }}>{data.client_name}</div>
                                <div style={{ color: "#475569", fontSize: "14px" }}>{data.client_address}</div>
                            </div>

                            <div style={{ display: "flex", gap: "24px", marginBottom: "32px" }}>
                                <div style={{ flex: 1, backgroundColor: "#f8fafc", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                                    <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "4px", fontWeight: 600 }}>Grand Total</div>
                                    <div style={{ fontSize: "24px", fontWeight: 700, color: pc }}>₦{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                </div>
                                <div style={{ flex: 1, backgroundColor: "#ecfdf5", padding: "16px", borderRadius: "8px", border: "1px solid #a7f3d0" }}>
                                    <div style={{ fontSize: "13px", color: "#059669", marginBottom: "4px", fontWeight: 600 }}>Total Paid</div>
                                    <div style={{ fontSize: "24px", fontWeight: 700, color: "#10b981" }}>₦{data.total_paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                </div>
                                <div style={{ flex: 1, backgroundColor: outstanding > 0 ? "#fffbeb" : "#f1f5f9", padding: "16px", borderRadius: "8px", border: `1px solid ${outstanding > 0 ? "#fde68a" : "#e2e8f0"}` }}>
                                    <div style={{ fontSize: "13px", color: outstanding > 0 ? "#d97706" : "#64748b", marginBottom: "4px", fontWeight: 600 }}>Outstanding Balance</div>
                                    <div style={{ fontSize: "24px", fontWeight: 700, color: outstanding > 0 ? "#f59e0b" : "#64748b" }}>₦{outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                </div>
                            </div>

                            {data.payments && data.payments.length > 0 ? (
                                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "32px" }}>
                                    <thead>
                                        <tr>
                                            <th style={{ backgroundColor: pc, color: "white", padding: "12px", textAlign: "left", fontSize: "13px", textTransform: "uppercase" }}>Date</th>
                                            <th style={{ backgroundColor: pc, color: "white", padding: "12px", textAlign: "left", fontSize: "13px", textTransform: "uppercase" }}>Reference Note</th>
                                            <th style={{ backgroundColor: ac, color: "white", padding: "12px", textAlign: "right", fontSize: "13px", textTransform: "uppercase" }}>Amount Paid (₦)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.payments.map((p: any, i: number) => (
                                            <tr key={p.id} style={{ borderBottom: "1px solid #e2e8f0", backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                                                <td style={{ padding: "14px 12px", color: "#475569" }}>{format(new Date(p.date), 'MMM d, yyyy')}</td>
                                                <td style={{ padding: "14px 12px", color: "#475569" }}>{p.note || "-"}</td>
                                                <td style={{ padding: "14px 12px", textAlign: "right", fontWeight: 700, color: pc }}>{p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div style={{ textAlign: "center", padding: "32px", color: "#64748b", backgroundColor: "#f8fafc", borderRadius: "8px" }}>
                                    No payments have been recorded yet.
                                </div>
                            )}
                        </div>
                    </div>

                ); // close IIFE return
            })()}

            {/* Payment Modal */}
            {
                isPayModalOpen && (
                    <div className="modal-overlay" onClick={() => setIsPayModalOpen(false)}>
                        <div className="modal-content" onClick={e => e.stopPropagation()}>
                            <form onSubmit={handleAddPayment}>
                                <div className="modal-header">
                                    <div className="modal-title">{payMode === 'add' ? 'Record Payment' : 'Edit Payment'}</div>
                                </div>
                                <div className="modal-body">
                                    <div style={{ padding: "12px", backgroundColor: "#fffbeb", color: "#d97706", borderRadius: "6px", marginBottom: "20px", fontWeight: 600, fontSize: "14px" }}>
                                        Outstanding Balance: ₦{outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Amount (₦)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            step="any"
                                            max={payMode === 'add' ? outstanding : outstanding + parseFloat(payAmount || "0")}
                                            className="form-control"
                                            value={payAmount}
                                            onChange={e => setPayAmount(e.target.value)}
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Date</label>
                                        <input
                                            type="date"
                                            className="form-control"
                                            value={payDate}
                                            onChange={e => setPayDate(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Note / Reference (Optional)</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={payNote}
                                            onChange={e => setPayNote(e.target.value)}
                                            placeholder="e.g. Bank Transfer, Cheque No"
                                        />
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-outline" onClick={() => setIsPayModalOpen(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={savingPay}>{savingPay ? "Saving..." : (payMode === 'add' ? "Record Payment" : "Update Payment")}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* CUSTOM CONFIRM MODAL */}
            {confirmModal.isOpen && (
                <div className="modal-overlay" style={{ zIndex: 1100 }}>
                    <div className="modal-content" style={{ maxWidth: '450px', borderTop: confirmModal.isDestructive ? '4px solid #ef4444' : '4px solid var(--primary)' }}>
                        <div className="modal-header">
                            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertCircle size={20} color={confirmModal.isDestructive ? '#ef4444' : 'var(--primary)'} />
                                {confirmModal.title}
                            </div>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: '15px', lineHeight: 1.6, color: 'var(--text-muted)' }}>
                                {confirmModal.message}
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-outline" onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}>Cancel</button>
                            <button 
                                className="btn" 
                                style={{ 
                                    backgroundColor: confirmModal.isDestructive ? '#ef4444' : 'var(--primary)', 
                                    color: 'white', 
                                    border: 'none',
                                    fontWeight: 700 
                                }}
                                onClick={confirmModal.onConfirm}
                            >
                                {confirmModal.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PROJECT TASK MODAL */}
            {isTaskModalOpen && (
                <div className="modal-overlay" onClick={() => setIsTaskModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <form onSubmit={handleAddTask}>
                            <div className="modal-header">
                                <div className="modal-title">Project Task</div>
                            </div>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Description</label>
                                    <textarea 
                                        className="form-control" 
                                        rows={3} 
                                        placeholder="Follow up on..."
                                        value={newTask.text}
                                        onChange={e => setNewTask({...newTask, text: e.target.value})}
                                        required
                                        autoFocus
                                    />
                                </div>
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
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setIsTaskModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Create Task</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
