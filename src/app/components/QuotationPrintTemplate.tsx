import React, { memo } from 'react';
import { format } from 'date-fns';
import { Mail, MapPin, Phone, Globe } from "lucide-react";
import { numberToWords } from '@/lib/numberToWords';
import { DEFAULT_TEMPLATE } from '@/app/settings/quotation-template/page';
import { calcSundries, calcGrandTotal, calcNetTotal, isCompositeDoc as checkIsComposite } from '@/lib/financeUtils';

export const QuotationPrintTemplate = memo(({ data, settings }: { data: any, settings: any }) => {
    if (!data) return null;

    let tpl = { ...DEFAULT_TEMPLATE };
    if (settings?.quotationTemplates) {
        try {
            const allTpl = JSON.parse(settings.quotationTemplates);
            const docTypeKey = data.doc_type ? data.doc_type.toLowerCase().replace(/\s+/g, '_') : '';
            const typeKey = data.project_type ? data.project_type.toLowerCase().replace(/\s+/g, '_') : 'default';
            
            // Priority: Specific Doc Type (Scope/Discount) > Project Type Template > Default
            tpl = { 
                ...tpl, 
                ...(
                    allTpl.configs?.[docTypeKey] || 
                    allTpl.configs?.[typeKey] || 
                    allTpl.configs?.['default'] || 
                    {}
                ) 
            };
        } catch (e) {
            // fallback to default
        }
    }
    const fs = tpl.fontSize;
    const pc = tpl.primaryColor;
    const ac = tpl.accentColor;

    const sundriesVal = calcSundries(data);
    const grandTotal = calcGrandTotal(data);
    const discountVal = data.discount_value || 0;
    const netTotal = calcNetTotal(data);
    const isCompositeDoc = checkIsComposite(data.doc_type);

    const visibleColumns = (tpl.columns || DEFAULT_TEMPLATE.columns).filter((c: any) => c.visible);

    return (
        <div style={{ width: "800px", maxWidth: "100%", padding: "24px 40px", backgroundColor: "#ffffff", color: "black", fontFamily: "'Inter', sans-serif" }}>

            {/* Re-implemented Modern Slanted Header (SVG for perfect export) */}
            <div style={{ position: "relative", width: "100%", height: "100px", marginBottom: "4px" }}>
                {/* Background Shapes */}
                <svg width="100%" height="85px" preserveAspectRatio="none" viewBox="0 0 100 100" style={{ position: "absolute", top: 0, left: 0, zIndex: 1, shapeRendering: "crispEdges" }}>
                    {/* Blue/Right shape (goes underneath) */}
                    <polygon points="40,0 100,0 100,100 30,100" fill={tpl.headerRightColor || pc} />
                    {/* Red/Left shape (goes on top) */}
                    <polygon points="0,0 60,0 51,100 0,100" fill={tpl.headerLeftColor || tpl.badgeColor} />
                </svg>
                
                {/* Thin Accent Line below the header */}
                <div style={{ position: "absolute", bottom: "11px", right: 0, width: "40%", height: "4px", backgroundColor: tpl.headerAccentLineColor || tpl.headerLeftColor || tpl.badgeColor, zIndex: 2 }} />

                {/* Content Overlay */}
                <div style={{ position: "relative", zIndex: 3, display: "flex", height: "85px", width: "100%" }}>
                    {/* Logo & Tagline Section */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: "20px" }}>
                        {tpl.logo ? (
                            <img src={tpl.logo} alt="Company Logo" style={{ height: `${tpl.logoHeight}px`, objectFit: "contain", alignSelf: "flex-start" }} />
                        ) : (
                            <img src="/logo.png" alt="Company Logo" style={{ height: `${tpl.logoHeight}px`, objectFit: "contain", alignSelf: "flex-start" }} />
                        )}
                        <div style={{ fontSize: "12px", color: "white", fontWeight: 700, marginTop: "4px", letterSpacing: "1px" }}>
                            {settings.companyTagline || "Your Tagline Space"}
                        </div>
                    </div>

                    {/* Title Section */}
                    <div style={{ width: "320px", display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center", paddingRight: "5px" }}>
                        <h2 style={{ fontSize: "32px", margin: 0, fontWeight: 950, color: tpl.watermarkColor || tpl.badgeColor, textTransform: "uppercase", letterSpacing: "2px", lineHeight: 1.1, textAlign: "right" }}>
                            {tpl.badgeTextOverride || data.project_type || 'General Project'}
                        </h2>
                        <div style={{ fontSize: "14px", color: "white", marginTop: "8px", fontWeight: 800, letterSpacing: "1px", display: "flex", gap: "8px", alignItems: "center" }}>
                            <span>{data.doc_type === 'invoice' ? 'INVOICE' : data.doc_type === 'project_scope' ? 'SCOPE' : data.doc_type === 'discount_statement' ? 'STATEMENT' : 'QUOTATION'}</span>
                            <span style={{ opacity: 0.5 }}>|</span>
                            <span>{data.quote_number || `QC-${String(data.id).padStart(4, '0')}`}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Document Metadata (Below Header) */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "25px", alignItems: "flex-start", padding: "0 10px" }}>
                <div style={{ fontSize: "10px", color: "#475569", lineHeight: 1.6 }}>
                    {tpl.showAddress && settings.companyAddress && <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}><MapPin size={11} style={{ marginTop: "2px", color: tpl.primaryColor }} /> <span>{settings.companyAddress}</span></div>}
                    {tpl.showPhone && settings.companyPhone && <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><Phone size={11} style={{ color: tpl.primaryColor }} /> <span>{settings.companyPhone}</span></div>}
                    <div style={{ display: "flex", gap: "15px" }}>
                        {tpl.showEmail && settings.companyEmail && <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><Mail size={11} style={{ color: tpl.primaryColor }} /> <span>{settings.companyEmail}</span></div>}
                        {tpl.showWebsite && settings.companyWebsite && <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><Globe size={11} style={{ color: tpl.primaryColor }} /> <span>{settings.companyWebsite}</span></div>}
                    </div>
                </div>
                <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                    <div style={{ fontSize: "16px", color: "#1e293b", fontWeight: 800, marginTop: "6px" }}>Date: {format(new Date(data.created_at || new Date()), 'MMM d, yyyy')}</div>
                </div>
            </div>

            {/* Metadata Section: Client (Left) and Notes/Estimator (Right) */}
            <div style={{ display: "flex", gap: "30px", marginBottom: "20px", alignItems: "flex-start" }}>
                {/* Client Details (Left) */}
                <div style={{ flex: 1, padding: "12px 16px", backgroundColor: "#f8fafc", borderRadius: "8px", borderLeft: `8px solid ${pc}` }}>
                    <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748b", fontWeight: 700, letterSpacing: "1px", marginBottom: "4px" }}>
                        {data.doc_type === 'invoice' ? 'Bill To' : 'Quotation For'}
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: pc, marginBottom: "2px" }}>{data.client_name}</div>
                    <div style={{ color: "#475569", fontSize: "13px" }}>{data.client_address}</div>
                </div>

                {/* Header Note & Roof Estimator (Right) */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
                    {(data.header_note || tpl.headerNote) && (
                        <div style={{ padding: "12px 16px", backgroundColor: "#fafafa", borderRadius: "8px", border: "2px dashed #cbd5e1" }}>
                            <div style={{ fontSize: `${tpl.headerNoteFontSize || 12}px`, color: "#1e293b", fontWeight: 800, lineHeight: 1.5 }}>
                                {data.header_note || tpl.headerNote}
                            </div>
                        </div>
                    )}
                    {(data.roof_estimator_name || tpl.roofEstimatorName) && (
                        <div style={{ paddingLeft: "16px", borderLeft: "6px solid #cbd5e1" }}>
                            <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748b", fontWeight: 700, letterSpacing: "1px" }}>Roof Estimator</div>
                            <div style={{ fontSize: "14px", fontWeight: 800, color: "#1e293b" }}>{data.roof_estimator_name || tpl.roofEstimatorName}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Project Scope */}
            {(data.project_scope || tpl.projectScope) && (
                <div style={{ marginBottom: "16px", padding: "16px 24px", backgroundColor: "#f0f9ff", borderRadius: "8px", borderLeft: `6px solid ${pc}` }}>
                    <div style={{ fontSize: "12px", textTransform: "uppercase", color: "#64748b", fontWeight: 700, letterSpacing: "1px", marginBottom: "8px" }}>Scope of Work</div>
                    <div style={{ fontSize: `${fs}px`, color: "#1e293b", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{data.project_scope || tpl.projectScope}</div>
                </div>
            )}

            {/* Main Table */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px", border: `${tpl.tableBorderWidth}px solid ${tpl.tableBorderColor}`, tableLayout: "fixed" }}>
                <thead>
                    <tr>
                        {visibleColumns.map((col: any) => (
                            <th key={col.id} style={{ 
                                backgroundColor: tpl.headerShaded ? pc : 'transparent', 
                                color: tpl.headerShaded ? "white" : pc, 
                                padding: "12px", 
                                textAlign: col.align as any, 
                                fontSize: `${fs}px`, 
                                textTransform: "uppercase",
                                border: `${tpl.tableBorderWidth}px solid ${tpl.tableBorderColor}`,
                                width: col.width
                            }}>
                                {col.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.items?.map((item: any, i: number) => (
                        <tr key={item.id} style={{ backgroundColor: tpl.altRows && i % 2 === 1 ? (tpl.altRowColor || (pc + '08')) : "#ffffff" }}>
                            {visibleColumns.map((col: any) => (
                                <td key={col.id} style={{ 
                                    padding: "8px 12px", 
                                    fontSize: `${fs}px`, 
                                    fontWeight: col.id === 'description' ? 600 : 400, 
                                    color: col.id === 'description' ? pc : "#475569",
                                    textAlign: col.align as any,
                                    border: `${tpl.tableBorderWidth}px solid ${tpl.tableBorderColor}`,
                                    wordWrap: "break-word"
                                }}>
                                    {col.id === 'description' ? item.description :
                                     col.id === 'qty' ? item.qty :
                                     col.id === 'unit' ? item.unit :
                                     col.id === 'unit_cost' ? item.unit_cost?.toLocaleString(undefined, { minimumFractionDigits: 2 }) :
                                     col.id === 'total' ? item.total?.toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Totals Section */}
            {(() => {
                return (
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
                        <div style={{ width: "380px", fontSize: `${fs}px`, border: `2px solid ${tpl.tableBorderColor || '#e2e8f0'}`, borderRadius: "6px", overflow: "hidden" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 16px", borderBottom: `1px solid ${tpl.tableBorderColor || '#e2e8f0'}` }}>
                                <span style={{ color: "#64748b", fontWeight: 600 }}>Total</span>
                                <span style={{ fontWeight: 700 }}>₦{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            {!isCompositeDoc && (
                                <>
                                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 16px", borderBottom: `1px solid ${tpl.tableBorderColor || '#e2e8f0'}` }}>
                                        <span style={{ color: "#64748b", fontWeight: 600 }}>Sundries/Margin</span>
                                        <span style={{ fontWeight: 700 }}>₦{sundriesVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 16px", borderBottom: `2px solid ${pc}` }}>
                                        <span style={{ color: "#64748b", fontWeight: 600 }}>Transportation</span>
                                        <span style={{ fontWeight: 700 }}>₦{(data.transportation || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </>
                            )}
                            {discountVal > 0 && (
                                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 16px", backgroundColor: "#fff7ed", borderBottom: "2px solid #f59e0b" }}>
                                    <span style={{ color: "#d97706", fontWeight: 700 }}>Discount Applied</span>
                                    <span style={{ fontWeight: 700, color: "#d97706" }}>— ₦{discountVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            )}
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", backgroundColor: "#f8fafc", borderTop: isCompositeDoc ? `2px solid ${pc}` : 'none' }}>
                                <span style={{ color: pc, fontWeight: 800, fontSize: `${fs + 3}px` }}>
                                    {discountVal > 0 ? 'NET TOTAL' : 'GRAND TOTAL'}
                                </span>
                                <span style={{ fontWeight: 800, fontSize: `${fs + 5}px`, color: ac }}>
                                    ₦{netTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Discount statement */}
            {tpl.discountStatement && (
                <div style={{ marginBottom: "16px", padding: "12px 16px", backgroundColor: "#fff7ed", borderRadius: "8px", borderLeft: "5px solid #f59e0b", fontSize: `${fs - 1}px`, color: "#92400e", fontStyle: "italic" }}>
                    {tpl.discountStatement}
                </div>
            )}

            {/* Amount in words & Bank Details */}
            {(tpl.showAmountWords || tpl.showBankDetails) && (
                <div style={{ display: "flex", gap: "24px", marginBottom: "24px" }}>
                    {tpl.showAmountWords && (
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748b", fontWeight: 700, letterSpacing: "1px", marginBottom: "4px" }}>Amount in Words</div>
                            <div style={{ padding: "12px", backgroundColor: "#f1f5f9", borderRadius: "8px", fontStyle: "italic", fontWeight: 600, color: pc, fontSize: `${fs}px`, lineHeight: 1.4 }}>
                                {numberToWords(netTotal)} Naira Only.
                            </div>
                        </div>
                    )}

                    {tpl.showBankDetails && (
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748b", fontWeight: 700, letterSpacing: "1px", marginBottom: "4px" }}>Bank Details</div>
                            <div style={{ padding: "12px", border: "2px dashed #cbd5e1", borderRadius: "8px" }}>
                                <div style={{ display: "flex", marginBottom: "4px" }}>
                                    <span style={{ width: "120px", color: "#64748b", fontSize: "12px", fontWeight: 600 }}>Bank Name:</span>
                                    <span style={{ fontWeight: 700, color: pc }}>{settings.bankName || "N/A"}</span>
                                </div>
                                <div style={{ display: "flex", marginBottom: "4px" }}>
                                    <span style={{ width: "120px", color: "#64748b", fontSize: "12px", fontWeight: 600 }}>Account Name:</span>
                                    <span style={{ fontWeight: 700, color: pc, fontSize: "12px" }}>{settings.accountName || "N/A"}</span>
                                </div>
                                <div style={{ display: "flex" }}>
                                    <span style={{ width: "120px", color: "#64748b", fontSize: "12px", fontWeight: 600 }}>Account No:</span>
                                    <span style={{ fontWeight: 800, color: pc, fontSize: "14px", letterSpacing: "1px" }}>{settings.accountNumber || "N/A"}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Signature */}
            {tpl.showSignature && (
                <div style={{ marginTop: "32px", display: "flex", justifyContent: "space-between" }}>
                    <div style={{ width: "250px", textAlign: "center" }}>
                        <div style={{ borderBottom: `1px solid ${pc}`, height: "40px", marginBottom: "8px" }}></div>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: pc }}>Authorized Signature</div>
                    </div>
                    <div style={{ width: "250px", textAlign: "center" }}>
                        <div style={{ borderBottom: `1px solid ${pc}`, height: "40px", marginBottom: "8px" }}></div>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: pc }}>Client Signature / Stamp</div>
                    </div>
                </div>
            )}

            {/* Footer: Two equal strips separated by white space */}
            <div style={{ marginTop: "50px" }}>
                {/* Top Strip */}
                <div style={{ height: "10px", backgroundColor: tpl.footerTopStripColor || tpl.badgeColor, width: "100%" }} />
                
                {/* White Space Separator */}
                <div style={{ height: "6px", backgroundColor: "#ffffff", width: "100%" }} />
                
                {/* Bottom Strip */}
                <div style={{ height: "10px", backgroundColor: tpl.footerBottomStripColor || pc, width: "100%" }} />
            </div>

            {/* Footer Note (below strips, optional) */}
            {tpl.footerNote && (
                <div style={{ marginTop: "8px", fontSize: "12px", color: "#475569", textAlign: "center", fontStyle: "italic" }}>
                    {tpl.footerNote}
                </div>
            )}

        </div>
    );
});
