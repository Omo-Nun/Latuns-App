"use client";
import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

type ToastItem = {
    id: string;
    message: string;
    type: ToastType;
};

// Event-based trigger for the toast
export const toast = {
    success: (message: string) => {
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type: 'success' } }));
    },
    error: (message: string) => {
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type: 'error' } }));
    },
    info: (message: string) => {
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type: 'info' } }));
    }
};

export default function ToastContainer() {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    useEffect(() => {
        const handleToast = (e: Event) => {
            const customEvent = e as CustomEvent;
            const id = Date.now().toString() + Math.random().toString();
            setToasts(prev => [...prev, { id, ...customEvent.detail }]);

            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, 4000);
        };

        window.addEventListener('show-toast', handleToast);
        return () => window.removeEventListener('show-toast', handleToast);
    }, []);

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
        }}>
            {toasts.map(t => (
                <div key={t.id} style={{
                    backgroundColor: t.type === 'error' ? '#fef2f2' : t.type === 'success' ? '#f0fdf4' : '#eff6ff',
                    border: `1px solid ${t.type === 'error' ? '#fecaca' : t.type === 'success' ? '#bbf7d0' : '#bfdbfe'}`,
                    color: t.type === 'error' ? '#991b1b' : t.type === 'success' ? '#166534' : '#1e40af',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    minWidth: '300px',
                    animation: 'slideIn 0.3s ease-out forwards'
                }}>
                    {t.type === 'error' && <AlertCircle size={20} color="#dc2626" />}
                    {t.type === 'success' && <CheckCircle size={20} color="#16a34a" />}
                    {t.type === 'info' && <Info size={20} color="#2563eb" />}
                    
                    <span style={{ flex: 1, fontSize: '14px', fontWeight: 500 }}>{t.message}</span>
                    
                    <button 
                        onClick={() => removeToast(t.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <X size={16} color={t.type === 'error' ? '#991b1b' : t.type === 'success' ? '#166534' : '#1e40af'} />
                    </button>
                </div>
            ))}
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}} />
        </div>
    );
}
