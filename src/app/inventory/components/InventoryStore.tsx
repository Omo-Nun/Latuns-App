import React, { useState } from "react";
import { History, AlertCircle, ArrowUpDown, Search } from "lucide-react";
import { InventoryItem } from "../types";

interface InventoryStoreProps {
    items: InventoryItem[];
    onManageStock: (item: InventoryItem) => void;
    onViewHistory: () => void;
    onExportLowStock: () => void;
    searchQuery: string;
    filterType: 'all' | 'low';
    setSearchQuery: (query: string) => void;
    setFilterType: (type: 'all' | 'low') => void;
}

export function InventoryStore({ 
    items, onManageStock, onViewHistory, onExportLowStock, 
    searchQuery, filterType, setSearchQuery, setFilterType
}: InventoryStoreProps) {
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    let itemsToDisplay = [...items];

    if (searchQuery.trim() !== '') {
        itemsToDisplay = itemsToDisplay.filter(item =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }

    if (filterType === 'low') {
        itemsToDisplay = itemsToDisplay.filter(item => item.stock_qty <= (item.low_stock ?? 20));
    }

    if (sortConfig) {
        itemsToDisplay.sort((a, b) => {
            let aVal: any = a[sortConfig.key as keyof InventoryItem];
            let bVal: any = b[sortConfig.key as keyof InventoryItem];

            if (sortConfig.key === 'tags') {
                aVal = (a.tags || "").toLowerCase();
                bVal = (b.tags || "").toLowerCase();
            }

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    return (
        <div className="inventory-store">
            <div className="card mb-6 p-4 flex gap-4 items-center flex-wrap">
                <div className="search-wrapper flex-1" style={{ minWidth: '200px' }}>
                    <div className="search-icon">
                        <Search size={18} />
                    </div>
                    <input
                        type="text"
                        className="form-control search-input"
                        placeholder="Search inventory..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex bg-[var(--sidebar-hover)] rounded-[var(--radius-lg)] p-1 border border-[var(--border)] shadow-inner">
                    <button
                        onClick={() => setFilterType('all')}
                        className={`px-3 py-1.5 rounded-md text-[13px] cursor-pointer border-none transition-all ${filterType === 'all' ? 'bg-[var(--bg-color-alt)] text-primary font-bold shadow-sm' : 'bg-transparent text-muted font-medium shadow-none'}`}
                    >
                        Entire Store
                    </button>
                    <button
                        onClick={() => setFilterType('low')}
                        className={`px-3 py-1.5 rounded-md text-[13px] cursor-pointer border-none transition-all ${filterType === 'low' ? 'bg-[var(--bg-color-alt)] text-red-700 font-bold shadow-sm' : 'bg-transparent text-muted font-medium shadow-none'}`}
                    >
                        Low Stock
                    </button>
                </div>
                <div className="flex gap-2 ml-auto">
                    <button className="btn btn-outline" onClick={onViewHistory}>
                        <History size={16} /> View History
                    </button>
                    <button className="btn btn-outline" onClick={onExportLowStock}>
                        <AlertCircle size={16} /> Export Low Stock
                    </button>
                </div>
            </div>

            <div className="table-wrapper card">
                <table className="table">
                    <thead>
                        <tr>
                            <th onClick={() => handleSort('name')} className="cursor-pointer">Name <ArrowUpDown size={14} className="inline ml-1" /></th>
                            <th onClick={() => handleSort('unit')} className="cursor-pointer">Unit <ArrowUpDown size={14} className="inline ml-1" /></th>
                            <th onClick={() => handleSort('stock_qty')} className="cursor-pointer">Current Stock <ArrowUpDown size={14} className="inline ml-1" /></th>
                            <th onClick={() => handleSort('tags')} className="cursor-pointer">Category <ArrowUpDown size={14} className="inline ml-1" /></th>
                            <th className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {itemsToDisplay.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="text-center p-8 text-muted">
                                    No items found matching your criteria.
                                </td>
                            </tr>
                        ) : itemsToDisplay.map((item) => {
                            const isCritical = item.stock_qty <= (item.min_stock ?? 10);
                            const isLow = !isCritical && item.stock_qty <= (item.low_stock ?? 20);

                            return (
                                <tr key={item.id}>
                                    <td className="font-medium">{item.name}</td>
                                    <td>
                                        <span className="badge bg-accent/10 text-accent">
                                            {item.unit}
                                        </span>
                                    </td>
                                    <td className={`font-bold ${isCritical ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-primary'}`}>
                                        {item.stock_qty.toLocaleString()}
                                        {isCritical && <span className="text-[11px] ml-2 text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5"><AlertCircle size={12} /> Critical</span>}
                                        {isLow && <span className="text-[11px] ml-2 text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">Low</span>}
                                    </td>
                                    <td className="text-muted">{item.tags || "-"}</td>
                                    <td className="text-right">
                                        <button
                                            className="btn btn-primary px-3 py-1.5 text-[13px]"
                                            onClick={() => onManageStock(item)}
                                        >
                                            Manage Stock
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
