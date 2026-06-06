import React, { useState } from "react";
import { GripVertical, Edit2, Trash2 } from "lucide-react";
import { InventoryItem } from "../types";

interface InventoryCatalogProps {
    items: InventoryItem[];
    setItems: (items: InventoryItem[]) => void;
    onEdit: (item: InventoryItem) => void;
    onDelete: (id: number) => void;
}

export function InventoryCatalog({ items, setItems, onEdit, onDelete }: InventoryCatalogProps) {
    const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

    const handleDragStart = (index: number) => {
        setDraggedItemIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedItemIndex === null || draggedItemIndex === index) return;

        const updatedItems = [...items];
        const draggedItem = updatedItems[draggedItemIndex];
        updatedItems.splice(draggedItemIndex, 1);
        updatedItems.splice(index, 0, draggedItem);

        setDraggedItemIndex(index);
        setItems(updatedItems);
    };

    const handleDrop = async () => {
        setDraggedItemIndex(null);
        const newOrderIds = items.map(item => item.id);
        try {
            await fetch('/api/inventory/reorder', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order: newOrderIds })
            });
        } catch (e) {
            console.error(e);
        }
    };

    let lastTag: string | null = null;

    return (
        <div className="table-wrapper card">
            <table className="table">
                <thead>
                    <tr>
                        <th className="w-10"></th>
                        <th>Name</th>
                        <th>Unit</th>
                        <th>Price</th>
                        <th>Category</th>
                        <th>Description</th>
                        <th className="text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {items.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="text-center p-8 text-muted">
                                No items in catalog.
                            </td>
                        </tr>
                    ) : items.map((item, index) => {
                        const currentTag = item.tags || "Uncategorized";
                        const isNewTag = currentTag !== lastTag;
                        lastTag = currentTag;

                        return (
                            <React.Fragment key={item.id}>
                                {isNewTag && (
                                    <tr style={{ backgroundColor: 'var(--sidebar-active-bg)' }}>
                                        <td colSpan={7} className="font-bold px-5 py-3 text-primary text-sm border-b-2 border-primary border-t" style={{ borderLeft: '4px solid var(--primary)' }}>
                                            {currentTag}
                                        </td>
                                    </tr>
                                )}
                                <tr
                                    draggable
                                    onDragStart={() => handleDragStart(index)}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDrop={handleDrop}
                                    onDragEnd={handleDrop}
                                    className={`cursor-grab ${draggedItemIndex === index ? 'opacity-50' : 'opacity-100'}`}
                                >
                                    <td className="text-center text-muted">
                                        <GripVertical size={16} />
                                    </td>
                                    <td className="font-medium">{item.name}</td>
                                    <td>
                                        <span className="badge bg-accent/10 text-accent">
                                            {item.unit}
                                        </span>
                                    </td>
                                    <td className="font-semibold">₦{(item.default_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    <td>
                                        {item.tags ? <span className="badge badge-completed">{item.tags}</span> : "-"}
                                    </td>
                                    <td className="text-muted">{item.description || "-"}</td>
                                    <td className="text-right flex gap-2 justify-end">
                                        <button className="btn btn-outline p-1.5" onClick={() => onEdit(item)} title="Edit Item">
                                            <Edit2 size={16} />
                                        </button>
                                        <button className="btn btn-danger p-1.5" onClick={() => onDelete(item.id)} title="Delete Item">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
