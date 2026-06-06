"use client";

import React, { useState, useEffect } from "react";
import { Server, Activity, Power, RefreshCw, AlertTriangle, Clock } from "lucide-react";
import { toast } from "@/components/Toast";

export default function NodeManagementPanel() {
    const [nodeStatus, setNodeStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const [sessions, setSessions] = useState<any[]>([]);

    const fetchStatus = async () => {
        try {
            const [res, sessionRes] = await Promise.all([
                fetch('/api/cluster/status'),
                fetch('/api/cluster/sessions')
            ]);
            
            if (res.ok) {
                const data = await res.json();
                setNodeStatus(data);
            }
            if (sessionRes.ok) {
                const sessionData = await sessionRes.json();
                if (sessionData.success) {
                    setSessions(sessionData.sessions);
                }
            }
        } catch (error) {
            console.error("Failed to fetch cluster status", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, []);

    const handleTakeOver = async () => {
        if (!confirm("Are you sure you want this node to take over as Primary? This will trigger a safety backup and switch roles.")) return;
        setActionLoading(true);
        try {
            const res = await fetch('/api/cluster/handover', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nodeId: nodeStatus?.nodeName, forceStandby: false })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Role handover completed successfully!");
                fetchStatus();
            } else {
                toast.error(data.error || "Failed to handover role.");
            }
        } catch (err: any) {
            toast.error("Network error during handover.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleOverride = async (forceStandby: boolean) => {
        if (!confirm(`Are you sure you want to FORCE this node to become ${forceStandby ? 'Standby' : 'Primary'}? Use this only to resolve split-brain conflicts.`)) return;
        setActionLoading(true);
        try {
            const res = await fetch('/api/cluster/handover', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nodeId: nodeStatus?.nodeName, forceStandby, redirectUrl: null })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Node successfully forced to ${forceStandby ? 'Standby' : 'Primary'}.`);
                fetchStatus();
            } else {
                toast.error(data.error || "Failed to override role.");
            }
        } catch (err: any) {
            toast.error("Network error during override.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleEndDay = async () => {
        if (!confirm("Initialize Close of Business (COB) trigger? This will lock concurrent writes and encrypt the database locally.")) return;
        setActionLoading(true);
        try {
            const res = await fetch('/api/cluster/backup', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                toast.success("End of Day backup successfully created and encrypted!");
                fetchStatus();
            } else {
                toast.error(data.error || "Failed to execute End of Day backup.");
            }
        } catch (err: any) {
            toast.error("Network error during backup.");
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return <div className="p-4">Loading cluster status...</div>;
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="card">
                <div className="flex justify-between items-center mb-4 pb-3 border-b">
                    <div>
                        <h2 className="text-lg font-bold">Cluster Status</h2>
                        <p className="text-sm text-gray-500">Manage local network nodes and database replication roles.</p>
                    </div>
                    <button 
                        onClick={handleEndDay} 
                        disabled={actionLoading}
                        className="btn btn-primary flex items-center gap-2"
                        style={{ backgroundColor: '#e11d48', borderColor: '#e11d48', color: 'white', padding: '8px 16px', borderRadius: '6px' }}
                    >
                        {actionLoading ? <RefreshCw className="animate-spin" size={16} /> : <Power size={16} />}
                        [End Day] Trigger
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Current Node */}
                    <div style={{
                        padding: '16px',
                        border: `2px solid ${nodeStatus?.nodeRole === 'Primary' ? 'var(--primary)' : '#e2e8f0'}`,
                        borderRadius: '8px',
                        backgroundColor: nodeStatus?.nodeRole === 'Primary' ? 'rgba(37, 99, 235, 0.05)' : '#f8fafc',
                        position: 'relative'
                    }}>
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-semibold flex items-center gap-2 text-gray-900">
                                <Server size={18} className="text-emerald-500" /> 
                                {nodeStatus?.nodeName} (This Node)
                            </h3>
                            <span style={{
                                fontSize: '11px',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                backgroundColor: nodeStatus?.nodeRole === 'Primary' ? 'var(--primary)' : '#64748b',
                                color: 'white',
                                fontWeight: 'bold'
                            }}>
                                {nodeStatus?.nodeRole?.toUpperCase() || 'UNKNOWN'}
                            </span>
                        </div>
                        <div className="text-sm mb-4 text-gray-600 flex flex-col gap-1 mt-3">
                            <p className="flex justify-between border-b pb-1"><span>IP Address:</span> <strong>{nodeStatus?.nodeIp}</strong></p>
                            <p className="flex justify-between border-b pb-1"><span>Last Backup:</span> <strong className="flex items-center gap-1"><Clock size={12}/> {nodeStatus?.lastBackup !== 'Never' ? new Date(nodeStatus?.lastBackup).toLocaleString() : 'Never'}</strong></p>
                        </div>
                        
                        {nodeStatus?.nodeRole !== 'Primary' && (
                            <button 
                                onClick={handleTakeOver}
                                disabled={actionLoading}
                                className="w-full flex items-center justify-center gap-2 text-sm py-2 bg-white hover:bg-gray-50 border border-gray-300 rounded-md transition-colors mb-2"
                            >
                                {actionLoading ? <RefreshCw className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                                [Take Over as Primary]
                            </button>
                        )}
                        {nodeStatus?.nodeRole === 'Primary' && (
                            <div className="text-center p-2 text-sm font-bold flex items-center justify-center gap-2 text-blue-600 bg-blue-50 rounded-md mb-2">
                                <Activity size={16} /> Active Write Node
                            </div>
                        )}
                        <button 
                            onClick={() => handleOverride(nodeStatus?.nodeRole === 'Primary')}
                            disabled={actionLoading}
                            className="w-full flex items-center justify-center gap-2 text-xs py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-md transition-colors"
                        >
                            <AlertTriangle size={12} /> Force {nodeStatus?.nodeRole === 'Primary' ? 'Standby' : 'Primary'} (Override)
                        </button>
                    </div>

                    {/* Peer Node */}
                    <div style={{
                        padding: '16px',
                        border: `2px solid #e2e8f0`,
                        borderRadius: '8px',
                        backgroundColor: '#f8fafc',
                        position: 'relative'
                    }}>
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-semibold flex items-center gap-2 text-gray-900">
                                <Server size={18} className={nodeStatus?.peerStatus && nodeStatus.peerStatus.status === 'online' ? "text-emerald-500" : "text-gray-400"} /> 
                                {nodeStatus?.peerStatus && nodeStatus.peerStatus.status === 'online' ? nodeStatus.peerStatus.nodeName : 'Peer Node'}
                            </h3>
                            <span style={{
                                fontSize: '11px',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                backgroundColor: nodeStatus?.peerStatus && nodeStatus.peerStatus.status === 'online' ? (nodeStatus.peerStatus.nodeRole === 'Primary' ? 'var(--primary)' : '#64748b') : '#ef4444',
                                color: 'white',
                                fontWeight: 'bold'
                            }}>
                                {nodeStatus?.peerStatus && nodeStatus.peerStatus.status === 'online' ? nodeStatus.peerStatus.nodeRole.toUpperCase() : 'OFFLINE'}
                            </span>
                        </div>
                        <div className="text-sm mb-4 text-gray-600 flex flex-col gap-1 mt-3">
                            <p className="flex justify-between border-b pb-1"><span>IP/Hostname:</span> <strong>{process.env.NEXT_PUBLIC_PEER_NODE_ADDRESS || 'Not Configured'}</strong></p>
                            {nodeStatus?.peerStatus && nodeStatus.peerStatus.status === 'online' && (
                                <p className="flex justify-between border-b pb-1"><span>Last Backup:</span> <strong className="flex items-center gap-1"><Clock size={12}/> {nodeStatus.peerStatus.lastBackup !== 'Never' ? new Date(nodeStatus.peerStatus.lastBackup).toLocaleString() : 'Never'}</strong></p>
                            )}
                        </div>
                        {!process.env.NEXT_PUBLIC_PEER_NODE_ADDRESS && (
                            <div className="text-xs text-gray-500 italic mt-4 text-center">
                                Configure PEER_NODE_ADDRESS in .env
                            </div>
                        )}
                        {nodeStatus?.peerStatus && nodeStatus.peerStatus.status === 'offline' && (
                            <div className="text-xs text-red-500 font-medium mt-4 text-center">
                                Unable to reach peer. Check network connection or address.
                            </div>
                        )}
                    </div>
                </div>

                {/* Active Sessions */}
                <div className="mt-8 border-t pt-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Activity size={18}/> Active Sessions (Last 7 Days)</h3>
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="p-3 font-semibold text-gray-600">User</th>
                                    <th className="p-3 font-semibold text-gray-600">Role</th>
                                    <th className="p-3 font-semibold text-gray-600">IP Address</th>
                                    <th className="p-3 font-semibold text-gray-600">Browser / Device</th>
                                    <th className="p-3 font-semibold text-gray-600">Last Active</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {sessions.map(s => (
                                    <tr key={s.id} className="hover:bg-gray-50">
                                        <td className="p-3 font-medium">{s.username}</td>
                                        <td className="p-3"><span className="px-2 py-1 bg-gray-100 rounded-md text-xs font-medium">{s.role_name}</span></td>
                                        <td className="p-3 text-gray-600 font-mono text-xs">{s.ip_address || 'Unknown'}</td>
                                        <td className="p-3 text-gray-600 text-xs truncate max-w-[200px]" title={s.user_agent}>{s.user_agent || 'Unknown'}</td>
                                        <td className="p-3 text-gray-600">
                                            {s.last_active ? new Date(s.last_active).toLocaleString() : 'Just now'}
                                            {s.last_active && (Date.now() - new Date(s.last_active).getTime() < 300000) && (
                                                <span className="ml-2 inline-block w-2 h-2 bg-green-500 rounded-full" title="Online recently"></span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {sessions.length === 0 && (
                                    <tr><td colSpan={5} className="p-4 text-center text-gray-500">No active sessions found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="mt-6 p-4 rounded text-sm flex gap-3 bg-amber-50 border border-amber-200 text-amber-700">
                    <AlertTriangle size={20} className="shrink-0" />
                    <div>
                        <strong>Hardware Suitability Warning:</strong> Only provision "High-Spec PC" or "Standard Laptop with SSD" devices as server hosts. Mobile devices are strictly prohibited from acting as nodes.
                    </div>
                </div>
            </div>
        </div>
    );
}
