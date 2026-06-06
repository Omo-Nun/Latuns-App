import React, { useState } from "react";
import { format } from "date-fns";
import { RefreshCw, Download, Search } from "lucide-react";
import { StockRequest } from "../types";
import { downloadCsv } from "@/lib/csvUtils";

interface InventoryIssuedProps {
    requests: StockRequest[];
    loading: boolean;
    onRefresh: () => void;
}

export function InventoryIssued({ requests, loading, onRefresh }: InventoryIssuedProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const filteredRequests = requests.filter(req => 
        req.quote_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.client_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const exportIssued = () => {
        const headers = ["Date", "Quote #", "Client", "Item", "Approved Qty", "Unit"];
        const rows: any[] = [];
        requests.forEach(req => {
            req.items.forEach(item => {
                rows.push([
                    format(new Date(req.created_at), 'yyyy-MM-dd'),
                    req.quote_number,
                    req.client_name,
                    item.item_name,
                    item.approved_qty,
                    item.item_unit
                ]);
            });
        });
        downloadCsv(headers, rows, "Latuns_Issued_Stock_History");
    };

    return (
        <div className="inventory-issued">
            <div className="card mb-6 p-4 flex gap-4 items-center">
                <div className="search-wrapper flex-1">
                    <div className="search-icon">
                        <Search size={18} />
                    </div>
                    <input
                        type="text"
                        className="form-control search-input"
                        placeholder="Filter issued history..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-outline" onClick={exportIssued}>
                        <Download size={16} /> Export CSV
                    </button>
                    <button className="btn btn-outline" onClick={onRefresh} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            <div className="table-wrapper card">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Date Issued</th>
                            <th>Quotation #</th>
                            <th>Client Name</th>
                            <th>Project Type</th>
                            <th>Items Count</th>
                            <th style={{ textAlign: "right" }}>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: "center", padding: "32px" }}>Loading history...</td>
                            </tr>
                        ) : filteredRequests.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>
                                    No issued stock history found.
                                </td>
                            </tr>
                        ) : filteredRequests.map((req) => (
                            <React.Fragment key={req.id}>
                                <tr onClick={() => setExpandedId(expandedId === req.id ? null : req.id)} style={{ cursor: 'pointer' }}>
                                    <td>{format(new Date(req.created_at), 'MMM d, yyyy')}</td>
                                    <td style={{ fontWeight: 600 }}>{req.quote_number}</td>
                                    <td>{req.client_name}</td>
                                    <td>{req.project_type}</td>
                                    <td>{req.items.length} items issued</td>
                                    <td style={{ textAlign: "right", color: 'var(--primary)', fontWeight: 500 }}>
                                        {expandedId === req.id ? 'Hide' : 'Show Items'}
                                    </td>
                                </tr>
                                {expandedId === req.id && (
                                    <tr style={{ backgroundColor: '#f8fafc' }}>
                                        <td colSpan={6} style={{ padding: '0 20px 20px 20px' }}>
                                            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                                                <table className="table" style={{ margin: 0, fontSize: '13px' }}>
                                                    <thead style={{ backgroundColor: '#f1f5f9' }}>
                                                        <tr>
                                                            <th>Item Name</th>
                                                            <th>Issued Qty</th>
                                                            <th>Unit</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {req.items.map(item => (
                                                            <tr key={item.id}>
                                                                <td>{item.item_name}</td>
                                                                <td style={{ fontWeight: 600 }}>{item.approved_qty}</td>
                                                                <td>{item.item_unit}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
