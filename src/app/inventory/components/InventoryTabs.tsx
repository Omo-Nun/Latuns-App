import React from "react";
import { Search, X } from "lucide-react";

type Tab = 'catalog' | 'store' | 'requests' | 'issued' | 'assets';

interface InventoryTabsProps {
    activeTab: Tab;
    setActiveTab: (tab: Tab) => void;
    pendingCount: number;
    subPermissions?: any[];
    // Store specific controls
    storeSearchQuery?: string;
    setStoreSearchQuery?: (q: string) => void;
    storeFilterType?: 'all' | 'low';
    setStoreFilterType?: (t: 'all' | 'low') => void;
}

export function InventoryTabs({ 
    activeTab, setActiveTab, pendingCount, subPermissions,
    storeSearchQuery, setStoreSearchQuery,
    storeFilterType, setStoreFilterType
}: InventoryTabsProps) {
    const baseTabs: { id: Tab; label: string; subName: string }[] = [
        { id: 'catalog', label: 'Item Catalog', subName: 'Catalog' },
        { id: 'store', label: 'Store Management', subName: 'Store' },
        { id: 'requests', label: 'Stock Requests', subName: 'Requests' },
        { id: 'issued', label: 'Issued Stock Hub', subName: 'Issued' },
        { id: 'assets', label: 'Company Assets', subName: 'Assets' }
    ];

    const tabs = subPermissions && subPermissions.length > 0
        ? baseTabs.filter(bt => subPermissions.find(sp => sp.sub_module === bt.subName)?.allowed)
        : baseTabs;

    return (
        <div className="tab-bar" style={{ alignItems: 'center' }}>
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                >
                    {tab.label}
                    {tab.id === 'requests' && pendingCount > 0 && (
                        <span className="tab-badge">
                            {pendingCount}
                        </span>
                    )}
                </button>
            ))}


        </div>
    );
}
