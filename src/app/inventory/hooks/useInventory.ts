import { useState, useEffect, useCallback } from "react";
import { InventoryItem, StockRequest, CompanyAsset } from "../types";
import { toast } from "@/components/Toast";

export function useInventory() {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [pendingRequests, setPendingRequests] = useState<StockRequest[]>([]);
    const [loadingRequests, setLoadingRequests] = useState(false);
    const [issuedRequests, setIssuedRequests] = useState<StockRequest[]>([]);
    const [loadingIssued, setLoadingIssued] = useState(false);
    const [assets, setAssets] = useState<CompanyAsset[]>([]);
    const [loadingAssets, setLoadingAssets] = useState(false);

    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/inventory");
            if (!res.ok) {
                // Don't overwrite state with error objects (causes .reduce crashes)
                console.error("Failed to fetch inventory:", res.status);
                return;
            }
            const data = await res.json();
            setItems(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to fetch inventory", error);
            toast.error("Failed to fetch inventory");
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchPendingRequests = useCallback(async () => {
        setLoadingRequests(true);
        try {
            const res = await fetch("/api/inventory/requests");
            if (res.ok) {
                setPendingRequests(await res.json());
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingRequests(false);
        }
    }, []);

    const fetchIssuedRequests = useCallback(async () => {
        setLoadingIssued(true);
        try {
            const res = await fetch("/api/inventory/requests?status=approved");
            if (res.ok) {
                setIssuedRequests(await res.json());
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to fetch issued stock history");
        } finally {
            setLoadingIssued(false);
        }
    }, []);

    const fetchAssets = useCallback(async () => {
        setLoadingAssets(true);
        try {
            const res = await fetch("/api/inventory/assets");
            if (res.ok) {
                setAssets(await res.json());
            }
        } catch (error) {
            console.error("Failed to fetch assets", error);
        } finally {
            setLoadingAssets(false);
        }
    }, []);

    const deleteItem = async (id: number) => {
        try {
            const res = await fetch(`/api/inventory/${id}`, { method: "DELETE" });
            if (res.ok) {
                await fetchItems();
                toast.success("Item deleted successfully");
                return true;
            } else {
                toast.error("Failed to delete item");
                return false;
            }
        } catch (error) {
            toast.error("Error deleting item");
            return false;
        }
    };

    const deleteAsset = async (id: number) => {
        try {
            const res = await fetch(`/api/inventory/assets/${id}`, { method: "DELETE" });
            if (res.ok) {
                await fetchAssets();
                toast.success("Asset deleted successfully");
                return true;
            } else {
                toast.error("Failed to delete asset");
                return false;
            }
        } catch (error) {
            toast.error("Error deleting asset");
            return false;
        }
    };

    return {
        items, setItems, loading, fetchItems,
        pendingRequests, setPendingRequests, loadingRequests, fetchPendingRequests,
        issuedRequests, setIssuedRequests, loadingIssued, fetchIssuedRequests,
        assets, setAssets, loadingAssets, fetchAssets,
        deleteItem, deleteAsset
    };
}
