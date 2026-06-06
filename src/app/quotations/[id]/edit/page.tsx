"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { Plus, Trash2, ArrowLeft, Save, GripVertical } from "lucide-react";
import Link from "next/link";
import { numberToWords } from "@/lib/numberToWords";
import { calcSundries, calcGrandTotal } from "@/lib/financeUtils";

type InventoryItem = { id: number; name: string; unit: string; description: string; default_price: number; };
type Agent = { id: number; name: string; };

export default function EditQuotationPage() {
    const router = useRouter();
    const { id } = useParams();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Data sources
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [subsidiaries, setSubsidiaries] = useState<string[]>(['LATUNS ROOFING SYSTEM', 'LATUNS ESTATE DEVELOPERS']);

    // Form state
    const [clientName, setClientName] = useState("");
    const [clientPhone, setClientPhone] = useState("");
    const [clientAddress, setClientAddress] = useState("");
    const [clientState, setClientState] = useState("");
    const [clientCity, setClientCity] = useState("");
    const [subsidiaryName, setSubsidiaryName] = useState("LATUNS ROOFING SYSTEM");
    const [agentId, setAgentId] = useState("");
    const [sundriesStr, setSundriesStr] = useState("0");
    const [transportationStr, setTransportationStr] = useState("0");
    const [discountStr, setDiscountStr] = useState("0");
    const [projectType, setProjectType] = useState("");
    const [quoteNumber, setQuoteNumber] = useState("");
    const [headerNote, setHeaderNote] = useState("");
    const [projectScope, setProjectScope] = useState("");
    const [discountStatement, setDiscountStatement] = useState("");
    const [availableStates, setAvailableStates] = useState<string[]>([]);
    const [settings, setSettings] = useState<any>(null);

    // Dynamic line items
    const [items, setItems] = useState<{
        id: string;
        description: string;
        qty: string;
        unit: string;
        unit_cost: string;
    }[]>([{ id: Date.now().toString(), description: "", qty: "1", unit: "pcs", unit_cost: "0" }]);

    const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

    // Add quote raw data storage
    const [quoteObj, setQuoteObj] = useState<any>(null);

    useEffect(() => {
        Promise.all([
            fetch("/api/inventory").then(res => res.json()),
            fetch("/api/agents?role=Roof+Estimator").then(res => res.json()),
            fetch(`/api/quotations/${id}`).then(res => res.json()),
            fetch("/api/settings").then(res => res.json()),
            fetch("/api/clients/states").then(res => res.json()),
        ]).then(([invData, agentsData, quoteData, settingsData, statesData]) => {
            if (quoteData.error) {
                alert("Quotation not found");
                router.push("/quotations");
                return;
            }

            setInventory(invData);
            setAgents(agentsData);
            setQuoteObj(quoteData);
            setAvailableStates(statesData);
            setSettings(settingsData);

            // Load subsidiaries from settings
            if (settingsData.subsidiaries) {
                try { setSubsidiaries(JSON.parse(settingsData.subsidiaries)); } catch { }
            }

            // Populate form
            setClientName(quoteData.client_name || "");
            setClientPhone(quoteData.client_phone || "");
            setClientAddress(quoteData.client_address || "");
            setClientState(quoteData.client_state || "");
            setClientCity(quoteData.client_city || "");
            setSubsidiaryName(quoteData.subsidiary_name || "LATUNS ROOFING SYSTEM");
            setAgentId(quoteData.agent_id ? quoteData.agent_id.toString() : "");
            setSundriesStr(quoteData.sundries || "0");
            setTransportationStr(quoteData.transportation?.toString() || "0");
            setDiscountStr(quoteData.discount_value?.toString() || "0");
            setProjectType(quoteData.project_type || "");
            setQuoteNumber(quoteData.quote_number || "");
            setHeaderNote(quoteData.header_note || "");
            setProjectScope(quoteData.project_scope || "");
            setDiscountStatement(quoteData.discount_statement || "");

            if (quoteData.items && quoteData.items.length > 0) {
                setItems(quoteData.items.map((it: any) => ({
                    id: it.id.toString(),
                    description: it.description,
                    qty: it.qty.toString(),
                    unit: it.unit,
                    unit_cost: it.unit_cost.toString()
                })));
            }

            setLoading(false);
        }).catch(() => {
            alert("Error loading data");
            router.push("/quotations");
        });
    }, [id, router]);

    // Derive project types from inventory
    const projectTypes = useMemo(() => {
        const types = new Set<string>();
        inventory.forEach(i => { if ((i as any).tags) types.add((i as any).tags); });
        return Array.from(types).sort();
    }, [inventory]);

    const addItemRow = () => {
        setItems([...items, { id: Date.now().toString(), description: "", qty: "1", unit: "pcs", unit_cost: "0" }]);
    };

    const removeItemRow = (id: string) => {
        if (items.length === 1) return;
        setItems(items.filter(item => item.id !== id));
    };

    const updateItem = (id: string, field: string, value: string) => {
        setItems(items.map(item => {
            if (item.id === id) {
                if (field === 'description') {
                    const invItem = inventory.find(i => i.name === value);
                    if (invItem) return { ...item, description: value, unit: invItem.unit, unit_cost: (invItem.default_price || 0).toString() };
                }
                return { ...item, [field]: value };
            }
            return item;
        }));
    };

    const handleDragStart = (index: number) => setDraggedItemIndex(index);

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedItemIndex === null || draggedItemIndex === index) return;
        const updatedItems = [...items];
        const draggedItem = updatedItems[draggedItemIndex];
        updatedItems.splice(draggedItemIndex, 1);
        updatedItems.splice(index, 0, draggedItem);
        setDraggedItemIndex(index);
        setItems(updatedItems);
    };

    const handleDrop = () => setDraggedItemIndex(null);

    const handleGridKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number, field: string) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            if (e.currentTarget.type === 'number') {
                e.preventDefault();
            }
            const targetIndex = e.key === 'ArrowUp' ? index - 1 : index + 1;
            const targetInput = document.querySelector(`input[data-row="${targetIndex}"][data-field="${field}"]`) as HTMLInputElement;
            if (targetInput) {
                targetInput.focus();
                setTimeout(() => targetInput.select(), 0);
            }
        }
    };

    // Calculations
    const calculations = useMemo(() => {
        const lines = items.map(item => {
            const q = parseFloat(item.qty) || 0;
            const c = parseFloat(item.unit_cost) || 0;
            return { ...item, total: q * c, q, c };
        });

        const subtotal = Math.round((lines.reduce((acc, curr) => acc + curr.total, 0) + Number.EPSILON) * 100) / 100;

        const dummyQuotation = {
            subtotal,
            sundries: sundriesStr,
            transportation: transportationStr,
            discount_value: parseFloat(discountStr) || 0
        };

        const sundries = calcSundries(dummyQuotation);
        const trans = parseFloat(transportationStr) || 0;
        const discount = parseFloat(discountStr) || 0;
        const grandTotal = calcGrandTotal(dummyQuotation);
        const netTotal = grandTotal - discount;

        return { lines, subtotal, sundries, trans, discount, grandTotal, netTotal };
    }, [items, sundriesStr, transportationStr, discountStr]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientName) return alert("Client name is required");

        const validItems = calculations.lines.map(l => ({
            description: l.description,
            qty: l.q,
            unit: l.unit,
            unit_cost: l.c,
            total: l.total
        })).filter(l => l.description && l.qty > 0);

        if (validItems.length === 0) return alert("Please add at least one valid item");

        setSaving(true);
        try {
            const payload = {
                client_name: clientName,
                client_phone: clientPhone,
                client_address: clientAddress,
                client_state: clientState,
                client_city: clientCity,
                subsidiary_name: subsidiaryName,
                agent_id: agentId ? parseInt(agentId) : null,
                sundries: sundriesStr,
                transportation: calculations.trans,
                discount_value: calculations.discount,
                project_type: projectType,
                header_note: headerNote,
                project_scope: projectScope,
                discount_statement: discountStatement,
                quote_number: quoteNumber || undefined,
                items: validItems
            };

            const res = await fetch(`/api/quotations/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (res.ok) {
                router.push(`/quotations/${id}`);
            } else {
                alert(data.error || "Failed to update quotation");
            }
        } catch {
            alert("An error occurred");
        } finally {
            setSaving(false);
        }
    };

    if (loading || !quoteObj) return <div>Loading builder for edit...</div>;

    return (
        <div style={{ maxWidth: "1000px" }}>
            <div className="page-header" style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                    <Link href={`/quotations/${id}`} className="btn btn-outline" style={{ padding: "8px" }}>
                        <ArrowLeft size={16} />
                    </Link>
                    <div>
                        <h1 className="page-title" style={{ marginBottom: 0 }}>Edit Quotation {quoteObj.quote_number}</h1>
                        <p className="page-description">Modify dynamic quote items and lock prices</p>
                    </div>
                </div>
            </div>

            <div className="card" style={{ marginBottom: "24px" }}>
                <h2 style={{ fontSize: "16px", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>Client & Project Info</h2>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Client Name <span style={{ color: "red" }}>*</span></label>
                        <input type="text" className="form-control" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Full Name or Company" required />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Client Phone</label>
                        <input type="text" className="form-control" value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="Phone Number" />
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                    <div className="form-group" style={{ marginBottom: 0, gridColumn: "1 / -1" }}>
                        <label className="form-label">Client Address</label>
                        <input type="text" className="form-control" value={clientAddress} onChange={e => setClientAddress(e.target.value)} placeholder="Address / Location" />
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Client State</label>
                        <input type="text" list="states-list-edit" className="form-control" value={clientState} onChange={e => setClientState(e.target.value)} placeholder="e.g. Lagos, Abuja" />
                        <datalist id="states-list-edit">
                            {availableStates.map(s => <option key={s} value={s} />)}
                        </datalist>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Client City</label>
                        <input type="text" className="form-control" value={clientCity} onChange={e => setClientCity(e.target.value)} placeholder="e.g. Lekki, Ikeja" />
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Subsidiary Company</label>
                        <select className="form-control" value={subsidiaryName} onChange={e => setSubsidiaryName(e.target.value)}>
                            {subsidiaries.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Roof Estimator (Agent)</label>
                        <select className="form-control" value={agentId} onChange={e => setAgentId(e.target.value)}>
                            <option value="">-- No Agent Selected --</option>
                            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Project Type</label>
                        <select className="form-control" value={projectType} onChange={e => setProjectType(e.target.value)}>
                            <option value="">-- None --</option>
                            {projectTypes.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                        </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Quote Number (optional override)</label>
                        <input type="text" className="form-control" value={quoteNumber} onChange={e => setQuoteNumber(e.target.value)} placeholder="e.g. QC-0042" />
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Header Note (Optional)</label>
                        <textarea
                            className="form-control"
                            rows={2}
                            value={headerNote}
                            onChange={e => setHeaderNote(e.target.value)}
                            placeholder="E.g. Quotation for roofing materials and installation..."
                        ></textarea>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Project Scope Template (Editable)</label>
                            <textarea
                                className="form-control"
                                rows={4}
                                value={projectScope}
                                onChange={e => setProjectScope(e.target.value)}
                                placeholder="Specific project scope..."
                            ></textarea>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Discount Statement (Editable)</label>
                            <textarea
                                className="form-control"
                                rows={4}
                                value={discountStatement}
                                onChange={e => setDiscountStatement(e.target.value)}
                                placeholder="e.g. Loyalty discount..."
                            ></textarea>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card" style={{ marginBottom: "24px", padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "var(--row-odd)" }}>
                    <h2 style={{ fontSize: "16px", margin: 0 }}>Line Items</h2>
                    <button className="btn btn-accent" style={{ padding: "6px 12px", fontSize: "13px" }} type="button" onClick={addItemRow}>
                        <Plus size={14} /> Add Row
                    </button>
                </div>

                <table className="table" style={{ width: "100%" }}>
                    <thead>
                        <tr>
                            <th style={{ width: "3%" }}></th>
                            <th style={{ width: "37%" }}>Description</th>
                            <th style={{ width: "12%" }}>Qty</th>
                            <th style={{ width: "13%" }}>Unit</th>
                            <th style={{ width: "15%" }}>Unit Cost (₦)</th>
                            <th style={{ width: "15%" }}>Total (₦)</th>
                            <th style={{ width: "5%" }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => {
                            const rowCalc = calculations.lines[index];
                            return (
                                <tr
                                    key={item.id}
                                    draggable
                                    onDragStart={() => handleDragStart(index)}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDrop={handleDrop}
                                    onDragEnd={handleDrop}
                                    style={{ opacity: draggedItemIndex === index ? 0.5 : 1, cursor: 'grab' }}
                                >
                                    <td style={{ padding: "12px", textAlign: "center", color: "var(--text-muted)" }}>
                                        <GripVertical size={16} style={{ cursor: 'grab' }} />
                                    </td>
                                    <td style={{ padding: "12px" }}>
                                        <input
                                            type="text"
                                            list="inventory-list-edit"
                                            className="form-control"
                                            value={item.description}
                                            onChange={e => updateItem(item.id, "description", e.target.value)}
                                            placeholder="Item description"
                                            data-row={index}
                                            data-field="description"
                                            onKeyDown={e => handleGridKeyDown(e, index, "description")}
                                        />
                                        <datalist id="inventory-list-edit">
                                            {inventory.map(i => <option key={i.id} value={i.name} />)}
                                        </datalist>
                                    </td>
                                    <td style={{ padding: "12px" }}>
                                        <input 
                                            type="number" min="0" step="any" className="form-control qty-input" 
                                            value={item.qty} 
                                            onChange={e => updateItem(item.id, "qty", e.target.value)}
                                            data-row={index}
                                            data-field="qty"
                                            onKeyDown={e => handleGridKeyDown(e, index, "qty")}
                                            onWheel={e => e.currentTarget.blur()}
                                        />
                                    </td>
                                    <td style={{ padding: "12px" }}>
                                        <input 
                                            type="text" className="form-control" 
                                            value={item.unit} 
                                            onChange={e => updateItem(item.id, "unit", e.target.value)} 
                                            data-row={index}
                                            data-field="unit"
                                            onKeyDown={e => handleGridKeyDown(e, index, "unit")}
                                        />
                                    </td>
                                    <td style={{ padding: "12px" }}>
                                        <input 
                                            type="number" min="0" step="any" className="form-control" 
                                            value={item.unit_cost} 
                                            onChange={e => updateItem(item.id, "unit_cost", e.target.value)} 
                                            data-row={index}
                                            data-field="unit_cost"
                                            onKeyDown={e => handleGridKeyDown(e, index, "unit_cost")}
                                            onWheel={e => e.currentTarget.blur()}
                                        />
                                    </td>
                                    <td style={{ padding: "12px", fontWeight: "600", verticalAlign: "middle" }}>
                                        {(rowCalc.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td style={{ padding: "12px", textAlign: "right" }}>
                                        <button className="btn btn-outline" style={{ color: "red", padding: "6px" }} type="button" onClick={() => removeItemRow(item.id)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div style={{ display: "flex", gap: "24px" }}>
                <div style={{ flex: 1 }}>
                    <div className="card">
                        <h2 style={{ fontSize: "16px", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>Additional Fees</h2>
                        <div className="form-group">
                            <label className="form-label">Sundries / Workmanship (e.g. 10% or 50000)</label>
                            <input type="text" className="form-control" value={sundriesStr} onChange={e => setSundriesStr(e.target.value)} placeholder="0 or 10%" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Transportation & Logistics (₦)</label>
                            <input type="number" min="0" step="any" className="form-control" value={transportationStr} onChange={e => setTransportationStr(e.target.value)} placeholder="0" />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ color: "var(--accent)", fontWeight: 700 }}>Special Discount (₦)</label>
                            <input
                                type="number"
                                min="0"
                                step="any"
                                className="form-control"
                                value={discountStr}
                                onChange={e => setDiscountStr(e.target.value)}
                                style={{ borderColor: "var(--accent)" }}
                                placeholder="0"
                            />
                        </div>
                    </div>
                </div>

                <div style={{ width: "350px" }}>
                    <div className="card" style={{ backgroundColor: "var(--primary)", color: "white" }}>
                        <h2 style={{ fontSize: "16px", marginBottom: "16px", paddingBottom: "8px", borderBottom: "1px solid rgba(255,255,255,0.1)", color: "white" }}>Quotation Summary</h2>

                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", fontSize: "14px", color: "rgba(255,255,255,0.7)" }}>
                            <span>Sub-total:</span>
                            <span>₦{calculations.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", fontSize: "14px", color: "rgba(255,255,255,0.7)" }}>
                            <span>Sundries:</span>
                            <span>₦{calculations.sundries.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", fontSize: "14px", color: "rgba(255,255,255,0.7)" }}>
                            <span>Transportation:</span>
                            <span>₦{calculations.trans.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>

                        {calculations.discount > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", fontSize: "14px", color: "var(--accent)" }}>
                                <span>Discount:</span>
                                <span>- ₦{calculations.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        )}

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "16px", borderTop: "1px dashed rgba(255,255,255,0.2)" }}>
                            <span style={{ fontWeight: 600 }}>{calculations.discount > 0 ? "Net Total:" : "Grand Total:"}</span>
                            <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--accent)" }}>
                                ₦{calculations.netTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                        </div>

                        <div style={{ marginTop: "16px", padding: "12px", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: "6px" }}>
                            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", marginBottom: "4px", letterSpacing: "0.5px" }}>Amount in Words</div>
                            <div style={{ fontSize: "13px", lineHeight: "1.4", fontStyle: "italic", color: "rgba(255,255,255,0.9)" }}>
                                {numberToWords(calculations.netTotal)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card" style={{ marginTop: "32px", display: "flex", justifyContent: "flex-end", gap: "12px", alignItems: "center" }}>
                <Link href={`/quotations/${id}`} className="btn btn-outline">
                    Cancel
                </Link>
                <button className="btn btn-primary" style={{ padding: "12px 24px", fontSize: "16px" }} onClick={handleSubmit} disabled={saving}>
                    <Save size={18} /> {saving ? "Saving..." : "Update & Preview Quotation"}
                </button>
            </div>
        </div>
    );
}
