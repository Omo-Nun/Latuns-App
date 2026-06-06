import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { InventoryItem } from "../types";

interface ItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    editingItem: InventoryItem | null;
}

const UNITS = ["sqm", "m", "pks", "pcs", "lots", "set", "lm", "ctn"];

export function ItemModal({ isOpen, onClose, onSave, editingItem }: ItemModalProps) {
    const [formData, setFormData] = useState({
        name: "",
        unit: "pcs",
        description: "",
        default_price: 0,
        tags: "",
        min_stock: 10,
        low_stock: 20
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (editingItem) {
            setFormData({
                name: editingItem.name,
                unit: editingItem.unit,
                description: editingItem.description || "",
                default_price: editingItem.default_price || 0,
                tags: editingItem.tags || "",
                min_stock: editingItem.min_stock || 10,
                low_stock: editingItem.low_stock || 20
            });
        } else {
            setFormData({ name: "", unit: "pcs", description: "", default_price: 0, tags: "", min_stock: 10, low_stock: 20 });
        }
    }, [editingItem, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await onSave(formData);
        setSaving(false);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: "500px" }}>
                <div className="modal-header">
                    <h2 className="modal-title">{editingItem ? "Edit Item" : "Add New Item"}</h2>
                    <button className="btn-close" onClick={onClose}><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group" style={{ marginBottom: "16px" }}>
                            <label className="form-label">Item Name</label>
                            <input
                                type="text"
                                className="form-control"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                            <div className="form-group">
                                <label className="form-label">Unit</label>
                                <select
                                    className="form-control"
                                    value={formData.unit}
                                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                >
                                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Default Price (₦)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="form-control"
                                    value={formData.default_price}
                                    onChange={(e) => setFormData({ ...formData, default_price: parseFloat(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: "16px" }}>
                            <label className="form-label">Category / Tags</label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="e.g. Roofing, Tools, Sundries"
                                value={formData.tags}
                                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                            />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                            <div className="form-group">
                                <label className="form-label">Low Stock Alert Level</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    value={formData.low_stock}
                                    onChange={(e) => setFormData({ ...formData, low_stock: parseFloat(e.target.value) })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Critical Stock Level</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    value={formData.min_stock}
                                    onChange={(e) => setFormData({ ...formData, min_stock: parseFloat(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <textarea
                                className="form-control"
                                rows={3}
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? "Saving..." : editingItem ? "Update Item" : "Create Item"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
