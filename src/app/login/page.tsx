"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Lock, User, Eye, EyeOff, Loader2, Server, ArrowRight, ShieldCheck, AlertTriangle, ChevronDown, ChevronUp, Network } from 'lucide-react';

interface ClusterStatus {
    nodeName: string;
    nodeRole: string;
    canWrite: boolean;
    peerAddress: string | null;
    handover_redirect_url: string | null;
    isDbConnected: boolean;
}

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [clusterStatus, setClusterStatus] = useState<ClusterStatus | null>(null);
    const [showNodeSelector, setShowNodeSelector] = useState(false);
    const router = useRouter();

    const fetchClusterStatus = async () => {
        try {
            const res = await fetch('/api/cluster/status');
            if (res.ok) {
                const data = await res.json();
                setClusterStatus(data);
            }
        } catch (e) {
            // Ignore status fetch errors
        }
    };

    useEffect(() => {
        fetchClusterStatus();
        const interval = setInterval(fetchClusterStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (res.ok) {
                router.push('/');
                router.refresh();
            } else {
                setError(data.error || 'Invalid credentials');
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const isPrimary = clusterStatus?.nodeRole === 'Primary';
    const peerAddressClean = clusterStatus?.peerAddress ? clusterStatus.peerAddress.replace(/^https?:\/\//, '').split('/')[0] : null;
    const peerUrl = peerAddressClean ? `http://${peerAddressClean}:3000/login` : null;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f6f8fb] to-[#e2e8f0] p-5">
            <div className="dark-theme-provider w-full max-w-[460px]">
                <div className="card p-8 sm:p-10 shadow-xl border-none rounded-3xl bg-white">
                    <div className="text-center mb-6">
                        <Image 
                            src="/Logo 2026.svg" 
                            alt="Latuns Logo" 
                            width={180} 
                            height={60} 
                            className="object-contain mb-4 mx-auto"
                            priority
                        />
                        <h1 className="text-2xl font-extrabold text-[#1e293b] mb-1">Welcome Back</h1>
                        <p className="text-[#64748b] text-sm">Sign in to Latuns ERP</p>
                    </div>

                    {/* Cluster Node Status Guidance Panel */}
                    {clusterStatus && (
                        <div className="mb-6 rounded-2xl border p-4 bg-slate-50/80 transition-all">
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                    <Server size={18} className={isPrimary ? "text-emerald-600" : "text-amber-500"} />
                                    <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                                        Node: {clusterStatus.nodeName || 'Local Node'}
                                    </span>
                                </div>
                                <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                                    isPrimary 
                                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200" 
                                        : "bg-amber-100 text-amber-800 border border-amber-200"
                                }`}>
                                    {isPrimary ? "Primary Master" : "Standby Replica"}
                                </span>
                            </div>

                            {!isPrimary && peerUrl ? (
                                <div className="mt-3 pt-3 border-t border-slate-200/80">
                                    <div className="flex items-start gap-2 mb-3">
                                        <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                                        <p className="text-xs text-amber-900 leading-snug">
                                            This node is in <strong>Standby mode</strong>. For full active work, connect to the Primary Master.
                                        </p>
                                    </div>
                                    <a 
                                        href={peerUrl}
                                        className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2"
                                    >
                                        Connect to Primary Master ({peerAddressClean})
                                        <ArrowRight size={14} />
                                    </a>
                                </div>
                            ) : isPrimary ? (
                                <div className="flex items-center gap-1.5 text-xs text-emerald-700 mt-2 font-medium">
                                    <ShieldCheck size={14} />
                                    Active Primary Master — Read/Write Enabled
                                </div>
                            ) : null}

                            {/* Node Selector Drawer Toggle */}
                            <button
                                type="button"
                                onClick={() => setShowNodeSelector(!showNodeSelector)}
                                className="w-full mt-3 pt-2 border-t border-slate-200/60 text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center justify-between bg-transparent border-none cursor-pointer"
                            >
                                <span className="flex items-center gap-1">
                                    <Network size={13} />
                                    {showNodeSelector ? "Hide Node Options" : "Select / Switch Cluster Nodes"}
                                </span>
                                {showNodeSelector ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>

                            {/* Node Selector Drawer */}
                            {showNodeSelector && (
                                <div className="mt-3 pt-3 border-t border-slate-200 space-y-2 text-xs">
                                    <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                                        <div>
                                            <div className="font-bold text-slate-800">{clusterStatus.nodeName || 'This Machine'}</div>
                                            <div className="text-[10px] text-slate-500">Local Port 3000</div>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isPrimary ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                                            {isPrimary ? "Master (Active)" : "Standby"}
                                        </span>
                                    </div>

                                    {peerAddressClean && (
                                        <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                                            <div>
                                                <div className="font-bold text-slate-800">Peer Node ({peerAddressClean})</div>
                                                <div className="text-[10px] text-slate-500">{isPrimary ? "Secondary Standby" : "Primary Master"}</div>
                                            </div>
                                            <a 
                                                href={`http://${peerAddressClean}:3000/login`}
                                                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                                            >
                                                Switch <ArrowRight size={12} />
                                            </a>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-100 text-red-700 p-3 rounded-xl text-sm mb-6 text-center font-medium border border-red-200">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group mb-5">
                            <label className="form-label text-[#475569]">Username</label>
                            <div className="relative">
                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]">
                                    <User size={18} />
                                </div>
                                <input
                                    type="text"
                                    className="form-control pl-11 h-[50px] rounded-xl border-[#e2e8f0]"
                                    placeholder="Enter your username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group mb-8">
                            <label className="form-label text-[#475569]">Password</label>
                            <div className="relative">
                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]">
                                    <Lock size={18} />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="form-control pl-11 pr-11 h-[50px] rounded-xl border-[#e2e8f0]"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#475569] bg-transparent border-none cursor-pointer p-0"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            className="btn w-full h-[50px] rounded-xl text-base font-bold text-white bg-[#2325A1] hover:bg-[#1a1c7a] shadow-md transition-colors" 
                            disabled={loading}
                        >
                            {loading ? <Loader2 size={20} className="animate-spin mx-auto" /> : 'Sign In'}
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-[#94a3b8] text-[13px]">
                            &copy; 2026 Latuns Roofing System. All rights reserved.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
