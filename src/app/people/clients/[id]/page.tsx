"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Phone, MapPin, Briefcase } from "lucide-react";
import { format } from "date-fns";
import { useParams, useRouter } from "next/navigation";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { QuotationPrintTemplate } from "@/app/components/QuotationPrintTemplate";
import { useRef } from "react";
import { calcGrandTotal } from "@/lib/financeUtils";

export default function ClientProfilePage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id;
    const [client, setClient] = useState<any>(null);
    const [settings, setSettings] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const [selectedQuotes, setSelectedQuotes] = useState<number[]>([]);
    const [exporting, setExporting] = useState(false);

    // Document Generator Modal State
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [docType, setDocType] = useState('project_scope');
    const [discountedPrice, setDiscountedPrice] = useState("");
    const [generatingDoc, setGeneratingDoc] = useState(false);

    const [activeTab, setActiveTab] = useState<'history' | 'timeline' | 'payments'>('history');

    const exportContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (id) fetchClient();
    }, [id]);

    const fetchClient = async () => {
        try {
            const [res, settingsRes] = await Promise.all([
                fetch(`/api/clients/${id}`),
                fetch(`/api/settings`)
            ]);

            if (res.ok) {
                const data = await res.json();
                setClient(data);
            }
            if (settingsRes.ok) {
                const settingsData = await settingsRes.json();
                setSettings(settingsData);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const toggleQuoteSelection = (quoteId: number) => {
        setSelectedQuotes(prev =>
            prev.includes(quoteId) ? prev.filter(id => id !== quoteId) : [...prev, quoteId]
        );
    };

    const toggleAllQuotes = () => {
        if (!client || !client.quotations) return;
        if (selectedQuotes.length === client.quotations.length) {
            setSelectedQuotes([]);
        } else {
            setSelectedQuotes(client.quotations.map((q: any) => q.id));
        }
    };

    const handleExportSelectedPDF = async () => {
        if (selectedQuotes.length === 0 || !exportContainerRef.current) return;
        setExporting(true);

        try {
            // Give React time to render the hidden templates
            await new Promise(r => setTimeout(r, 500));

            const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            const templates = exportContainerRef.current.children;
            let firstPage = true;

            for (let i = 0; i < templates.length; i++) {
                const node = templates[i] as HTMLElement;
                const canvas = await html2canvas(node, { scale: 2, useCORS: true });
                const imgData = canvas.toDataURL("image/jpeg", 1.0);

                // Calculate height to stretch proportionately to A4 width
                const imgProps = pdf.getImageProperties(imgData);
                const renderHeight = (imgProps.height * pdfWidth) / imgProps.width;

                if (!firstPage) {
                    pdf.addPage();
                }

                pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, renderHeight);
                firstPage = false;
            }

            const timestamp = format(new Date(), 'yyyyMMdd_HHmm');
            const fileName = `Latuns_${client.name.replace(/\s+/g, '_')}_Quotations_${timestamp}.pdf`;
            pdf.save(fileName);
        } catch (error) {
            console.error("PDF Export failed:", error);
            alert("Failed to export merged PDF.");
        } finally {
            setExporting(false);
        }
    };

    // Helper: compute grandTotal for a quotation object
    const calculateGrandTotal = (q: any): number => {
        return calcGrandTotal(q);
    };

    const handleGenerateDocument = async () => {
        if (!client || selectedQuotes.length === 0) return;
        setGeneratingDoc(true);

        try {
            // Expand any project_scope selections into their children
            const allQuotationsMap: Record<number, any> = {};
            (client.quotations || []).forEach((q: any) => { allQuotationsMap[q.id] = q; });

            // Collect the effective set of quotation IDs (expanding scopes to their children)
            let effectiveIds: number[] = [];
            let effectiveLinkedIds: number[] = []; // what we store in linked_quotations on the new doc

            for (const selId of selectedQuotes) {
                const selQ = allQuotationsMap[selId];
                if (selQ && (selQ.doc_type === 'project_scope' || selQ.doc_type === 'discount_statement') && selQ.linked_quotations) {
                    try {
                        const children: number[] = JSON.parse(selQ.linked_quotations);
                        effectiveIds.push(...children);
                        effectiveLinkedIds.push(...children); // link to children, not the scope
                    } catch {
                        effectiveIds.push(selId);
                        effectiveLinkedIds.push(selId);
                    }
                } else {
                    effectiveIds.push(selId);
                    effectiveLinkedIds.push(selId);
                }
            }

            // Deduplicate
            effectiveIds = [...new Set(effectiveIds)];
            effectiveLinkedIds = [...new Set(effectiveLinkedIds)];

            let totalOriginalSum = 0;
            const aggregatedItems = effectiveIds.map((qId: number) => {
                const q = allQuotationsMap[qId];
                if (!q) return null;
                const grandTotal = calculateGrandTotal(q);
                totalOriginalSum += grandTotal;
                const descLabel = [q.project_type || 'Project', q.quote_number ? `(${q.quote_number})` : ''].filter(Boolean).join(' ');
                return { description: descLabel, qty: 1, unit: 'lot', unit_cost: grandTotal, total: grandTotal };
            }).filter(Boolean);

            let discountValue = 0;
            if (docType === 'discount_statement') {
                const parsedDiscountedPrice = parseFloat(discountedPrice);
                if (!isNaN(parsedDiscountedPrice) && parsedDiscountedPrice < totalOriginalSum) {
                    discountValue = totalOriginalSum - parsedDiscountedPrice;
                }
            }

            const payload = {
                client_name: client.name,
                client_phone: client.phone,
                client_address: client.address,
                client_state: client.state,
                client_city: client.city,
                project_type: docType === 'project_scope' ? 'Combined Scope' : 'Discounted Bundle',
                subsidiary_name: 'LATUNS ROOFING SYSTEM',
                items: aggregatedItems,
                is_composite: true,
                doc_type: docType,
                discount_value: discountValue,
                linked_quotations: effectiveLinkedIds
            };

            const res = await fetch('/api/quotations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setIsDocModalOpen(false);
                setSelectedQuotes([]);
                setDiscountedPrice("");
                await fetchClient();
            } else {
                alert("Failed to create document");
            }
        } catch (error) {
            console.error(error);
            alert("Error creating document");
        } finally {
            setGeneratingDoc(false);
        }
    };

    const handleConvertToInvoice = async () => {
        if (selectedQuotes.length !== 1) return;
        const sourceQuote = client.quotations.find((q: any) => q.id === selectedQuotes[0]);
        if (!sourceQuote) return;

        if (!confirm(`Convert ${sourceQuote.quote_number || `Quote #${sourceQuote.id}`} into an Official Tax Invoice?`)) return;

        try {
            const res = await fetch('/api/quotations/invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source_id: sourceQuote.id })
            });

            if (res.ok) {
                const data = await res.json();
                setSelectedQuotes([]);
                await fetchClient();
                alert(`Successfully generated ${data.quote_number}`);
            } else {
                alert("Failed to convert to Invoice.");
            }
        } catch (e) {
            alert("Error converting to invoice.");
        }
    };

    const handleRequestReversal = async (stockRequestId: number) => {
        if (!confirm('Are you sure you want to request a reversal for this issued stock? The Store Manager will need to review and confirm the return.')) return;
        
        try {
            const res = await fetch(`/api/inventory/requests/${stockRequestId}/revert-request`, { method: 'POST' });
            if (res.ok) {
                alert('Reversal request sent to the warehouse manager.');
                await fetchClient();
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to request reversal');
            }
        } catch {
            alert('Error requesting reversal');
        }
    };

    if (loading) return <div style={{ padding: "32px", textAlign: "center" }}>Loading profile...</div>;
    if (!client) return <div style={{ padding: "32px", textAlign: "center" }}>Client not found.</div>;

    return (
        <div>
            <div className="page-header" style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                    <button onClick={() => router.push('/people/clients')} className="btn btn-outline" style={{ padding: "8px" }}>
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <h1 className="page-title" style={{ marginBottom: "8px" }}>{client.name}</h1>
                        <div style={{ display: "flex", gap: "16px", color: "var(--text-muted)", fontSize: "14px", flexWrap: "wrap", marginTop: "8px" }}>
                            {client.phone && <div style={{ display: "flex", alignItems: "center", gap: "4px" }}><Phone size={14} /> {client.phone}</div>}
                            {(client.city || client.state) && <div style={{ display: "flex", alignItems: "center", gap: "4px" }}><MapPin size={14} /> {[client.city, client.state].filter(Boolean).join(", ")}</div>}
                            {client.estimators && client.estimators.length > 0 && (
                                <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--primary)", fontWeight: 500 }}>
                                    <Briefcase size={14} /> Estimator: {client.estimators.map((e: any) => e.name).join(", ")}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                    {/* Total Billed: uses discounted price when a discount_statement covers the child */}
                    {(() => {
                        const allQ: any[] = client.quotations || [];
                        // Build map: childId -> discountedContrib from each discount_statement
                        const discountCoveredMap: Record<number, number> = {};
                        allQ.filter((q: any) => q.doc_type === 'discount_statement').forEach((ds: any) => {
                            if (!ds.linked_quotations) return;
                            try {
                                const childIds: number[] = JSON.parse(ds.linked_quotations);
                                const childrenTotal = childIds.reduce((acc: number, cid: number) => {
                                    const cq = allQ.find((x: any) => x.id === cid);
                                    return acc + (cq ? calculateGrandTotal(cq) : 0);
                                }, 0);
                                const discountVal = ds.discount_value || 0;
                                const discountedTotal = childrenTotal - discountVal;
                                // Spread the discounted total proportionally among children
                                const ratio = childrenTotal > 0 ? discountedTotal / childrenTotal : 1;
                                childIds.forEach(cid => {
                                    const cq = allQ.find((x: any) => x.id === cid);
                                    if (cq) discountCoveredMap[cid] = calculateGrandTotal(cq) * ratio;
                                });
                            } catch { }
                        });

                        const activeQuotations = allQ.filter((q: any) => q.doc_type === 'quotation' && q.project_status !== 'Pending');
                        const totalBilled = activeQuotations.reduce((sum: number, q: any) => {
                            const contrib = discountCoveredMap[q.id] !== undefined ? discountCoveredMap[q.id] : calculateGrandTotal(q);
                            return sum + contrib;
                        }, 0);
                        const totalOutstanding = activeQuotations.reduce((sum: number, q: any) => {
                            const billedContrib = discountCoveredMap[q.id] !== undefined ? discountCoveredMap[q.id] : calculateGrandTotal(q);
                            return sum + (billedContrib - (q.total_paid || 0));
                        }, 0);

                        return (
                            <>
                                <div className="card" style={{ padding: '12px 20px', minWidth: '180px', borderLeft: '4px solid var(--primary)' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Total Billed</div>
                                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}>
                                        ₦{totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <div className="card" style={{ padding: '12px 20px', minWidth: '180px', borderLeft: '4px solid #f59e0b' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Total Outstanding</div>
                                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#f59e0b' }}>
                                        ₦{totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                </div>
            </div>

            <div className="tab-bar">
                <button
                    onClick={() => setActiveTab('history')}
                    className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                >
                    Quotations History
                </button>
                <button
                    onClick={() => setActiveTab('timeline')}
                    className={`tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
                >
                    Activity Timeline
                </button>
                <button
                    onClick={() => setActiveTab('payments')}
                    className={`tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
                >
                    Payments
                </button>
            </div>

            {activeTab === 'history' && (
                <div className="card" style={{ marginBottom: "24px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                        <h2 style={{ fontSize: "16px", margin: 0, fontWeight: 600 }}>Quotation History</h2>
                        {selectedQuotes.length > 0 && (
                            <div style={{ display: "flex", gap: "8px" }}>
                                {selectedQuotes.length === 1 && (
                                    <button
                                        className="btn btn-outline"
                                        onClick={handleConvertToInvoice}
                                        style={{ padding: "6px 12px", fontSize: "14px", color: '#10b981', borderColor: '#10b981' }}
                                    >
                                        Convert to Invoice
                                    </button>
                                )}
                                <button
                                    className="btn btn-outline"
                                    onClick={() => setIsDocModalOpen(true)}
                                    style={{ padding: "6px 12px", fontSize: "14px" }}
                                >
                                    Generate Document
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleExportSelectedPDF}
                                    disabled={exporting}
                                    style={{ padding: "6px 12px", fontSize: "14px" }}
                                >
                                    {exporting ? "Generating PDF..." : `Merge to PDF (${selectedQuotes.length})`}
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="table-wrapper">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th style={{ width: "40px", textAlign: "center" }}>
                                        <input
                                            type="checkbox"
                                            checked={client.quotations && client.quotations.length > 0 && selectedQuotes.length === client.quotations.length}
                                            onChange={toggleAllQuotes}
                                        />
                                    </th>
                                    <th>Quote ID</th>
                                    <th>Date</th>
                                    <th>Project Type</th>
                                    <th>Stock Status</th>
                                    <th>Project Status</th>
                                    <th style={{ textAlign: "right" }}>Grand Total</th>
                                    <th style={{ textAlign: "right" }}>Total Paid</th>
                                    <th style={{ textAlign: "right" }}>Outstanding</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!client.quotations || client.quotations.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>No quotations found for this client.</td>
                                    </tr>
                                ) : (
                                    client.quotations.map((q: any) => {
                                        const grandTotal = calculateGrandTotal(q);
                                        const balance = grandTotal - (q.total_paid || 0);

                                        return (
                                            <tr key={q.id}>
                                                <td style={{ textAlign: "center" }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedQuotes.includes(q.id)}
                                                        onChange={() => toggleQuoteSelection(q.id)}
                                                    />
                                                </td>
                                                <td style={{ fontWeight: 600 }}>
                                                    <Link href={`/quotations/${q.id}`} style={{ textDecoration: 'underline', color: 'var(--primary)' }}>
                                                        {q.quote_number || `#QC-${String(q.id).padStart(4, '0')}`}
                                                    </Link>
                                                </td>
                                                <td>{format(new Date(q.created_at), 'MMM d, yyyy')}</td>
                                                <td style={{ fontWeight: 600, color: "var(--primary)" }}>{q.project_type || "-"}</td>
                                                <td>
                                                    {q.stock_request_status === 'approved' ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span className="badge" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>Issued</span>
                                                            <button 
                                                                className="btn btn-outline" 
                                                                onClick={() => handleRequestReversal(q.stock_request_id)}
                                                                style={{ padding: '2px 8px', fontSize: '11px', borderColor: '#f59e0b', color: '#b45309' }}
                                                                title="Request Reversal (Return Stock)"
                                                            >
                                                                Revert
                                                            </button>
                                                        </div>
                                                    ) : q.stock_request_status === 'pending' ? (
                                                        <span className="badge" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>Awaiting Issue</span>
                                                    ) : q.stock_request_status === 'revert_pending' ? (
                                                        <span className="badge" style={{ backgroundColor: '#fff7ed', color: '#ea580c', border: '1px solid #fdba74' }}>Reversal Pending Review</span>
                                                    ) : (
                                                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Not Requested</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <span style={{
                                                        backgroundColor:
                                                            q.project_status === "Completed" ? "#10b981" :
                                                                q.project_status === "Started" ? "#3b82f6" :
                                                                    q.project_status === "Halted" ? "#ef4444" : "#f59e0b",
                                                        color: "white",
                                                        fontWeight: 600,
                                                        fontSize: "12px",
                                                        padding: "4px 12px",
                                                        borderRadius: "16px",
                                                        textTransform: "uppercase"
                                                    }}>
                                                        {q.project_status || "Pending"}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: "right" }}>₦{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                <td style={{ textAlign: "right", color: "#10b981", fontWeight: 600 }}>₦{(q.total_paid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                <td style={{ textAlign: "right", color: balance > 0 ? "#f59e0b" : "var(--text-muted)", fontWeight: 600 }}>
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

            {activeTab === 'timeline' && (
                <div className="card" style={{ marginBottom: "24px" }}>
                    <h2 style={{ fontSize: "16px", marginBottom: "24px", color: "var(--primary)" }}>Chronological Timeline</h2>
                    {(!client.activity_logs || client.activity_logs.length === 0) ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No activity recorded yet.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '15px', top: '10px', bottom: '10px', width: '2px', backgroundColor: 'var(--border)' }} />
                            {client.activity_logs.map((log: any) => (
                                <div key={log.id} style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 1 }}>
                                    <div style={{
                                        width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                        backgroundColor: log.action_type === 'payment' ? '#10b981' : log.action_type === 'status_change' ? '#f59e0b' : '#3b82f6',
                                        color: 'white', border: '4px solid var(--bg-color)'
                                    }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'white' }} />
                                    </div>
                                    <div style={{ flex: 1, paddingBottom: '8px' }}>
                                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                            {format(new Date(log.created_at), 'MMM d, yyyy • h:mm a')}
                                        </div>
                                        <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text)' }}>
                                            {log.description}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Hidden Templates Container for PDF Export */}
            <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
                <div ref={exportContainerRef}>
                    {client.quotations?.filter((q: any) => selectedQuotes.includes(q.id)).map((q: any, i: number) => (
                        <div key={q.id} style={{ width: "210mm", backgroundColor: "white", marginBottom: "20px" }}>
                            <QuotationPrintTemplate data={q} settings={settings} />
                        </div>
                    ))}
                </div>
            </div>

            {/* Document Generator Modal — Redesigned with blur backdrop */}
            {isDocModalOpen && (() => {
                // Compute original sum for the modal preview
                const allQuotationsMap: Record<number, any> = {};
                (client.quotations || []).forEach((q: any) => { allQuotationsMap[q.id] = q; });

                // Expand project scopes to their children for the preview
                let previewIds: number[] = [];
                for (const selId of selectedQuotes) {
                    const selQ = allQuotationsMap[selId];
                    if (selQ && (selQ.doc_type === 'project_scope' || selQ.doc_type === 'discount_statement') && selQ.linked_quotations) {
                        try {
                            const children: number[] = JSON.parse(selQ.linked_quotations);
                            previewIds.push(...children);
                        } catch { previewIds.push(selId); }
                    } else {
                        previewIds.push(selId);
                    }
                }
                previewIds = [...new Set(previewIds)];

                const previewItems = previewIds.map(id => allQuotationsMap[id]).filter(Boolean);
                const originalSum = Math.round((previewItems.reduce((acc: number, q: any) => acc + calculateGrandTotal(q), 0) + Number.EPSILON) * 100) / 100;
                const parsedNewPrice = parseFloat(discountedPrice);
                const savings = !isNaN(parsedNewPrice) && parsedNewPrice < originalSum ? originalSum - parsedNewPrice : 0;

                return (
                    <div style={{
                        position: 'fixed', inset: 0, zIndex: 1000,
                        backgroundColor: 'rgba(0,0,0,0.45)',
                        backdropFilter: 'blur(6px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '24px'
                    }} onClick={() => setIsDocModalOpen(false)}>
                        <div style={{
                            backgroundColor: 'var(--card-bg, #ffffff)',
                            borderRadius: '16px',
                            boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
                            width: '100%',
                            maxWidth: '560px',
                            overflow: 'hidden'
                        }} onClick={e => e.stopPropagation()}>

                            {/* Modal Header */}
                            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg, var(--primary) 0%, #1e40af 100%)' }}>
                                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>Client: {client.name}</div>
                                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'white' }}>Generate Document</h2>
                                <div style={{ marginTop: '6px', fontSize: '13px', color: 'rgba(255,255,255,0.75)' }}>{previewIds.length} project{previewIds.length !== 1 ? 's' : ''} selected</div>
                            </div>

                            {/* Modal Body */}
                            <div style={{ padding: '24px 28px' }}>
                                {/* Doc type selector */}
                                <div className="form-group" style={{ marginBottom: '20px' }}>
                                    <label className="form-label" style={{ fontWeight: 600 }}>Document Type</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
                                        {[{ value: 'project_scope', label: 'Project Scope', desc: 'Consolidated scope of work' }, { value: 'discount_statement', label: 'Discount Statement', desc: 'Price reduction document' }].map(opt => (
                                            <div key={opt.value}
                                                onClick={() => setDocType(opt.value)}
                                                style={{
                                                    padding: '12px 14px', borderRadius: '10px', cursor: 'pointer',
                                                    border: docType === opt.value ? '2px solid var(--primary)' : '2px solid var(--border)',
                                                    backgroundColor: docType === opt.value ? 'rgba(var(--primary-rgb, 35,37,161),0.06)' : 'var(--row-odd, #f8fafc)',
                                                    transition: 'all 0.15s'
                                                }}>
                                                <div style={{ fontWeight: 700, fontSize: '13px', color: docType === opt.value ? 'var(--primary)' : 'var(--text)' }}>{opt.label}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{opt.desc}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Selected projects preview */}
                                {previewItems.length > 0 && (
                                    <div style={{ marginBottom: '20px' }}>
                                        <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.5px' }}>Selected Projects</div>
                                        <div style={{ borderRadius: '10px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                            {previewItems.map((q: any, i: number) => (
                                                <div key={q.id} style={{
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                    padding: '10px 14px',
                                                    borderBottom: i < previewItems.length - 1 ? '1px solid var(--border)' : 'none',
                                                    backgroundColor: i % 2 === 0 ? 'var(--row-odd, #f8fafc)' : 'var(--card-bg, white)'
                                                }}>
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>{q.project_type || 'Unspecified'}</div>
                                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{q.quote_number || `#${q.id}`}</div>
                                                    </div>
                                                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--primary)' }}>
                                                        ₦{calculateGrandTotal(q).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Discount input — only when discount statement selected */}
                                {docType === 'discount_statement' && (
                                    <div>
                                        {/* Original sum display */}
                                        <div style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '12px 16px', backgroundColor: 'var(--row-odd, #f8fafc)',
                                            borderRadius: '10px', marginBottom: '14px'
                                        }}>
                                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Original Total</span>
                                            <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)' }}>₦{originalSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>

                                        <div className="form-group" style={{ marginBottom: savings > 0 ? '10px' : '0' }}>
                                            <label className="form-label" style={{ fontWeight: 600 }}>Final Agreed Price (₦)</label>
                                            <input
                                                type="number"
                                                className="form-control"
                                                placeholder={`Enter final price (max ₦${originalSum.toLocaleString()})`}
                                                value={discountedPrice}
                                                onChange={(e) => setDiscountedPrice(e.target.value)}
                                                style={{ fontSize: '16px', fontWeight: 600 }}
                                                autoFocus
                                            />
                                        </div>

                                        {savings > 0 && (
                                            <div style={{
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                padding: '10px 16px', backgroundColor: '#f0fdf4',
                                                borderRadius: '8px', border: '1px solid #bbf7d0'
                                            }}>
                                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#166534' }}>Client saves</span>
                                                <span style={{ fontSize: '16px', fontWeight: 800, color: '#16a34a' }}>₦{savings.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div style={{ padding: '16px 28px 24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button className="btn btn-outline" onClick={() => setIsDocModalOpen(false)} disabled={generatingDoc}>
                                    Cancel
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleGenerateDocument}
                                    disabled={generatingDoc || (docType === 'discount_statement' && (!discountedPrice || parseFloat(discountedPrice) >= originalSum))}
                                    style={{ minWidth: '120px' }}
                                >
                                    {generatingDoc ? 'Generating...' : `Create ${docType === 'project_scope' ? 'Scope' : 'Discount'}`}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
