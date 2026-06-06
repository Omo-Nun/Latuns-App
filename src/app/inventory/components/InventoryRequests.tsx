import React from "react";
import { format } from "date-fns";
import { RefreshCw } from "lucide-react";
import { StockRequest } from "../types";

interface InventoryRequestsProps {
    requests: StockRequest[];
    loading: boolean;
    onRefresh: () => void;
    onReview: (request: StockRequest) => void;
}

export function InventoryRequests({ requests, loading, onRefresh, onReview }: InventoryRequestsProps) {
    return (
        <div className="inventory-requests">
            <div className="table-wrapper card">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Quotation</th>
                            <th>Client</th>
                            <th>Project</th>
                            <th>Items</th>
                            <th>Status</th>
                            <th style={{ textAlign: "right" }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={7} style={{ textAlign: "center", padding: "32px" }}>Loading requests...</td>
                            </tr>
                        ) : requests.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>
                                    No pending stock requests.
                                </td>
                            </tr>
                        ) : requests.map((req) => (
                            <tr key={req.id}>
                                <td>{format(new Date(req.created_at), 'MMM d, yyyy')}</td>
                                <td style={{ fontWeight: 600 }}>{req.quote_number}</td>
                                <td>{req.client_name}</td>
                                <td>{req.project_type}</td>
                                <td>{req.items.length} items</td>
                                <td>
                                    <span className={`badge ${req.status === 'revert_pending' ? 'badge-rejected' : 'badge-pending'}`} 
                                          style={req.status === 'revert_pending' ? {backgroundColor: '#fef2f2', color: '#dc2626'} : {}}>
                                        {req.status === 'revert_pending' ? 'REVERSAL PENDING' : 'PENDING'}
                                    </span>
                                </td>
                                <td style={{ textAlign: "right" }}>
                                    <button
                                        className={`btn ${req.status === 'revert_pending' ? 'btn-danger' : 'btn-primary'}`}
                                        style={{ padding: "6px 16px", fontSize: "13px" }}
                                        onClick={() => onReview(req)}
                                    >
                                        {req.status === 'revert_pending' ? 'Review Reversal' : 'Review & Approve'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
