"use client";
import { Package } from "lucide-react";

import React, { useState, useEffect, Suspense } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from "@/components/Toast";
import { downloadCsv } from "@/lib/csvUtils";

// Types
import { InventoryItem, StockRequest, CompanyAsset, StockLog } from "./types";

// Hooks
import { useInventory } from "./hooks/useInventory";

// Components
import { InventoryTabs } from "./components/InventoryTabs";
import { InventoryCatalog } from "./components/InventoryCatalog";
import { InventoryStore } from "./components/InventoryStore";
import { InventoryRequests } from "./components/InventoryRequests";
import { InventoryIssued } from "./components/InventoryIssued";
import { InventoryAssets } from "./components/InventoryAssets";

// Modals
import { ItemModal } from "./components/ItemModal";
import { StockModal } from "./components/StockModal";
import { HistoryModal } from "./components/HistoryModal";
import { AssetModal } from "./components/AssetModal";
import { ReviewModal } from "./components/ReviewModal";
import { ConfirmationModal } from "./components/ConfirmationModal";

function InventoryContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const filterParam = searchParams.get('filter');
    const tabParam = searchParams.get('tab') as 'catalog' | 'store' | 'requests' | 'issued' | 'assets' | null;

    const {
        items, setItems, loading, fetchItems,
        pendingRequests, loadingRequests, fetchPendingRequests,
        issuedRequests, loadingIssued, fetchIssuedRequests,
        assets, loadingAssets, fetchAssets,
        deleteItem, deleteAsset
    } = useInventory();

    // Tab state
    const [activeTab, setActiveTab] = useState<'catalog' | 'store' | 'requests' | 'issued' | 'assets'>(tabParam || 'catalog');
    const [subPermissions, setSubPermissions] = useState<any[]>([]);
    const [permissionsLoading, setPermissionsLoading] = useState(true);

    // Store Search/Filter state
    const [storeSearchQuery, setStoreSearchQuery] = useState("");
    const [storeFilterType, setStoreFilterType] = useState<'all' | 'low'>('all');

    // Modal Visibility
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

    const [isStockModalOpen, setIsStockModalOpen] = useState(false);
    const [selectedStockItem, setSelectedStockItem] = useState<InventoryItem | null>(null);

    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [historyLogs, setHistoryLogs] = useState<StockLog[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [historyFromDate, setHistoryFromDate] = useState("");
    const [historyToDate, setHistoryToDate] = useState("");

    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<CompanyAsset | null>(null);

    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [reviewingRequest, setReviewingRequest] = useState<StockRequest | null>(null);
    const [reviewItemsData, setReviewItemsData] = useState<{ [key: number]: number }>({});
    const [savingReview, setSavingReview] = useState(false);

    const [confirmation, setConfirmation] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        confirmText: string;
        isDestructive: boolean;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: "",
        message: "",
        confirmText: "Confirm",
        isDestructive: false,
        onConfirm: () => {}
    });

    // Fetch Sub-permissions
    useEffect(() => {
        const fetchPerms = async () => {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const userData = await res.json();
                    if (userData.user) {
                        const sRes = await fetch(`/api/staff/roles/${userData.user.role_id}/sub-permissions`);
                        if (sRes.ok) {
                            const perms = await sRes.json();
                            const inventoryPerms = perms.filter((p: any) => p.module === 'Inventory');
                            setSubPermissions(inventoryPerms);
                            
                            // Set first allowed tab as active
                            const allowed = inventoryPerms.filter((p: any) => p.allowed).map((p: any) => p.sub_module.toLowerCase());
                            if (allowed.length > 0 && !allowed.includes(activeTab)) {
                                setActiveTab(allowed[0] as any);
                                router.replace('/inventory?tab=' + allowed[0], { scroll: false }); if (window.scrollY > 80) window.scrollTo({ top: 80, behavior: 'instant' });;
                            }
                        }
                    }
                }
            } catch { /* silent */ } finally {
                setPermissionsLoading(false);
            }
        };
        fetchPerms();
    }, []);

    // Initialization
    useEffect(() => {
        if (filterParam === 'alerts') {
            setActiveTab('store');
            setStoreFilterType('low');
        }
        fetchItems();
        fetchPendingRequests();
        fetchAssets();
    }, [filterParam, fetchItems, fetchPendingRequests, fetchAssets]);

    useEffect(() => {
        if (activeTab === 'requests') fetchPendingRequests();
        if (activeTab === 'issued') fetchIssuedRequests();
        if (activeTab === 'assets') fetchAssets();
    }, [activeTab, fetchPendingRequests, fetchIssuedRequests, fetchAssets]);

    // --- Action Handlers ---

    const handleSaveItem = async (data: any) => {
        try {
            const isEdit = !!editingItem;
            const url = isEdit ? `/api/inventory/${editingItem.id}` : "/api/inventory";
            const method = isEdit ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (res.ok) {
                toast.success(`Item ${isEdit ? 'updated' : 'created'} successfully`);
                fetchItems();
                setIsItemModalOpen(false);
            } else {
                toast.error("Failed to save item");
            }
        } catch (error) {
            toast.error("Error saving item");
        }
    };

    const handleSaveStock = async (data: any) => {
        if (!selectedStockItem) return;
        try {
            const res = await fetch(`/api/inventory/${selectedStockItem.id}/stock`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (res.ok) {
                toast.success("Stock updated successfully");
                fetchItems();
                setIsStockModalOpen(false);
                if (filterParam === 'alerts') router.replace('/inventory?tab=store', { scroll: false });
            } else {
                const err = await res.json();
                toast.error(err.error || "Failed to update stock");
            }
        } catch (error) {
            toast.error("Error updating stock");
        }
    };

    const handleFetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const queryParams = new URLSearchParams();
            if (historyFromDate) queryParams.append('from', historyFromDate);
            if (historyToDate) queryParams.append('to', historyToDate);

            const res = await fetch(`/api/inventory/history?${queryParams.toString()}`);
            if (res.ok) {
                setHistoryLogs(await res.json());
            }
        } catch (error) {
            toast.error("Error fetching history");
        } finally {
            setLoadingHistory(false);
        }
    };

    useEffect(() => {
        if (isHistoryModalOpen) handleFetchHistory();
    }, [historyFromDate, historyToDate, isHistoryModalOpen]);

    const handleExportHistory = () => {
        const headers = ["Date", "Item Name", "Type", "Quantity", "Unit", "Note"];
        const rows = historyLogs.map(log => [
            new Date(log.created_at).toLocaleString(),
            (log as any).item_name || 'Deleted Item',
            log.type.toUpperCase(),
            log.qty,
            (log as any).item_unit || '',
            log.note || ""
        ]);
        downloadCsv(headers, rows, "Latuns_Store_History");
    };

    const handleSaveAsset = async (data: any) => {
        try {
            const isEdit = !!editingAsset;
            const url = isEdit ? `/api/inventory/assets/${editingAsset.id}` : "/api/inventory/assets";
            const method = isEdit ? "PUT" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (res.ok) {
                toast.success(`Asset ${isEdit ? 'updated' : 'created'} successfully`);
                fetchAssets();
                setIsAssetModalOpen(false);
            } else {
                toast.error("Failed to save asset");
            }
        } catch (error) {
            toast.error("Error saving asset");
        }
    };

    const handleReviewRequest = (req: StockRequest) => {
        setReviewingRequest(req);
        const initData: { [key: number]: number } = {};
        req.items.forEach(item => {
            initData[item.id] = item.requested_qty;
        });
        setReviewItemsData(initData);
        setIsReviewModalOpen(true);
    };

    const handleApproveRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reviewingRequest) return;
        setSavingReview(true);
        try {
            const payloadItems = reviewingRequest.items.map(item => ({
                id: item.id,
                inventory_item_id: item.inventory_item_id,
                approved_qty: reviewItemsData[item.id] || 0
            }));

            const res = await fetch(`/api/inventory/requests/${reviewingRequest.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: payloadItems }),
            });

            if (res.ok) {
                toast.success("Stock request approved");
                fetchPendingRequests();
                fetchItems();
                setIsReviewModalOpen(false);
            } else {
                toast.error("Failed to approve request");
            }
        } catch (error) {
            toast.error("Error approving request");
        } finally {
            setSavingReview(false);
        }
    };

    const handleRejectRequest = () => {
        if (!reviewingRequest) return;
        setConfirmation({
            isOpen: true,
            title: "Reject Request",
            message: "Are you sure you want to reject this request? No stock will be deducted.",
            confirmText: "Reject",
            isDestructive: true,
            onConfirm: async () => {
                setSavingReview(true);
                try {
                    const res = await fetch(`/api/inventory/requests/${reviewingRequest.id}`, { method: 'DELETE' });
                    if (res.ok) {
                        toast.success("Request rejected");
                        fetchPendingRequests();
                        setIsReviewModalOpen(false);
                    }
                } catch {
                    toast.error("Failed to reject request");
                } finally {
                    setSavingReview(false);
                    setConfirmation(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    };

    const handleRevertConfirm = () => {
        if (!reviewingRequest) return;
        setConfirmation({
            isOpen: true,
            title: "Confirm Return",
            message: "This will return the issued stock to the warehouse. Continue?",
            confirmText: "Confirm Return",
            isDestructive: false,
            onConfirm: async () => {
                setSavingReview(true);
                try {
                    const res = await fetch(`/api/inventory/requests/${reviewingRequest.id}/revert-confirm`, { method: 'PUT' });
                    if (res.ok) {
                        toast.success("Stock returned successfully");
                        fetchPendingRequests();
                        fetchItems();
                        setIsReviewModalOpen(false);
                    }
                } catch {
                    toast.error("Failed to confirm return");
                } finally {
                    setSavingReview(false);
                    setConfirmation(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    };

    const handleRevertDeny = () => {
        if (!reviewingRequest) return;
        setConfirmation({
            isOpen: true,
            title: "Deny Reversal",
            message: "The stock will remain issued. Continue?",
            confirmText: "Deny Reversal",
            isDestructive: true,
            onConfirm: async () => {
                setSavingReview(true);
                try {
                    const res = await fetch(`/api/inventory/requests/${reviewingRequest.id}/revert-deny`, { method: 'PUT' });
                    if (res.ok) {
                        toast.success("Reversal denied");
                        fetchPendingRequests();
                        setIsReviewModalOpen(false);
                    }
                } catch {
                    toast.error("Failed to deny reversal");
                } finally {
                    setSavingReview(false);
                    setConfirmation(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    };

    const totalValuation = Math.round((items.reduce((sum, item) => sum + (item.stock_qty > 0 ? (item.stock_qty * (item.default_price || 0)) : 0), 0) + Number.EPSILON) * 100) / 100;

    return (
        <div className="pb-24" style={{ minHeight: '120vh' }}>
            <div className="page-header mb-6">
                <div className="page-header-title-container">
                    <div className="page-header-icon bg-green-500">
                        <Package size={24} />
                    </div>
                    <div>
                        <h1 className="page-title">Inventory Management</h1>
                        <p className="page-description">Manage your items, pricing, and active stock levels</p>
                    </div>
                    <InventoryTabs 
                activeTab={activeTab} 
                setActiveTab={(newTab) => { setActiveTab(newTab); router.replace('/inventory?tab=' + newTab, { scroll: false }); if (window.scrollY > 80) window.scrollTo({ top: 80, behavior: 'instant' });; }} 
                pendingCount={pendingRequests.length}
                storeSearchQuery={storeSearchQuery}
                setStoreSearchQuery={setStoreSearchQuery}
                storeFilterType={storeFilterType}
                setStoreFilterType={setStoreFilterType}
                subPermissions={subPermissions}
            />
                </div>
                <div className="flex gap-3 items-center">
                    <div className="bg-green-50 px-4 py-3 rounded-lg border border-green-200 header-valuation-card">
                        <span className="text-sm text-success font-bold mr-2">Store Value</span>
                        <span className="text-lg text-success font-bold">₦{totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <button className="btn btn-outline flex items-center gap-2" onClick={() => { fetchItems(); fetchPendingRequests(); fetchAssets(); }}>
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                    {activeTab === 'catalog' && (
                        <button className="btn btn-primary" onClick={() => { setEditingItem(null); setIsItemModalOpen(true); }}>
                            <Plus size={18} /> Add New Item
                        </button>
                    )}
                    {activeTab === 'assets' && (
                        <button className="btn btn-primary" onClick={() => { setEditingAsset(null); setIsAssetModalOpen(true); }}>
                            <Plus size={18} /> Add New Asset
                        </button>
                    )}
                </div>
            </div>

            

            {activeTab === 'catalog' && (
                <InventoryCatalog 
                    items={items} 
                    setItems={setItems} 
                    onEdit={(item) => { setEditingItem(item); setIsItemModalOpen(true); }}
                    onDelete={deleteItem}
                />
            )}

            {activeTab === 'store' && (
                <InventoryStore 
                    items={items} 
                    onManageStock={(item) => { setSelectedStockItem(item); setIsStockModalOpen(true); }}
                    onViewHistory={() => setIsHistoryModalOpen(true)}
                    onExportLowStock={() => {
                        const low = items.filter(i => i.stock_qty <= (i.low_stock || 20));
                        const headers = ["Name", "Stock", "Unit", "Min", "Low"];
                        const rows = low.map(i => [i.name, i.stock_qty, i.unit, i.min_stock, i.low_stock]);
                        downloadCsv(headers, rows, "Low_Stock_Report");
                    }}
                    searchQuery={storeSearchQuery}
                    filterType={storeFilterType}
                    setSearchQuery={setStoreSearchQuery}
                    setFilterType={setStoreFilterType}
                />
            )}

            {activeTab === 'requests' && (
                <InventoryRequests 
                    requests={pendingRequests} 
                    loading={loadingRequests} 
                    onRefresh={fetchPendingRequests} 
                    onReview={handleReviewRequest}
                />
            )}

            {activeTab === 'issued' && (
                <InventoryIssued 
                    requests={issuedRequests} 
                    loading={loadingIssued} 
                    onRefresh={fetchIssuedRequests}
                />
            )}

            {activeTab === 'assets' && (
                <InventoryAssets 
                    assets={assets} 
                    loading={loadingAssets} 
                    onAdd={() => { setEditingAsset(null); setIsAssetModalOpen(true); }}
                    onEdit={(asset) => { setEditingAsset(asset); setIsAssetModalOpen(true); }}
                    onDelete={deleteAsset}
                />
            )}

            {/* Modals */}
            <ItemModal 
                isOpen={isItemModalOpen} 
                onClose={() => setIsItemModalOpen(false)} 
                onSave={handleSaveItem} 
                editingItem={editingItem} 
            />
            <StockModal 
                isOpen={isStockModalOpen} 
                onClose={() => setIsStockModalOpen(false)} 
                onSave={handleSaveStock} 
                item={selectedStockItem} 
            />
            <HistoryModal 
                isOpen={isHistoryModalOpen} 
                onClose={() => setIsHistoryModalOpen(false)} 
                logs={historyLogs} 
                loading={loadingHistory}
                fromDate={historyFromDate} setFromDate={setHistoryFromDate}
                toDate={historyToDate} setToDate={setHistoryToDate}
                onExport={handleExportHistory}
            />
            <AssetModal 
                isOpen={isAssetModalOpen} 
                onClose={() => setIsAssetModalOpen(false)} 
                onSave={handleSaveAsset} 
                editingAsset={editingAsset} 
            />
            <ReviewModal 
                isOpen={isReviewModalOpen} 
                onClose={() => setIsReviewModalOpen(false)} 
                request={reviewingRequest}
                itemsData={reviewItemsData}
                setItemsData={setReviewItemsData}
                onApprove={handleApproveRequest}
                onReject={handleRejectRequest}
                onRevertConfirm={handleRevertConfirm}
                onRevertDeny={handleRevertDeny}
                saving={savingReview}
            />
            <ConfirmationModal 
                isOpen={confirmation.isOpen}
                onClose={() => setConfirmation(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmation.onConfirm}
                title={confirmation.title}
                message={confirmation.message}
                confirmText={confirmation.confirmText}
                isDestructive={confirmation.isDestructive}
                loading={savingReview}
            />
        </div>
    );
}

export default function InventoryPage() {
    return (
        <Suspense fallback={<div className="container"><p>Loading inventory...</p></div>}>
            <InventoryContent />
        </Suspense>
    );
}
