import React from "react";
import { X, Download } from "lucide-react";
import { format } from "date-fns";
import { StockLog } from "../types";

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    logs: StockLog[];
    loading: boolean;
    fromDate: string;
    setFromDate: (date: string) => void;
    toDate: string;
    setToDate: (date: string) => void;
    onExport: () => void;
}

export function HistoryModal({ isOpen, onClose, logs, loading, fromDate, setFromDate, toDate, setToDate, onExport }: HistoryModalProps) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: "800px", width: "95%" }}>
                <div className="modal-header">
                    <h2 className="modal-title">Global Store History</h2>
                    <button className="btn-close" onClick={onClose}><X size={20} /></button>
                </div>
                <div className="modal-body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", gap: "16px", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                            <div className="form-group">
                                <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>From</label>
                                <input type="date" className="form-control" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>To</label>
                                <input type="date" className="form-control" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                            </div>
                        </div>
                        <button className="btn btn-outline" onClick={onExport} disabled={logs.length === 0}>
                            <Download size={16} /> Export History
                        </button>
                    </div>

                    <div className="table-wrapper">
                        <table className="table" style={{ fontSize: "13px" }}>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Item</th>
                                    <th>Type</th>
                                    <th>Qty</th>
                                    <th>Unit</th>
                                    <th>Note</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={6} style={{ textAlign: "center", padding: "20px" }}>Loading logs...</td></tr>
                                ) : logs.length === 0 ? (
                                    <tr><td colSpan={6} style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>No history found for these dates.</td></tr>
                                ) : logs.map(log => (
                                    <tr key={log.id}>
                                        <td style={{ whiteSpace: "nowrap" }}>{format(new Date(log.created_at), 'MMM d, HH:mm')}</td>
                                        <td style={{ fontWeight: 600 }}>{(log as any).item_name || 'Item Deleted'}</td>
                                        <td>
                                            <span className={`badge ${log.type === 'in' ? 'badge-accepted' : 'badge-rejected'}`}>
                                                {log.type.toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: 700 }}>{log.qty}</td>
                                        <td>{(log as any).item_unit}</td>
                                        <td style={{ color: "var(--text-muted)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>{log.note}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
