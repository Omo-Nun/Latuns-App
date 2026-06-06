"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowLeft, Save, GripVertical } from "lucide-react";
import Link from "next/link";
import { numberToWords } from "@/lib/numberToWords";
import { calcSundries, calcGrandTotal } from "@/lib/financeUtils";

type InventoryItem = { id: number; name: string; unit: string; description: string; default_price: number; tags?: string; };
type Agent = { id: number; name: string; };

// CSS class added to inputs that were restored from a saved draft
const DRAFT_GLOW_STYLE: React.CSSProperties = {
    boxShadow: '0 0 0 2px rgba(35, 37, 161, 0.35)',
    borderColor: 'var(--primary)',
    transition: 'box-shadow 1.5s ease-out, border-color 1.5s ease-out',
};

export default function NewQuotationPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Data sources
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [subsidiaries, setSubsidiaries] = useState<string[]>(['LATUNS ROOFING SYSTEM', 'LATUNS ESTATE DEVELOPERS']);

    // Track if form data was restored from a saved draft so we can glow those fields
    const [draftRestored, setDraftRestored] = useState(false);
    const [restoredFields, setRestoredFields] = useState<Set<string>>(new Set());

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
    const [headerNote, setHeaderNote] = useState("");
    const [projectScope, setProjectScope] = useState("");
    const [discountStatement, setDiscountStatement] = useState("");
    const [settings, setSettings] = useState<any>(null);
    const [availableStates, setAvailableStates] = useState<string[]>([]);

    // Dynamic line items
    const [items, setItems] = useState<{
        id: string;
        description: string;
        qty: string;
        unit: string;
        unit_cost: string;
    }[]>([{ id: Date.now().toString(), description: "", qty: "1", unit: "pcs", unit_cost: "0" }]);

    const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

    useEffect(() => {
        Promise.all([
            fetch("/api/inventory").then(res => res.json()),
            fetch("/api/agents?role=Roof+Estimator").then(res => res.json()),
            fetch("/api/settings").then(res => res.json()),
            fetch("/api/clients/states").then(res => res.json()),
        ]).then(([invData, agentsData, settingsData, statesData]) => {
            setInventory(Array.isArray(invData) ? invData : []);
            setAgents(Array.isArray(agentsData) ? agentsData : []);
            setSettings(settingsData && !settingsData.error ? settingsData : null);
            setAvailableStates(Array.isArray(statesData) ? statesData : []);

            // Load subsidiaries from settings
            if (settingsData && settingsData.subsidiaries) {
                try { setSubsidiaries(JSON.parse(settingsData.subsidiaries)); } catch { }
            }

            // Restore state from local storage
            const savedData = localStorage.getItem('quotationBuilderState');
            const restored = new Set<string>();
            if (savedData) {
                try {
                    const parsed = JSON.parse(savedData);
                    if (parsed.clientName) { setClientName(parsed.clientName); restored.add('clientName'); }
                    if (parsed.clientPhone) { setClientPhone(parsed.clientPhone); restored.add('clientPhone'); }
                    if (parsed.clientAddress) { setClientAddress(parsed.clientAddress); restored.add('clientAddress'); }
                    if (parsed.clientState) { setClientState(parsed.clientState); restored.add('clientState'); }
                    if (parsed.clientCity) { setClientCity(parsed.clientCity); restored.add('clientCity'); }
                    if (parsed.subsidiaryName) { setSubsidiaryName(parsed.subsidiaryName); restored.add('subsidiaryName'); }
                    if (parsed.agentId) { setAgentId(parsed.agentId); restored.add('agentId'); }
                    if (parsed.sundriesStr) { setSundriesStr(parsed.sundriesStr); restored.add('sundriesStr'); }
                    if (parsed.transportationStr) { setTransportationStr(parsed.transportationStr); restored.add('transportationStr'); }
                    if (parsed.discountStr) { setDiscountStr(parsed.discountStr); restored.add('discountStr'); }
                    if (parsed.projectType) { setProjectType(parsed.projectType); restored.add('projectType'); }
                    if (parsed.headerNote) { setHeaderNote(parsed.headerNote); restored.add('headerNote'); }
                    if (parsed.projectScope) { setProjectScope(parsed.projectScope); restored.add('projectScope'); }
                    if (parsed.discountStatement) { setDiscountStatement(parsed.discountStatement); restored.add('discountStatement'); }
                    if (parsed.items && parsed.items.length > 0) { setItems(parsed.items); restored.add('items'); }
                } catch (e) {
                    console.error('Failed to parse saved state', e);
                }
            }
            if (restored.size > 0) {
                setRestoredFields(restored);
                setDraftRestored(true);
                // Remove glow after 4 seconds
                setTimeout(() => setDraftRestored(false), 4000);
            }

            setLoading(false);
        });
    }, []);

    useEffect(() => {
        if (loading) return;
        localStorage.setItem('quotationBuilderState', JSON.stringify({
            clientName, clientPhone, clientAddress, clientState, clientCity, subsidiaryName, agentId, sundriesStr, transportationStr, discountStr, projectType, items, headerNote, projectScope, discountStatement
        }));
    }, [clientName, clientPhone, clientAddress, clientState, clientCity, subsidiaryName, agentId, sundriesStr, transportationStr, discountStr, projectType, items, headerNote, projectScope, discountStatement, loading]);

    const projectTypes = useMemo(() => {
        const types = new Set<string>();
        inventory.forEach(i => {
            if (i.tags) types.add(i.tags);
        });
        return Array.from(types).sort();
    }, [inventory]);

    const handleProjectTypeChange = (type: string) => {
        setProjectType(type);
        if (!type) return;

        // Auto-fill header note based on project type template
        if (settings && settings.quotationTemplates) {
            try {
                const allTpl = JSON.parse(settings.quotationTemplates);
                const typeKey = type.toLowerCase().replace(/\s+/g, '_');
                const tpl = { ...allTpl.configs?.[typeKey] || allTpl.configs?.['default'] || {} };
                if (tpl.headerNote) {
                    setHeaderNote(tpl.headerNote);
                }
                if (tpl.projectScope) {
                    setProjectScope(tpl.projectScope);
                }
                if (tpl.discountStatement) {
                    setDiscountStatement(tpl.discountStatement);
                }
            } catch (e) {
                // Ignore parse errors
            }
        }

        const tagItems = inventory.filter(i => i.tags === type);
        if (tagItems.length > 0) {
            const newItems = tagItems.map((i, idx) => ({
                id: Date.now().toString() + idx,
                description: i.name,
                qty: "",
                unit: i.unit,
                unit_cost: (i.default_price || 0).toString()
            }));
            setItems(newItems);
        }
    };

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
                // If they select an inventory item, auto-fill unit, description, and unit_cost defaults
                if (field === 'description') {
                    const invItem = inventory.find(i => i.name === value);
                    if (invItem) return { ...item, description: value, unit: invItem.unit, unit_cost: (invItem.default_price || 0).toString() };
                }
                return { ...item, [field]: value };
            }
            return item;
        }));
    };

    const handleDragStart = (index: number) => {
        setDraggedItemIndex(index);
    };

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

    const handleDrop = () => {
        setDraggedItemIndex(null);
    };

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
        
        // Use finance utils
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
                project_type: projectType,
                subsidiary_name: subsidiaryName,
                agent_id: agentId ? parseInt(agentId) : null,
                sundries: sundriesStr,
                transportation: calculations.trans,
                discount_value: calculations.discount,
                header_note: headerNote,
                project_scope: projectScope,
                discount_statement: discountStatement,
                items: validItems
            };

            const res = await fetch("/api/quotations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (res.ok) {
                localStorage.removeItem('quotationBuilderState');
                router.push(`/quotations/${data.id}`);
            } else {
                alert(data.error || "Failed to save quotation");
            }
        } catch (error) {
            alert("An error occurred");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div>Loading builder...</div>;

    return (
        <div style={{ maxWidth: "1000px" }}>
            <div className="page-header" style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                    <Link href="/quotations" className="btn btn-outline" style={{ padding: "8px" }}>
                        <ArrowLeft size={16} />
                    </Link>
                    <div>
                        <h1 className="page-title" style={{ marginBottom: 0 }}>New Quotation</h1>
                        <p className="page-description">Build a dynamic quote and lock prices</p>
                    </div>
                </div>
            </div>

            <div className="card" style={{ marginBottom: "24px" }}>
                <h2 style={{ fontSize: "16px", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>Client & Project Info</h2>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Client Name <span style={{ color: "red" }}>*</span></label>
                        <input type="text" className="form-control" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Full Name or Company" required
                            style={draftRestored && restoredFields.has('clientName') ? DRAFT_GLOW_STYLE : {}} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Client Phone</label>
                        <input type="text" className="form-control" value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="Phone Number"
                            style={draftRestored && restoredFields.has('clientPhone') ? DRAFT_GLOW_STYLE : {}} />
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                    <div className="form-group" style={{ marginBottom: 0, gridColumn: "1 / -1" }}>
                        <label className="form-label">Client Address</label>
                        <input type="text" className="form-control" value={clientAddress} onChange={e => setClientAddress(e.target.value)} placeholder="Address / Location"
                            style={draftRestored && restoredFields.has('clientAddress') ? DRAFT_GLOW_STYLE : {}} />
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Client State</label>
                        <input type="text" list="states-list" className="form-control" value={clientState} onChange={e => setClientState(e.target.value)} placeholder="e.g. Lagos, Abuja"
                            style={draftRestored && restoredFields.has('clientState') ? DRAFT_GLOW_STYLE : {}} />
                        <datalist id="states-list">
                            {availableStates.map(s => <option key={s} value={s} />)}
                        </datalist>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Client City</label>
                        <input type="text" className="form-control" value={clientCity} onChange={e => setClientCity(e.target.value)} placeholder="e.g. Lekki, Ikeja"
                            style={draftRestored && restoredFields.has('clientCity') ? DRAFT_GLOW_STYLE : {}} />
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Subsidiary Company</label>
                        <select className="form-control" value={subsidiaryName} onChange={e => setSubsidiaryName(e.target.value)}
                            style={draftRestored && restoredFields.has('subsidiaryName') ? DRAFT_GLOW_STYLE : {}}>
                            {subsidiaries.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Roof Estimator (Agent)</label>
                        <select className="form-control" value={agentId} onChange={e => setAgentId(e.target.value)}
                            style={draftRestored && restoredFields.has('agentId') ? DRAFT_GLOW_STYLE : {}}>
                            <option value="">-- No Agent Selected --</option>
                            {agents.map(a => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px", marginTop: "16px" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Project Type (Auto-populates items)</label>
                        <select className="form-control" value={projectType} onChange={e => handleProjectTypeChange(e.target.value)}
                            style={draftRestored && restoredFields.has('projectType') ? DRAFT_GLOW_STYLE : {}}>
                            <option value="">-- Start from Scratch --</option>
                            {projectTypes.map(pt => (
                                <option key={pt} value={pt}>{pt}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Header Note (Optional) <span style={{ fontSize: "11px", fontWeight: "normal", color: "#64748b", marginLeft: "8px" }}>Appears below the quotation header</span></label>
                        <textarea
                            className="form-control"
                            rows={2}
                            value={headerNote}
                            onChange={e => setHeaderNote(e.target.value)}
                            placeholder="E.g. Quotation for roofing materials and installation..."
                            style={draftRestored && restoredFields.has('headerNote') ? DRAFT_GLOW_STYLE : {}}
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
                                placeholder="Specific project scope for this quotation..."
                                style={draftRestored && restoredFields.has('projectScope') ? { ...DRAFT_GLOW_STYLE, resize: 'vertical' } : { resize: 'vertical' }}
                            ></textarea>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Discount Statement (Editable)</label>
                            <textarea
                                className="form-control"
                                rows={4}
                                value={discountStatement}
                                onChange={e => setDiscountStatement(e.target.value)}
                                placeholder="e.g. Loyalty discount applied as agreed..."
                                style={draftRestored && restoredFields.has('discountStatement') ? { ...DRAFT_GLOW_STYLE, resize: 'vertical' } : { resize: 'vertical' }}
                            ></textarea>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card" style={{ marginBottom: "24px", padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "var(--row-odd)" }}>
                    <h2 style={{ fontSize: "16px", margin: 0 }}>Line Items</h2>
                    <button className="btn btn-accent" style={{ padding: "6px 12px", fontSize: "13px" }} onClick={addItemRow}>
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
                                    style={{
                                        opacity: draggedItemIndex === index ? 0.5 : 1,
                                        cursor: 'grab'
                                    }}
                                >
                                    <td style={{ padding: "12px", textAlign: "center", color: "var(--text-muted)" }}>
                                        <GripVertical size={16} style={{ cursor: 'grab' }} />
                                    </td>
                                    <td style={{ padding: "12px" }}>
                                        <input
                                            type="text"
                                            list="inventory-list"
                                            className="form-control"
                                            value={item.description}
                                            onChange={e => updateItem(item.id, "description", e.target.value)}
                                            placeholder="Item description"
                                            data-row={index}
                                            data-field="description"
                                            onKeyDown={e => handleGridKeyDown(e, index, "description")}
                                        />
                                        <datalist id="inventory-list">
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
                                        <button className="btn btn-outline" style={{ color: "red", padding: "6px" }} onClick={() => removeItemRow(item.id)}>
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
                            <input
                                type="text"
                                className="form-control"
                                value={sundriesStr}
                                onChange={e => setSundriesStr(e.target.value)}
                                placeholder="0 or 10%"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Transportation & Logistics (₦)</label>
                            <input
                                type="number"
                                min="0"
                                step="any"
                                className="form-control"
                                value={transportationStr}
                                onChange={e => setTransportationStr(e.target.value)}
                                placeholder="0"
                            />
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
                                placeholder="0"
                                style={{ borderColor: "var(--accent)" }}
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
                <Link href="/quotations" className="btn btn-outline" onClick={() => localStorage.removeItem('quotationBuilderState')}>
                    Cancel
                </Link>
                <button className="btn btn-primary" style={{ padding: "12px 24px", fontSize: "16px" }} onClick={handleSubmit} disabled={saving}>
                    <Save size={18} /> {saving ? "Saving..." : "Save & Preview Quotation"}
                </button>
            </div>
        </div>
    );
}
