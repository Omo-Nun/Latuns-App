"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Phone, MapPin, Briefcase } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

export default function EstimatorProfilePage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id;
    const [agent, setAgent] = useState<any>(null);
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) fetchEstimatorData();
    }, [id]);

    const fetchEstimatorData = async () => {
        try {
            const res = await fetch(`/api/agents/${id}/clients`);
            if (res.ok) {
                const data = await res.json();
                setAgent(data.agent);
                setClients(data.clients || []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading profile...</div>;
    if (!agent) return <div className="p-8 text-center">Estimator not found.</div>;

    return (
        <div>
            <div className="page-header mb-6">
                <div className="flex gap-4 items-start">
                    <button onClick={() => router.back()} className="btn btn-outline p-2">
                        <ArrowLeft size={16} />
                    </button>
                    {agent.image_url && (
                        <div className="w-20 h-20 rounded-full overflow-hidden border-2">
                            <img src={agent.image_url} alt={agent.name} className="w-full h-full object-cover" />
                        </div>
                    )}
                    <div>
                        <div className="text-xs uppercase text-primary font-bold tracking-wider mb-1">
                            {agent.role || "Staff Profile"}
                        </div>
                        <h1 className="page-title mb-2">{agent.name}</h1>
                        <div className="flex gap-4 text-muted text-sm flex-wrap">
                            {agent.phone ? (
                                <div className="flex items-center gap-1.5">
                                    <Phone size={14} /> {agent.phone}
                                </div>
                            ) : null}
                            <div className="flex items-center gap-1.5">
                                <Briefcase size={14} /> {clients.length} Assigned Client(s)
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card mb-6">
                <h2 className="text-base mb-4 font-semibold">Assigned Clients Directory</h2>
                <div className="table-wrapper">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Client Name</th>
                                <th>Contact Information</th>
                                <th className="text-center">Total Quotes</th>
                                <th className="text-right">Accumulated Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {clients.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="text-center p-8 text-muted">No clients have been assigned to this estimator yet.</td>
                                </tr>
                            ) : (
                                clients.map((client: any) => (
                                    <tr key={client.id}>
                                        <td className="font-semibold">
                                            <Link href={`/people/clients/${client.id}`} className="no-underline text-primary block">
                                                {client.name}
                                            </Link>
                                        </td>
                                        <td>
                                            <div className="flex flex-col gap-1">
                                                {client.phone && <div className="flex items-center gap-1.5 text-[13px] text-muted"><Phone size={12} /> {client.phone}</div>}
                                                {(client.city || client.state) && <div className="flex items-center gap-1.5 text-[13px] text-muted"><MapPin size={12} /> {[client.city, client.state].filter(Boolean).join(", ")}</div>}
                                                {!client.phone && !client.city && !client.state && <span className="text-muted text-[13px]">No contact info listed</span>}
                                            </div>
                                        </td>
                                        <td className="text-center font-semibold">
                                            <span className="bg-[var(--bg-color)] px-3 py-1 rounded-full text-[13px]">
                                                {client.total_quotes}
                                            </span>
                                        </td>
                                        <td className="text-right font-bold text-[var(--text-main)]">
                                            ₦{(client.total_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
