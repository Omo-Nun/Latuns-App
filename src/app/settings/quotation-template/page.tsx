"use client";

import { useState, useEffect, useCallback } from "react";
import { Save, ArrowLeft, RotateCcw, MapPin, Phone, Mail, Globe, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuotationTemplate {
    primaryColor: string;
    accentColor: string;
    badgeColor: string;
    watermarkColor: string;
    logoHeight: number;
    showAddress: boolean;
    showPhone: boolean;
    showEmail: boolean;
    showWebsite: boolean;
    altRows: boolean;
    altRowColor?: string;
    showUnitCost: boolean;
    showAmountWords: boolean;
    showBankDetails: boolean;
    showSignature: boolean;
    fontSize: number;
    padding: "compact" | "normal" | "spacious";
    headerNote: string;
    footerNote: string;
    projectScope: string;           // scope of work block printed above the items table
    discountStatement: string;      // note printed beneath the discount line in totals
    logo?: string;                  // Base64 logo
    roofEstimatorName: string;
    headerNoteFontSize: number;
    // Advanced Styling
    tableBorderWidth: number;
    tableBorderColor: string;
    headerShaded: boolean;
    badgeTextOverride: string;
    // Header & Footer section colors
    headerLeftColor: string;
    headerRightColor: string;
    headerAccentLineColor: string;
    footerTopStripColor: string;
    footerBottomStripColor: string;
    columns: { id: string; label: string; visible: boolean; width: string; align: 'left' | 'center' | 'right' }[];
}

export const DEFAULT_TEMPLATE: QuotationTemplate = {
    primaryColor: "#1A2980",
    accentColor: "#e8813a",
    badgeColor: "#b91c1c",
    watermarkColor: "#b91c1c",
    logoHeight: 70,
    showAddress: true,
    showPhone: true,
    showEmail: true,
    showWebsite: true,
    altRows: true,
    altRowColor: "#f1f5f9",
    showUnitCost: true,
    showAmountWords: true,
    showBankDetails: true,
    showSignature: true,
    fontSize: 13,
    padding: "normal",
    headerNote: "",
    footerNote: "Your reliable roofing partner.",
    projectScope: "",
    discountStatement: "",
    logo: "",
    roofEstimatorName: "",
    headerNoteFontSize: 12,
    tableBorderWidth: 1,
    tableBorderColor: "#e2e8f0",
    headerShaded: true,
    badgeTextOverride: "",
    headerLeftColor: "#b91c1c",
    headerRightColor: "#1A2980",
    headerAccentLineColor: "#b91c1c",
    footerTopStripColor: "#b91c1c",
    footerBottomStripColor: "#1A2980",
    columns: [
        { id: 'description', label: 'Description', visible: true, width: 'auto', align: 'left' },
        { id: 'qty', label: 'Qty', visible: true, width: '80px', align: 'center' },
        { id: 'unit', label: 'Unit', visible: true, width: '80px', align: 'center' },
        { id: 'unit_cost', label: 'Cost (₦)', visible: true, width: '120px', align: 'right' },
        { id: 'total', label: 'Total (₦)', visible: true, width: '140px', align: 'right' }
    ]
};

const PADDING_VALUES = { compact: "8px 24px", normal: "24px 40px", spacious: "40px 56px" };

// ─── Built-in project type tabs ───────────────────────────────────────────────

const BASE_TABS = ["Default"];

function tabKey(tab: string) {
    if (tab === "Default") return "default";
    if (tab === "Project Scope") return "project_scope";
    if (tab === "Discount Statement") return "discount_statement";
    return tab.toLowerCase().replace(/\s+/g, "_");
}

// ─── Mini Preview ─────────────────────────────────────────────────────────────

function QuotationPreview({ tpl, companyInfo, currentTab }: { tpl: QuotationTemplate; companyInfo: any; currentTab: string }) {
    const pad = { compact: "6px 14px", normal: "12px 20px", spacious: "18px 28px" }[tpl.padding];
    const fs = tpl.fontSize;
    const rowBg = (i: number) => (tpl.altRows && i % 2 === 1 ? (tpl.altRowColor || (tpl.primaryColor + '08')) : "#ffffff"); 

    const sampleItems = [
        { desc: "Stone Coated Roofing Sheets", qty: 120, unit: "Pcs", cost: 4500, total: 540000 },
        { desc: "Ridge Caps", qty: 20, unit: "Pcs", cost: 1200, total: 24000 },
        { desc: "Roofing Nails (5kg pack)", qty: 10, unit: "Pack", cost: 2500, total: 25000 },
    ];

    const visibleCols = (tpl.columns || DEFAULT_TEMPLATE.columns).filter(c => c.visible);

    return (
        <div style={{
            width: "100%",
            backgroundColor: "#ffffff",
            color: "#000",
            fontFamily: "'Inter', sans-serif",
            fontSize: `${fs}px`,
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            overflow: "hidden",
            boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        }}>
            {/* Slanted Header Preview (SVG) */}
            <div style={{ position: "relative", width: "100%", height: "70px" }}>
                <svg width="100%" height="60px" preserveAspectRatio="none" viewBox="0 0 100 100" style={{ position: "absolute", top: 0, left: 0, zIndex: 1 }}>
                    <polygon points="40,0 100,0 100,100 30,100" fill={tpl.headerRightColor || tpl.primaryColor} />
                    <polygon points="0,0 60,0 51,100 0,100" fill={tpl.headerLeftColor || tpl.badgeColor} />
                </svg>
                <div style={{ position: "absolute", bottom: "4px", right: 0, width: "40%", height: "2px", backgroundColor: tpl.headerAccentLineColor || tpl.headerLeftColor || tpl.badgeColor, zIndex: 2 }} />
                <div style={{ position: "relative", zIndex: 3, display: "flex", height: "60px", width: "100%" }}>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: "12px" }}>
                        {tpl.logo ? (
                            <img src={tpl.logo} alt="Logo" style={{ maxHeight: `${Math.round(tpl.logoHeight * 0.35)}px`, maxWidth: '80px', objectFit: 'contain' }} />
                        ) : (
                            <div style={{ width: "60px", height: `${Math.round(tpl.logoHeight * 0.35)}px`, background: "rgba(255,255,255,0.3)", borderRadius: "3px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "7px", fontWeight: 700 }}>LOGO</div>
                        )}
                        <div style={{ fontSize: "7px", color: "white", fontWeight: 700, marginTop: "2px" }}>Your Tagline Space</div>
                    </div>
                    <div style={{ width: "160px", display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center", paddingRight: "5px" }}>
                        <div style={{ fontSize: "18px", fontWeight: 950, color: tpl.watermarkColor || tpl.badgeColor, textTransform: "uppercase", letterSpacing: "1px", lineHeight: 1.1, textAlign: "right" }}>
                            {tpl.badgeTextOverride || "General Project"}
                        </div>
                        <div style={{ fontSize: "8px", color: "white", marginTop: "4px", fontWeight: 800, display: "flex", gap: "4px", alignItems: "center" }}>
                            <span>{currentTab === "Project Scope" ? "SCOPE" : currentTab === "Discount Statement" ? "STATEMENT" : "QUOTATION"}</span>
                            <span style={{ opacity: 0.5 }}>|</span>
                            <span>QC-0001</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Meta row preview */}
            <div style={{ padding: "4px 14px 8px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontSize: "7px", color: "#475569", lineHeight: 1.5 }}>
                    {tpl.showAddress && companyInfo.companyAddress && <div style={{ display: "flex", alignItems: "center", gap: "4px" }}><MapPin size={8} style={{ color: tpl.primaryColor }} /> <span>{companyInfo.companyAddress}</span></div>}
                    {tpl.showPhone && companyInfo.companyPhone && <div style={{ display: "flex", alignItems: "center", gap: "4px" }}><Phone size={8} style={{ color: tpl.primaryColor }} /> <span>{companyInfo.companyPhone}</span></div>}
                    <div style={{ display: "flex", gap: "10px" }}>
                        {tpl.showEmail && companyInfo.companyEmail && <div style={{ display: "flex", alignItems: "center", gap: "4px" }}><Mail size={8} style={{ color: tpl.primaryColor }} /> <span>{companyInfo.companyEmail}</span></div>}
                        {tpl.showWebsite && companyInfo.companyWebsite && <div style={{ display: "flex", alignItems: "center", gap: "4px" }}><Globe size={8} style={{ color: tpl.primaryColor }} /> <span>{companyInfo.companyWebsite}</span></div>}
                    </div>
                </div>
                <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "9px", color: "#1e293b", fontWeight: 800, marginTop: "4px" }}>Date: Mar 4, 2026</div>
                </div>
            </div>

            {/* Side-by-side metadata layout */}
            <div style={{ display: "flex", gap: "20px", margin: "10px 20px" }}>
                {/* Client Details (Left) */}
                <div style={{ flex: 1, padding: "8px 12px", backgroundColor: "#f8fafc", borderRadius: "6px", borderLeft: `4px solid ${tpl.primaryColor}` }}>
                    <div style={{ fontSize: "8px", textTransform: "uppercase", color: "#64748b", fontWeight: 700, letterSpacing: "1px", marginBottom: "2px" }}>
                        {currentTab === "Invoice" ? "Bill To" : "Quotation For"}
                    </div>
                    <div style={{ fontSize: "12px", fontWeight: 800, color: tpl.primaryColor }}>Sample Client Name</div>
                    <div style={{ color: "#475569", fontSize: "9px" }}>12 Example Street, Lagos</div>
                </div>

                {/* Header Note & Roof Estimator (Right) */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                    {tpl.headerNote && (
                        <div style={{ padding: "8px 12px", backgroundColor: "#fafafa", borderRadius: "6px", border: "1px dashed #e2e8f0" }}>
                            <div style={{ fontSize: `${tpl.headerNoteFontSize}px`, color: "#1e293b", fontWeight: 800, lineHeight: 1.4 }}>
                                {tpl.headerNote}
                            </div>
                        </div>
                    )}
                    {(tpl.roofEstimatorName || "John Doe (Example)") && (
                        <div style={{ paddingLeft: "12px", borderLeft: "2px solid #cbd5e1", marginTop: "4px" }}>
                            <div style={{ fontSize: "10px", textTransform: "uppercase", color: "#64748b", fontWeight: 700, letterSpacing: "0.5px" }}>Roof Estimator</div>
                            <div style={{ fontSize: "12px", fontWeight: 800, color: "#1e293b" }}>{tpl.roofEstimatorName || "John Doe (Example)"}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Project Scope block */}
            {tpl.projectScope && (
                <div style={{ margin: "10px 20px", padding: "10px 14px", backgroundColor: "#f0f9ff", borderRadius: "6px", borderLeft: `4px solid ${tpl.primaryColor}` }}>
                    <div style={{ fontSize: "8px", textTransform: "uppercase", color: "#64748b", fontWeight: 700, letterSpacing: "1px", marginBottom: "4px" }}>Scope of Work</div>
                    <div style={{ fontSize: "9px", color: "#1e293b", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{tpl.projectScope}</div>
                </div>
            )}

            {/* Items table */}
            <div style={{ margin: "0 20px 10px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", border: `${tpl.tableBorderWidth}px solid ${tpl.tableBorderColor}` }}>
                    <thead>
                        <tr>
                            {visibleCols.map(col => (
                                <th key={col.id} style={{
                                    backgroundColor: tpl.headerShaded ? tpl.primaryColor : 'transparent',
                                    color: tpl.headerShaded ? 'white' : tpl.primaryColor,
                                    padding: "7px 10px", textAlign: col.align as any, fontSize: "9px", textTransform: "uppercase",
                                    border: `${tpl.tableBorderWidth}px solid ${tpl.tableBorderColor}`,
                                    width: col.width
                                }}>
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sampleItems.map((item: any, i) => (
                            <tr key={i} style={{ backgroundColor: rowBg(i) }}>
                                {visibleCols.map(col => (
                                    <td key={col.id} style={{
                                        padding: "6px 10px", fontSize: "9px", fontWeight: col.id === 'description' ? 600 : 400,
                                        color: col.id === 'description' ? tpl.primaryColor : "#475569",
                                        textAlign: col.align as any,
                                        border: `${tpl.tableBorderWidth}px solid ${tpl.tableBorderColor}`
                                    }}>
                                        {col.id === 'description' ? item.desc :
                                            col.id === 'qty' ? item.qty :
                                                col.id === 'unit' ? item.unit :
                                                    col.id === 'unit_cost' ? item.cost.toLocaleString() :
                                                        col.id === 'total' ? item.total.toLocaleString() : ''}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Totals */}
            <div style={{ display: "flex", justifyContent: "flex-end", margin: "0 20px 10px" }}>
                <div style={{ width: "200px", fontSize: "9px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 10px", borderBottom: "1px solid #e2e8f0" }}>
                        <span style={{ color: "#64748b", fontWeight: 600 }}>Sub-total</span>
                        <span style={{ fontWeight: 700 }}>₦589,000.00</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 10px", borderBottom: `2px solid ${tpl.primaryColor}` }}>
                        <span style={{ color: "#64748b", fontWeight: 600 }}>Sundries/Margin</span>
                        <span style={{ fontWeight: 700 }}>₦25,000.00</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", backgroundColor: "#f8fafc" }}>
                        <span style={{ color: tpl.primaryColor, fontWeight: 800, fontSize: "11px" }}>GRAND TOTAL</span>
                        <span style={{ fontWeight: 800, fontSize: "12px", color: tpl.accentColor }}>₦614,000.00</span>
                    </div>
                </div>
            </div>

            {/* Discount statement */}
            {tpl.discountStatement && (
                <div style={{ margin: "0 20px 8px", padding: "6px 12px", backgroundColor: "#fff7ed", borderRadius: "6px", borderLeft: "3px solid #f59e0b", fontSize: "9px", color: "#92400e", fontStyle: "italic" }}>
                    {tpl.discountStatement}
                </div>
            )}

            {/* Footer sections */}
            {(tpl.showAmountWords || tpl.showBankDetails) && (
                <div style={{ display: "flex", gap: "10px", margin: "0 20px 10px" }}>
                    {tpl.showAmountWords && (
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "8px", textTransform: "uppercase", color: "#64748b", fontWeight: 700, marginBottom: "3px" }}>Amount in Words</div>
                            <div style={{ padding: "6px", backgroundColor: "#f1f5f9", borderRadius: "4px", fontStyle: "italic", fontWeight: 600, color: tpl.primaryColor, fontSize: "8px" }}>
                                Six hundred and fourteen thousand naira only
                            </div>
                        </div>
                    )}
                    {tpl.showBankDetails && companyInfo && (
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "8px", textTransform: "uppercase", color: "#64748b", fontWeight: 700, marginBottom: "3px" }}>Bank Details</div>
                            <div style={{ padding: "6px", border: "2px dashed #cbd5e1", borderRadius: "4px", fontSize: "8px" }}>
                                <div style={{ display: "flex", marginBottom: "2px" }}><span style={{ width: "70px", color: "#64748b", fontWeight: 600 }}>Bank:</span><span style={{ fontWeight: 700, color: tpl.primaryColor }}>{companyInfo.bankName || "Zenith Bank"}</span></div>
                                <div style={{ display: "flex", marginBottom: "2px" }}><span style={{ width: "70px", color: "#64748b", fontWeight: 600 }}>Acct Name:</span><span style={{ fontWeight: 700, color: tpl.primaryColor }}>{companyInfo.accountName || "Latuns Office"}</span></div>
                                <div style={{ display: "flex" }}><span style={{ width: "70px", color: "#64748b", fontWeight: 600 }}>Acct No:</span><span style={{ fontWeight: 800, color: tpl.primaryColor, letterSpacing: "1px" }}>{companyInfo.accountNumber || "1012345678"}</span></div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {tpl.showSignature && (
                <div style={{ margin: "0 20px 14px", display: "flex", justifyContent: "space-between" }}>
                    <div style={{ width: "140px", textAlign: "center" }}>
                        <div style={{ borderBottom: `1px solid ${tpl.primaryColor}`, height: "24px", marginBottom: "4px" }}></div>
                        <div style={{ fontSize: "8px", fontWeight: 600, color: tpl.primaryColor }}>Authorized Signature</div>
                    </div>
                    <div style={{ width: "140px", textAlign: "center" }}>
                        <div style={{ borderBottom: `1px solid ${tpl.primaryColor}`, height: "24px", marginBottom: "4px" }}></div>
                        <div style={{ fontSize: "8px", fontWeight: 600, color: tpl.primaryColor }}>Client Signature / Stamp</div>
                    </div>
                </div>
            )}

            {tpl.footerNote && (
                <div style={{ padding: "4px 20px", fontSize: "8px", color: "#475569", textAlign: "center", fontStyle: "italic" }}>
                    {tpl.footerNote}
                </div>
            )}

            {/* Footer: Two equal strips */}
            <div>
                <div style={{ height: "6px", backgroundColor: tpl.footerTopStripColor || tpl.badgeColor, width: "100%" }} />
                <div style={{ height: "4px", backgroundColor: "#ffffff", width: "100%" }} />
                <div style={{ height: "6px", backgroundColor: tpl.footerBottomStripColor || tpl.primaryColor, width: "100%" }} />
            </div>
        </div>
    );
}

// ─── Toggle Component ─────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <div
            onClick={() => onChange(!checked)}
            style={{
                width: "40px", height: "22px", borderRadius: "11px", cursor: "pointer",
                backgroundColor: checked ? "var(--primary)" : "#cbd5e1",
                position: "relative", transition: "background 0.2s", flexShrink: 0,
            }}
        >
            <div style={{
                position: "absolute", top: "3px",
                left: checked ? "20px" : "3px",
                width: "16px", height: "16px",
                borderRadius: "50%", backgroundColor: "white",
                transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.25)"
            }} />
        </div>
    );
}

// ─── Collapsible Section Component ────────────────────────────────────────────

function CollapsibleSection({ title, defaultOpen = false, children }: { title: string, defaultOpen?: boolean, children: React.ReactNode }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="card">
            <h3 
                onClick={() => setOpen(!open)}
                style={{ fontSize: "14px", fontWeight: 700, marginBottom: open ? "12px" : "0", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none", color: "var(--text-color)" }}
            >
                {title}
                {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </h3>
            {open && <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>{children}</div>}
        </div>
    );
}

function ControlRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: "13px", color: "var(--text-color)" }}>{label}</span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>{children}</div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function QuotationTemplatePage() {
    const [activeTab, setActiveTab] = useState("Default");
    const [inventoryTypes, setInventoryTypes] = useState<string[]>([]);
    const [templates, setTemplates] = useState<Record<string, QuotationTemplate>>({});
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [companyInfo, setCompanyInfo] = useState<any>({});

    // allTabs = Default + unique inventory tags (sorted) + Special Docs
    const allTabs = ["Default", "Project Scope", "Discount Statement", ...inventoryTypes];

    // Current template being edited
    const currentKey = tabKey(activeTab);
    const current: QuotationTemplate = { ...DEFAULT_TEMPLATE, ...(templates[currentKey] || {}) };

    const setField = useCallback(<K extends keyof QuotationTemplate>(key: K, value: QuotationTemplate[K]) => {
        setTemplates(prev => ({
            ...prev,
            [currentKey]: { ...(prev[currentKey] || DEFAULT_TEMPLATE), [key]: value },
        }));
    }, [currentKey]);

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 1024 * 1024) {
            alert("File too large. Please upload an image smaller than 1MB.");
            return;
        }

        const reader = new FileReader();
        reader.onload = (upload) => {
            setField("logo", upload.target?.result as string);
        };
        reader.readAsDataURL(file);
    };

    const resetCurrent = () => {
        setTemplates(prev => ({ ...prev, [currentKey]: { ...DEFAULT_TEMPLATE } }));
    };

    useEffect(() => {
        Promise.all([
            fetch("/api/inventory").then(async r => {
                if (!r.ok) throw new Error(`Inventory fetch failed: ${r.status}`);
                return r.json();
            }),
            fetch("/api/settings").then(async r => {
                if (!r.ok) throw new Error(`Settings fetch failed: ${r.status}`);
                return r.json();
            }),
        ]).then(([invData, settingsData]) => {
            // Derive unique project types from inventory tags
            const types = Array.from(
                new Set<string>((invData as any[]).map((i: any) => i.tags).filter(Boolean))
            ).sort();
            setInventoryTypes(types);

            setCompanyInfo(settingsData);
            if (settingsData.quotationTemplates) {
                try {
                    const parsed = JSON.parse(settingsData.quotationTemplates);
                    setTemplates(parsed.configs || {});
                } catch { }
            }
            setLoading(false);
        }).catch(error => {
            console.error("Failed to fetch template settings data:", error);
            setLoading(false); // Still stop loading so the UI can render
        });
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                quotationTemplates: JSON.stringify({ configs: templates }),
            };
            const res = await fetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (res.ok) alert("Template settings saved!");
            else alert("Failed to save.");
        } catch {
            alert("Error saving settings.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div>Loading template settings...</div>;

    return (
        <div>
            <div className="page-header">
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <Link href="/settings" className="btn btn-outline" style={{ padding: "8px" }}>
                        <ArrowLeft size={16} />
                    </Link>
                    <div>
                        <h1 className="page-title">Quotation Template Builder</h1>
                        <p className="page-description">Customise how exported and printed quotations look — per project type</p>
                    </div>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                    <button className="btn btn-outline" onClick={resetCurrent} title="Reset this template to defaults">
                        <RotateCcw size={15} /> Reset to Default
                    </button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        <Save size={15} /> {saving ? "Saving..." : "Save Templates"}
                    </button>
                </div>
            </div>

            {/* Tabs - auto-derived from inventory project types */}
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "24px", alignItems: "center" }}>
                {allTabs.map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: "6px 18px",
                            borderRadius: "20px",
                            borderWidth: "1.5px",
                            borderStyle: "solid",
                            borderColor: activeTab === tab ? "var(--primary)" : "var(--border)",
                            backgroundColor: activeTab === tab ? "var(--primary)" : "transparent",
                            color: activeTab === tab ? "white" : "var(--text-color)",
                            fontWeight: 600,
                            fontSize: "13px",
                            cursor: "pointer",
                            transition: "all 0.15s",
                        }}
                    >
                        {tab}
                        {templates[tabKey(tab)] && (
                            <span style={{ marginLeft: "6px", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: activeTab === tab ? "rgba(255,255,255,0.7)" : "var(--primary)", display: "inline-block", verticalAlign: "middle" }} title="Custom settings saved" />
                        )}
                    </button>
                ))}
                <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "4px" }}>
                    Tabs reflect your inventory project types
                </span>
            </div>

            {/* Info banner for non-default tabs */}
            {activeTab !== "Default" && !templates[currentKey] && (
                <div style={{ marginBottom: "16px", padding: "10px 16px", backgroundColor: "rgba(var(--primary-rgb, 26,41,128),0.06)", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "13px", color: "var(--text-muted)" }}>
                    ℹ️ No custom template saved for <strong>{activeTab}</strong> yet — showing the <strong>Default</strong> template values as a starting point. Any changes you save here will only apply to <strong>{activeTab}</strong> quotations.
                </div>
            )}

            {/* Two-column layout */}
            <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "24px", alignItems: "start" }}>

                {/* ── Controls ── */}
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* Colors */}
                    <CollapsibleSection title="🎨 Colors & Labels" defaultOpen={true}>
                        <ControlRow label="Primary Color (table, text)">
                            <input type="color" value={current.primaryColor} onChange={e => setField("primaryColor", e.target.value)} style={{ width: "40px", height: "28px", border: "none", cursor: "pointer", borderRadius: "4px" }} />
                            <input type="text" value={current.primaryColor} onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setField("primaryColor", e.target.value); }} className="form-control" style={{ width: "90px", padding: "4px 8px", fontSize: "12px", fontFamily: "monospace" }} />
                        </ControlRow>
                        <ControlRow label="Accent Color (totals, stripe)">
                            <input type="color" value={current.accentColor} onChange={e => setField("accentColor", e.target.value)} style={{ width: "40px", height: "28px", border: "none", cursor: "pointer", borderRadius: "4px" }} />
                            <input type="text" value={current.accentColor} onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setField("accentColor", e.target.value); }} className="form-control" style={{ width: "90px", padding: "4px 8px", fontSize: "12px", fontFamily: "monospace" }} />
                        </ControlRow>
                        <ControlRow label="Secondary Color (badge, accents)">
                            <input type="color" value={current.badgeColor} onChange={e => setField("badgeColor", e.target.value)} style={{ width: "40px", height: "28px", border: "none", cursor: "pointer", borderRadius: "4px" }} />
                            <input type="text" value={current.badgeColor} onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setField("badgeColor", e.target.value); }} className="form-control" style={{ width: "90px", padding: "4px 8px", fontSize: "12px", fontFamily: "monospace" }} />
                        </ControlRow>
                        <ControlRow label="Header Left Area Color">
                            <input type="color" value={current.headerLeftColor || current.badgeColor} onChange={e => setField("headerLeftColor", e.target.value)} style={{ width: "40px", height: "28px", border: "none", cursor: "pointer", borderRadius: "4px" }} />
                            <input type="text" value={current.headerLeftColor || current.badgeColor} onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setField("headerLeftColor", e.target.value); }} className="form-control" style={{ width: "90px", padding: "4px 8px", fontSize: "12px", fontFamily: "monospace" }} />
                        </ControlRow>
                        <ControlRow label="Header Right Area Color">
                            <input type="color" value={current.headerRightColor || current.primaryColor} onChange={e => setField("headerRightColor", e.target.value)} style={{ width: "40px", height: "28px", border: "none", cursor: "pointer", borderRadius: "4px" }} />
                            <input type="text" value={current.headerRightColor || current.primaryColor} onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setField("headerRightColor", e.target.value); }} className="form-control" style={{ width: "90px", padding: "4px 8px", fontSize: "12px", fontFamily: "monospace" }} />
                        </ControlRow>
                        <ControlRow label="Header Accent Line Color">
                            <input type="color" value={current.headerAccentLineColor || current.headerLeftColor || current.badgeColor} onChange={e => setField("headerAccentLineColor", e.target.value)} style={{ width: "40px", height: "28px", border: "none", cursor: "pointer", borderRadius: "4px" }} />
                            <input type="text" value={current.headerAccentLineColor || current.headerLeftColor || current.badgeColor} onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setField("headerAccentLineColor", e.target.value); }} className="form-control" style={{ width: "90px", padding: "4px 8px", fontSize: "12px", fontFamily: "monospace" }} />
                        </ControlRow>
                        <ControlRow label="Footer Top Strip Color">
                            <input type="color" value={current.footerTopStripColor || current.badgeColor} onChange={e => setField("footerTopStripColor", e.target.value)} style={{ width: "40px", height: "28px", border: "none", cursor: "pointer", borderRadius: "4px" }} />
                            <input type="text" value={current.footerTopStripColor || current.badgeColor} onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setField("footerTopStripColor", e.target.value); }} className="form-control" style={{ width: "90px", padding: "4px 8px", fontSize: "12px", fontFamily: "monospace" }} />
                        </ControlRow>
                        <ControlRow label="Footer Bottom Strip Color">
                            <input type="color" value={current.footerBottomStripColor || current.primaryColor} onChange={e => setField("footerBottomStripColor", e.target.value)} style={{ width: "40px", height: "28px", border: "none", cursor: "pointer", borderRadius: "4px" }} />
                            <input type="text" value={current.footerBottomStripColor || current.primaryColor} onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setField("footerBottomStripColor", e.target.value); }} className="form-control" style={{ width: "90px", padding: "4px 8px", fontSize: "12px", fontFamily: "monospace" }} />
                        </ControlRow>
                        <ControlRow label='Document Title Color (on blue header)'>
                            <input type="color" value={current.watermarkColor} onChange={e => setField("watermarkColor", e.target.value)} style={{ width: "40px", height: "28px", border: "none", cursor: "pointer", borderRadius: "4px" }} />
                            <input type="text" value={current.watermarkColor} onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setField("watermarkColor", e.target.value); }} className="form-control" style={{ width: "90px", padding: "4px 8px", fontSize: "12px", fontFamily: "monospace" }} />
                        </ControlRow>
                        <div style={{ marginTop: "12px" }}>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Badge Text Override (e.g. "OFFICIAL QUOTE")</div>
                            <input 
                                type="text" 
                                className="form-control" 
                                value={current.badgeTextOverride} 
                                onChange={e => setField("badgeTextOverride", e.target.value)} 
                                placeholder={activeTab}
                                style={{ fontSize: "12px" }} 
                            />
                        </div>
                    </CollapsibleSection>

                    {/* Logo & Header */}
                    <CollapsibleSection title="🖼 Header Layout">
                        <ControlRow label={`Logo Height: ${current.logoHeight}px`}>
                            <input
                                type="range" min={40} max={120} value={current.logoHeight}
                                onChange={e => setField("logoHeight", Number(e.target.value))}
                                style={{ width: "110px" }}
                            />
                        </ControlRow>
                        <div style={{ marginTop: "12px", padding: "12px", border: "1px dashed var(--border)", borderRadius: "8px" }}>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>Company Logo (Max 1MB)</div>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleLogoUpload}
                                style={{ fontSize: "12px" }}
                            />
                            {current.logo && (
                                <button
                                    onClick={() => setField("logo", "")}
                                    style={{ marginTop: "8px", fontSize: "11px", color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                                >
                                    Remove Logo
                                </button>
                            )}
                        </div>
                        <ControlRow label="Show Company Address"><Toggle checked={current.showAddress} onChange={v => setField("showAddress", v)} /></ControlRow>
                        <ControlRow label="Show Phone"><Toggle checked={current.showPhone} onChange={v => setField("showPhone", v)} /></ControlRow>
                        <ControlRow label="Show Email"><Toggle checked={current.showEmail} onChange={v => setField("showEmail", v)} /></ControlRow>
                        <ControlRow label="Show Website"><Toggle checked={current.showWebsite} onChange={v => setField("showWebsite", v)} /></ControlRow>
                        <div style={{ marginTop: "12px" }}>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Header Note (printed below logo)</div>
                            <textarea
                                className="form-control"
                                rows={2}
                                value={current.headerNote}
                                onChange={e => setField("headerNote", e.target.value)}
                                placeholder="Optional note shown under the company info…"
                                style={{ fontSize: "12px", resize: "vertical" }}
                            />
                        </div>
                        <ControlRow label={`Note Font Size: ${current.headerNoteFontSize}px`}>
                            <input
                                type="range" min={8} max={80} value={current.headerNoteFontSize || 12}
                                onChange={e => setField("headerNoteFontSize", Number(e.target.value))}
                                style={{ width: "110px" }}
                            />
                        </ControlRow>
                    </CollapsibleSection>

                    {/* Table */}
                    {/* Table */}
                    <CollapsibleSection title="📋 Table & Borders">
                        <ControlRow label="Shaded Header Background"><Toggle checked={current.headerShaded} onChange={v => setField("headerShaded", v)} /></ControlRow>
                        <ControlRow label="Alternating Row Shading"><Toggle checked={current.altRows} onChange={v => setField("altRows", v)} /></ControlRow>
                        {current.altRows && (
                            <ControlRow label="Row Shading Color">
                                <input type="color" value={current.altRowColor || "#f1f5f9"} onChange={e => setField("altRowColor", e.target.value)} style={{ width: "40px", height: "28px", border: "none", cursor: "pointer", borderRadius: "4px" }} />
                                <input type="text" value={current.altRowColor || "#f1f5f9"} onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setField("altRowColor", e.target.value); }} className="form-control" style={{ width: "90px", padding: "4px 8px", fontSize: "12px", fontFamily: "monospace" }} />
                            </ControlRow>
                        )}
                        <ControlRow label={`Border Width: ${current.tableBorderWidth}px`}>
                            <input type="range" min={0} max={5} value={current.tableBorderWidth} onChange={e => setField("tableBorderWidth", Number(e.target.value))} style={{ width: "110px" }} />
                        </ControlRow>
                        <ControlRow label="Table Border Color">
                            <input type="color" value={current.tableBorderColor} onChange={e => setField("tableBorderColor", e.target.value)} style={{ width: "40px", height: "28px", border: "none", cursor: "pointer", borderRadius: "4px" }} />
                        </ControlRow>
                        <ControlRow label={`Base Font Size: ${current.fontSize}px`}>
                            <input
                                type="range" min={11} max={16} value={current.fontSize}
                                onChange={e => setField("fontSize", Number(e.target.value))}
                                style={{ width: "110px" }}
                            />
                        </ControlRow>

                        <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
                            <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "8px", color: "var(--text-color)" }}>Column Management</div>
                            {current.columns.map((col, idx) => (
                                <div key={col.id} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                                    <input 
                                        type="checkbox" 
                                        checked={col.visible} 
                                        onChange={e => {
                                            const newCols = current.columns.map((c, i) => i === idx ? { ...c, visible: e.target.checked } : c);
                                            setField("columns", newCols);
                                        }}
                                    />
                                    <input 
                                        type="text" 
                                        className="form-control" 
                                        value={col.label} 
                                        onChange={e => {
                                            const newCols = current.columns.map((c, i) => i === idx ? { ...c, label: e.target.value } : c);
                                            setField("columns", newCols);
                                        }}
                                        style={{ flex: 1, padding: "4px 8px", fontSize: "12px" }}
                                    />
                                </div>
                            ))}
                        </div>
                    </CollapsibleSection>

                    {/* Footer */}
                    <CollapsibleSection title="📄 Footer Sections">
                        <ControlRow label="Show Amount in Words"><Toggle checked={current.showAmountWords} onChange={v => setField("showAmountWords", v)} /></ControlRow>
                        <ControlRow label="Show Bank Details"><Toggle checked={current.showBankDetails} onChange={v => setField("showBankDetails", v)} /></ControlRow>
                        <ControlRow label="Show Signature Lines"><Toggle checked={current.showSignature} onChange={v => setField("showSignature", v)} /></ControlRow>
                        <ControlRow label="Page Padding">
                            <select
                                value={current.padding}
                                onChange={e => setField("padding", e.target.value as any)}
                                className="form-control"
                                style={{ width: "110px", fontSize: "12px", padding: "4px 8px" }}
                            >
                                <option value="compact">Compact</option>
                                <option value="normal">Normal</option>
                                <option value="spacious">Spacious</option>
                            </select>
                        </ControlRow>
                        <div style={{ marginTop: "12px" }}>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Footer Note (printed at the very bottom)</div>
                            <textarea
                                className="form-control"
                                rows={2}
                                value={current.footerNote}
                                onChange={e => setField("footerNote", e.target.value)}
                                placeholder="e.g. Thank you for your business!"
                                style={{ fontSize: "12px", resize: "vertical" }}
                            />
                        </div>
                    </CollapsibleSection>

                    {/* Document Content */}
                    <CollapsibleSection title="📝 Document Content">
                        <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>Pre-fill reusable text blocks that appear on every quotation of this type.</p>
                        <div style={{ marginBottom: "16px" }}>
                            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-color)", marginBottom: "2px" }}>Project Scope Template</div>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>Printed as a "Scope of Work" section above the items table. Leave blank to hide.</div>
                            <textarea
                                className="form-control"
                                rows={5}
                                value={current.projectScope}
                                onChange={e => setField("projectScope", e.target.value)}
                                placeholder={`e.g. Supply and installation of stone coated roofing tiles including:\n• Removal of existing roofing\n• Supply of all materials\n• Installation by certified technicians\n• 2-year workmanship warranty`}
                                style={{ fontSize: "12px", resize: "vertical", lineHeight: 1.6 }}
                            />
                        </div>
                        <div>
                            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-color)", marginBottom: "2px" }}>Roof Estimator Name</div>
                            <input
                                type="text"
                                className="form-control"
                                value={current.roofEstimatorName || ""}
                                onChange={e => setField("roofEstimatorName", e.target.value)}
                                placeholder="Name of the person who prepared this quote"
                                style={{ fontSize: "12px" }}
                            />
                        </div>
                        <div>
                            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-color)", marginBottom: "2px" }}>Discount Statement</div>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>Printed near the discount line in the totals section. Leave blank to hide.</div>
                            <textarea
                                className="form-control"
                                rows={2}
                                value={current.discountStatement}
                                onChange={e => setField("discountStatement", e.target.value)}
                                placeholder="e.g. A special loyalty discount has been applied to this quotation as agreed."
                                style={{ fontSize: "12px", resize: "vertical" }}
                            />
                        </div>
                    </CollapsibleSection>
                </div>

                {/* ── Live Preview ── */}
                <div style={{ position: "sticky", top: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                        <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-color)" }}>
                            Live Preview — <span style={{ color: "var(--primary)" }}>{activeTab}</span>
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Updates as you change settings</div>
                    </div>
                    <QuotationPreview 
                        tpl={current} 
                        companyInfo={companyInfo} 
                        currentTab={activeTab} 
                    />
                </div>
            </div>
        </div>
    );
}
