import React from "react";
import { X, AlertCircle } from "lucide-react";
import { StockRequest } from "../types";

interface ReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: StockRequest | null;
    itemsData: { [key: number]: number };
    setItemsData: (data: { [key: number]: number }) => void;
    onApprove: (e: React.FormEvent) => Promise<void>;
    onReject: () => void;
    onRevertConfirm: () => void;
    onRevertDeny: () => void;
    saving: boolean;
}

export function ReviewModal({ 
    isOpen, onClose, request, itemsData, setItemsData, 
    onApprove, onReject, onRevertConfirm, onRevertDeny, saving 
}: ReviewModalProps) {
    if (!isOpen || !request) return null;

    const isReversal = request.status === 'revert_pending';

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: "700px", width: "95%" }}>
                <div className="modal-header">
                    <h2 className="modal-title">{isReversal ? "Review Reversal Request" : "Review Stock Release"}</h2>
                    <button className="btn-close" onClick={onClose}><X size={20} /></button>
                </div>
                <form onSubmit={onApprove}>
                    <div className="modal-body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
                        <div className="card" style={{ padding: "16px", marginBottom: "20px", backgroundColor: "#f8fafc" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", fontSize: "14px" }}>
                                <div><span style={{ color: "var(--text-muted)" }}>Quotation:</span> <strong style={{ color: "var(--primary)" }}>{request.quote_number}</strong></div>
                                <div><span style={{ color: "var(--text-muted)" }}>Client:</span> <strong>{request.client_name}</strong></div>
                                <div><span style={{ color: "var(--text-muted)" }}>Project:</span> <strong>{request.project_type}</strong></div>
                                <div><span style={{ color: "var(--text-muted)" }}>Requested:</span> <strong>{new Date(request.created_at).toLocaleDateString()}</strong></div>
                            </div>
                        </div>

                        {isReversal && (
                            <div style={{ backgroundColor: "#fef2f2", color: "#dc2626", padding: "12px", borderRadius: "8px", marginBottom: "20px", display: "flex", gap: "12px", alignItems: "center" }}>
                                <AlertCircle size={24} />
                                <div>
                                    <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700 }}>REVERSAL REQUESTED</h4>
                                    <p style={{ margin: 0, fontSize: "13px" }}>The team has requested to return the issued stock below to the warehouse.</p>
                                </div>
                            </div>
                        )}

                        <div className="table-wrapper">
                            <table className="table" style={{ fontSize: "13px" }}>
                                <thead style={{ backgroundColor: "#f1f5f9" }}>
                                    <tr>
                                        <th>Item Name</th>
                                        <th>Current Stock</th>
                                        <th>Requested</th>
                                        <th style={{ width: "120px" }}>{isReversal ? 'Issued Qty' : 'Issue Qty'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {request.items.map((item) => (
                                        <tr key={item.id}>
                                            <td style={{ fontWeight: 600 }}>{item.item_name}</td>
                                            <td>
                                                <span style={{ color: item.current_stock < item.requested_qty ? "#ef4444" : "inherit" }}>
                                                    {item.current_stock} {item.item_unit}
                                                </span>
                                            </td>
                                            <td>{item.requested_qty}</td>
                                            <td>
                                                {isReversal ? (
                                                    <span style={{ fontWeight: 700, color: "var(--primary)" }}>{item.approved_qty}</span>
                                                ) : (
                                                    <input
                                                        type="number"
                                                        className="form-control"
                                                        style={{ padding: "4px 8px", height: "32px" }}
                                                        value={itemsData[item.id] || 0}
                                                        onChange={(e) => setItemsData({ ...itemsData, [item.id]: parseFloat(e.target.value) })}
                                                        min="0"
                                                    />
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                        <div>
                            {!isReversal ? (
                                <button type="button" className="btn btn-danger" onClick={onReject} disabled={saving}>
                                    Reject Request
                                </button>
                            ) : (
                                <button type="button" className="btn btn-outline" onClick={onRevertDeny} disabled={saving}>
                                    Deny Reversal
                                </button>
                            )}
                        </div>
                        <div style={{ display: "flex", gap: "12px" }}>
                            <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
                            {!isReversal ? (
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? "Processing..." : "Approve Stock Release"}
                                </button>
                            ) : (
                                <button type="button" className="btn btn-danger" onClick={onRevertConfirm} disabled={saving}>
                                    {saving ? "Processing..." : "Confirm Return to Stock"}
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
