import React from "react";
import { X, AlertCircle } from "lucide-react";

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText: string;
    isDestructive?: boolean;
    loading?: boolean;
}

export function ConfirmationModal({ 
    isOpen, onClose, onConfirm, title, message, confirmText, isDestructive, loading 
}: ConfirmationModalProps) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
            <div className="modal-content" style={{ maxWidth: "400px" }}>
                <div className="modal-header">
                    <h2 className="modal-title">{title}</h2>
                    <button className="btn-close" onClick={onClose}><X size={20} /></button>
                </div>
                <div className="modal-body">
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                        <AlertCircle size={24} style={{ color: isDestructive ? '#dc2626' : '#2563eb', flexShrink: 0 }} />
                        <p style={{ margin: 0, fontSize: '15px' }}>{message}</p>
                    </div>
                </div>
                <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                    <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
                    <button 
                        type="button" 
                        className={`btn ${isDestructive ? 'btn-danger' : 'btn-primary'}`} 
                        onClick={onConfirm}
                        disabled={loading}
                    >
                        {loading ? 'Processing...' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
