"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, UserPlus, CheckCircle } from "lucide-react";

type UnlinkedGroup = {
    client_name: string;
    client_phone: string;
    quotations: any[];
};

export default function UpdatesPage() {
    const [groups, setGroups] = useState<UnlinkedGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [merging, setMerging] = useState<string | null>(null);

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            const res = await fetch('/api/updates');
            const data = await res.json();
            setGroups(data);
        } catch (error) {
            console.error("Failed to fetch unlinked groups", error);
        } finally {
            setLoading(false);
        }
    };

    const handleMerge = async (group: UnlinkedGroup) => {
        const key = `${group.client_name}-${group.client_phone}`;
        setMerging(key);
        try {
            const res = await fetch('/api/updates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_name: group.client_name,
                    client_phone: group.client_phone,
                    quotation_ids: group.quotations.map(q => q.id)
                })
            });

            if (res.ok) {
                // Remove group from UI instantly
                setGroups(groups.filter(g => `${g.client_name}-${g.client_phone}` !== key));
            } else {
                alert("Failed to merge quotations");
            }
        } catch (error) {
            alert("Error merging records");
        } finally {
            setMerging(null);
        }
    };

    return (
        <div className="max-w-[800px]">
            <div className="page-header mb-6">
                <div className="flex gap-4 items-center">
                    <Link href="/settings" className="btn btn-outline p-2">
                        <ArrowLeft size={16} />
                    </Link>
                    <div>
                        <h1 className="page-title mb-0">System Updates</h1>
                        <p className="page-description">Reconcile and merge legacy data records</p>
                    </div>
                </div>
            </div>

            <div className="card mb-6">
                <h2 className="text-base mb-2 font-semibold">Client Profile Merging</h2>
                <p className="text-muted mb-6 text-sm">
                    The system now robustly links Quotations to persistent Client Profiles.
                    Below are legacy quotations that share identical names and phone numbers but remain disconnected.
                    Merging them will immediately unify their billing history under a single secure Client Profile.
                </p>

                {loading ? (
                    <div className="p-6 text-center text-muted">Scanning database...</div>
                ) : groups.length === 0 ? (
                    <div className="p-8 text-center bg-[var(--bg-color)] rounded-lg text-[var(--text-muted)]">
                        <CheckCircle size={32} className="text-emerald-500 mx-auto mb-3" />
                        <div className="font-semibold text-[var(--text-main)]">Database is fully synced.</div>
                        <div>No legacy clients require merging.</div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {groups.map((group, idx) => {
                            const key = `${group.client_name}-${group.client_phone}`;
                            const isMerging = merging === key;

                            return (
                                <div key={idx} className="p-4 border rounded-lg flex justify-between items-center">
                                    <div>
                                        <div className="font-semibold text-base text-primary flex items-center gap-2">
                                            {group.client_name}
                                            {group.client_phone && <span className="text-[13px] font-normal text-[var(--text-muted)] bg-[var(--bg-color-alt)] px-2 py-0.5 rounded-full">{group.client_phone}</span>}
                                        </div>
                                        <div className="text-[13px] text-muted mt-1">
                                            Found <strong>{group.quotations.length}</strong> unlinked quotation(s)
                                        </div>
                                    </div>

                                    <button
                                        className="btn btn-primary"
                                        onClick={() => handleMerge(group)}
                                        disabled={isMerging}
                                    >
                                        <UserPlus size={16} /> {isMerging ? "Merging..." : "Merge Profile"}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
