import React, { useState, useEffect } from "react";
import { X, Image as ImageIcon } from "lucide-react";
import { CompanyAsset } from "../types";
import { toast } from "@/components/Toast";

interface AssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    editingAsset: CompanyAsset | null;
}

export function AssetModal({ isOpen, onClose, onSave, editingAsset }: AssetModalProps) {
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        classification: "",
        image_url: "",
        purchase_date: "",
        purchase_cost: "",
        current_value: "",
        status: "Active"
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (editingAsset) {
            setFormData({
                name: editingAsset.name,
                description: editingAsset.description || "",
                classification: editingAsset.classification || "",
                image_url: editingAsset.image_url || "",
                purchase_date: editingAsset.purchase_date ? editingAsset.purchase_date.split('T')[0] : "",
                purchase_cost: editingAsset.purchase_cost?.toString() || "",
                current_value: editingAsset.current_value?.toString() || "",
                status: editingAsset.status || "Active"
            });
        } else {
            setFormData({ name: "", description: "", classification: "", image_url: "", purchase_date: "", purchase_cost: "", current_value: "", status: "Active" });
        }
    }, [editingAsset, isOpen]);

    if (!isOpen) return null;

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 1048576) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1200;
                    const scale = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scale;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        setFormData(prev => ({ ...prev, image_url: canvas.toDataURL('image/jpeg', 0.7) }));
                    }
                };
            };
        } else {
            const reader = new FileReader();
            reader.onload = (event) => setFormData(prev => ({ ...prev, image_url: event.target?.result as string }));
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await onSave(formData);
        setSaving(false);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: "550px" }}>
                <div className="modal-header">
                    <h2 className="modal-title">{editingAsset ? "Edit Asset" : "Add New Asset"}</h2>
                    <button className="btn-close" onClick={onClose}><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "20px", marginBottom: "20px" }}>
                            <div className="image-upload" style={{ textAlign: "center" }}>
                                <div style={{ width: "100%", aspectRatio: "1/1", border: "2px dashed var(--border)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: "8px", position: "relative" }}>
                                    {formData.image_url ? (
                                        <img src={formData.image_url} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    ) : (
                                        <ImageIcon size={40} style={{ color: "var(--text-muted)" }} />
                                    )}
                                </div>
                                <label className="btn btn-outline" style={{ display: "block", fontSize: "12px", padding: "4px 8px" }}>
                                    Upload
                                    <input type="file" accept="image/*" onChange={handleImageUpload} hidden />
                                </label>
                            </div>
                            <div>
                                <div className="form-group" style={{ marginBottom: "12px" }}>
                                    <label className="form-label">Asset Name</label>
                                    <input type="text" className="form-control" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Classification</label>
                                    <input type="text" className="form-control" placeholder="e.g. Tools, Vehicles, Office" value={formData.classification} onChange={(e) => setFormData({ ...formData, classification: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                            <div className="form-group">
                                <label className="form-label">Purchase Date</label>
                                <input type="date" className="form-control" value={formData.purchase_date} onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Current Status</label>
                                <select className="form-control" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}>
                                    <option value="Active">Active</option>
                                    <option value="Under Repair">Under Repair</option>
                                    <option value="Disposed">Disposed</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                            <div className="form-group">
                                <label className="form-label">Purchase Cost (₦)</label>
                                <input type="number" className="form-control" value={formData.purchase_cost} onChange={(e) => setFormData({ ...formData, purchase_cost: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Current Value (₦)</label>
                                <input type="number" className="form-control" value={formData.current_value} onChange={(e) => setFormData({ ...formData, current_value: e.target.value })} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Description / Remarks</label>
                            <textarea className="form-control" rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                        </div>
                    </div>
                    <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? "Saving..." : editingAsset ? "Update Asset" : "Create Asset"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
