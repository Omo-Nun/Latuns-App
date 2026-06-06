import React, { useState } from "react";
import { format } from "date-fns";
import { Plus, Edit2, Trash2, ArrowUpDown, Image as ImageIcon } from "lucide-react";
import { CompanyAsset } from "../types";

interface InventoryAssetsProps {
    assets: CompanyAsset[];
    loading: boolean;
    onAdd: () => void;
    onEdit: (asset: CompanyAsset) => void;
    onDelete: (id: number) => void;
}

export function InventoryAssets({ assets, loading, onAdd, onEdit, onDelete }: InventoryAssetsProps) {
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    let sortedAssets = [...assets];
    if (sortConfig) {
        sortedAssets.sort((a, b) => {
            const aVal = (a as any)[sortConfig.key];
            const bVal = (b as any)[sortConfig.key];
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    return (
        <div className="inventory-assets">
            <div className="table-wrapper card">
                <table className="table">
                    <thead>
                        <tr>
                            <th style={{ width: '80px' }}>Image</th>
                            <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', whiteSpace: 'nowrap', minWidth: '160px' }}>Asset Name <ArrowUpDown size={14} style={{ display: 'inline', marginLeft: '4px', verticalAlign: 'middle' }} /></th>
                            <th onClick={() => handleSort('classification')} style={{ cursor: 'pointer', whiteSpace: 'nowrap', minWidth: '140px' }}>Classification <ArrowUpDown size={14} style={{ display: 'inline', marginLeft: '4px', verticalAlign: 'middle' }} /></th>
                            <th onClick={() => handleSort('purchase_date')} style={{ cursor: 'pointer', whiteSpace: 'nowrap', minWidth: '140px' }}>Purchase Date <ArrowUpDown size={14} style={{ display: 'inline', marginLeft: '4px', verticalAlign: 'middle' }} /></th>
                            <th onClick={() => handleSort('purchase_cost')} style={{ cursor: 'pointer', whiteSpace: 'nowrap', minWidth: '100px' }}>Cost <ArrowUpDown size={14} style={{ display: 'inline', marginLeft: '4px', verticalAlign: 'middle' }} /></th>
                            <th onClick={() => handleSort('status')} style={{ cursor: 'pointer', whiteSpace: 'nowrap', minWidth: '110px' }}>Status <ArrowUpDown size={14} style={{ display: 'inline', marginLeft: '4px', verticalAlign: 'middle' }} /></th>
                            <th style={{ textAlign: "right" }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={7} style={{ textAlign: "center", padding: "32px" }}>Loading assets...</td>
                            </tr>
                        ) : sortedAssets.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>
                                    No company assets found.
                                </td>
                            </tr>
                        ) : sortedAssets.map((asset) => (
                            <tr key={asset.id}>
                                <td>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '4px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                        {asset.image_url ? (
                                            <img src={asset.image_url} alt={asset.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <ImageIcon size={24} style={{ color: '#cbd5e1' }} />
                                        )}
                                    </div>
                                </td>
                                <td>
                                    <div style={{ fontWeight: 600 }}>{asset.name}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{asset.description || 'No description'}</div>
                                </td>
                                <td><span className="badge badge-primary">{asset.classification || 'General'}</span></td>
                                <td>{asset.purchase_date ? format(new Date(asset.purchase_date), 'MMM d, yyyy') : '-'}</td>
                                <td style={{ fontWeight: 500 }}>₦{(asset.purchase_cost || 0).toLocaleString()}</td>
                                <td>
                                    <span className={`badge ${
                                        asset.status === 'Active' ? 'badge-accepted' : 
                                        asset.status === 'Under Repair' ? 'badge-pending' : 'badge-rejected'
                                    }`}>
                                        {asset.status}
                                    </span>
                                </td>
                                <td style={{ textAlign: "right" }}>
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                        <button className="btn btn-outline" style={{ padding: "6px" }} onClick={() => onEdit(asset)}>
                                            <Edit2 size={16} />
                                        </button>
                                        <button className="btn btn-danger" style={{ padding: "6px" }} onClick={() => onDelete(asset.id)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
