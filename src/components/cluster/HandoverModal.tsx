"use client";

import React, { useState, useEffect } from "react";
import { Server, ShieldAlert, CheckCircle2, RefreshCw, AlertTriangle, ArrowRight } from "lucide-react";
import { toast } from "@/components/Toast";

export default function HandoverModal() {
    const [clusterStatus, setClusterStatus] = useState<any>(null);
    const [accepting, setAccepting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressStatusText, setProgressStatusText] = useState("");
    const [showForceConfirm, setShowForceConfirm] = useState(false);

    const checkClusterStatus = async () => {
        try {
            const res = await fetch('/api/cluster/status');
            if (res.ok) {
                const data = await res.json();
                setClusterStatus(data);
            }
        } catch (e) {
            // Silently ignore background poller errors
        }
    };

    useEffect(() => {
        checkClusterStatus();
        const interval = setInterval(checkClusterStatus, 6000);
        return () => clearInterval(interval);
    }, []);

    const executePromotion = async (action: 'accept' | 'force') => {
        setAccepting(true);
        setProgress(15);
        setProgressStatusText("Connecting to local database engine...");

        try {
            await new Promise(r => setTimeout(r, 600));
            setProgress(40);
            setProgressStatusText("Executing `SELECT pg_promote()` — Exiting recovery mode...");

            const res = await fetch('/api/cluster/handover', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });

            const data = await res.json();

            if (data.success) {
                setProgress(80);
                setProgressStatusText("Unlocking full read/write database permissions...");
                await new Promise(r => setTimeout(r, 800));

                setProgress(100);
                setProgressStatusText("Promotion complete! Node is now live Primary Master.");
                toast.success("Node successfully promoted to Primary Master!");

                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                toast.error(data.error || "Promotion failed.");
                setAccepting(false);
                setProgress(0);
            }
        } catch (err: any) {
            toast.error("Network error during node promotion.");
            setAccepting(false);
            setProgress(0);
        }
    };

    if (!clusterStatus) return null;

    // Condition 1: Node B is Standby, and Node A has OFFERED Master role
    const isOfferActive = clusterStatus.handoverState === 'OFFERED' && clusterStatus.nodeRole !== 'Primary';

    if (!isOfferActive && !accepting && !showForceConfirm) {
        return null; // Don't show modal
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 border border-gray-100 text-center relative overflow-hidden">
                
                {/* Header Icon */}
                <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-5 border-4 border-blue-100 shadow-inner">
                    {accepting ? (
                        <RefreshCw size={38} className="animate-spin text-blue-600" />
                    ) : (
                        <Server size={38} />
                    )}
                </div>

                {/* Offer Stage */}
                {isOfferActive && !accepting && !showForceConfirm && (
                    <>
                        <span className="inline-block px-3 py-1 bg-amber-100 text-amber-800 font-bold text-xs rounded-full uppercase tracking-wider mb-3">
                            Master Handover Offered
                        </span>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            Accept Primary Master Role?
                        </h2>
                        <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                            <strong>{clusterStatus.handoverOfferedBy || 'Primary Node'}</strong> has yielded the Master database role. 
                            Clicking Accept will promote this node to the active Read/Write database master.
                        </p>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => executePromotion('accept')}
                                className="w-full py-3.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg hover:shadow-blue-500/25 transition-all flex items-center justify-center gap-2 text-base"
                            >
                                <CheckCircle2 size={20} />
                                Accept & Become Master
                            </button>

                            <button
                                onClick={() => setShowForceConfirm(true)}
                                className="w-full py-2.5 px-4 text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                            >
                                <ShieldAlert size={14} />
                                Forceful Emergency Takeover Options
                            </button>
                        </div>
                    </>
                )}

                {/* Progress Bar Stage */}
                {accepting && (
                    <div className="py-4">
                        <h2 className="text-xl font-bold text-gray-900 mb-2">
                            Promoting Node to Primary Master...
                        </h2>
                        <p className="text-sm font-medium text-gray-600 mb-6 h-6">
                            {progressStatusText}
                        </p>

                        {/* Progress Bar Container */}
                        <div className="w-full bg-gray-100 rounded-full h-4 mb-4 overflow-hidden p-0.5 border border-gray-200 shadow-inner">
                            <div 
                                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500 shadow"
                                style={{ width: `${progress}%` }}
                            />
                        </div>

                        <div className="text-xs font-bold text-blue-600 tracking-wider">
                            {progress}% COMPLETED
                        </div>
                    </div>
                )}

                {/* Force Takeover Confirmation Stage */}
                {showForceConfirm && !accepting && (
                    <>
                        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
                            <AlertTriangle size={24} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">
                            Emergency Forceful Takeover
                        </h2>
                        <p className="text-xs text-gray-600 mb-6 leading-relaxed">
                            Use this only if <strong>Machine A is powered off or unreachable</strong>. 
                            This will bypass handshake approval and issue engine-level promotion immediately.
                        </p>

                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => {
                                    setShowForceConfirm(false);
                                    executePromotion('force');
                                }}
                                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
                            >
                                <ShieldAlert size={18} />
                                Confirm Forceful Takeover
                            </button>

                            <button
                                onClick={() => setShowForceConfirm(false)}
                                className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors text-xs"
                            >
                                Cancel
                            </button>
                        </div>
                    </>
                )}

            </div>
        </div>
    );
}
