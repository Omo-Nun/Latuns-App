import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { InventoryItem } from "../types";

interface StockModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    item: InventoryItem | null;
}

export function StockModal({ isOpen, onClose, onSave, item }: StockModalProps) {
    const [stockType, setStockType] = useState<'in' | 'out'>('in');
    const [stockQty, setStockQty] = useState("");
    const [stockNote, setStockNote] = useState("");
    const [stockReference, setStockReference] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setStockType('in');
            setStockQty("");
            setStockNote("");
            setStockReference("");
        }
    }, [isOpen]);

    if (!isOpen || !item) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await onSave({
            type: stockType,
            qty: parseFloat(stockQty),
            note: stockNote,
            reference: stockReference
        });
        setSaving(false);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: "450px" }}>
                <div className="modal-header">
                    <h2 className="modal-title">Manage Stock: {item.name}</h2>
                    <button className="btn-close" onClick={onClose}><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div style={{ backgroundColor: "#f8fafc", padding: "12px", borderRadius: "8px", marginBottom: "20px", display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>Current Stock:</span>
                            <span style={{ fontWeight: 700, color: "var(--primary)" }}>{item.stock_qty} {item.unit}</span>
                        </div>

                        <div className="form-group" style={{ marginBottom: "16px" }}>
                            <label className="form-label">Transaction Type</label>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                <button
                                    type="button"
                                    className={`btn ${stockType === 'in' ? 'btn-primary' : 'btn-outline'}`}
                                    onClick={() => setStockType('in')}
                                >
                                    Stock In (Add)
                                </button>
                                <button
                                    type="button"
                                    className={`btn ${stockType === 'out' ? 'btn-danger' : 'btn-outline'}`}
                                    onClick={() => setStockType('out')}
                                >
                                    Stock Out (Deduct)
                                </button>
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: "16px" }}>
                            <label className="form-label">Quantity ({item.unit})</label>
                            <input
                                type="number"
                                className="form-control"
                                required
                                value={stockQty}
                                onChange={(e) => setStockQty(e.target.value)}
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: "16px" }}>
                            <label className="form-label">Reference / Note</label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="e.g. Supplier Invoice #123 or Project #45"
                                value={stockNote}
                                onChange={(e) => setStockNote(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? "Processing..." : stockType === 'in' ? "Add Stock" : "Deduct Stock"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
