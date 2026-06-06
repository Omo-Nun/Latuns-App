export type InventoryItem = {
    id: number;
    name: string;
    unit: string;
    description: string;
    default_price: number;
    tags?: string;
    stock_qty: number;
    min_stock: number;
    low_stock: number;
};

export type StockLog = {
    id: number;
    item_id: number;
    type: 'in' | 'out';
    qty: number;
    note: string;
    created_at: string;
};

export type StockRequestItem = {
    id: number;
    request_id: number;
    inventory_item_id: number;
    requested_qty: number;
    approved_qty: number;
    item_name: string;
    item_unit: string;
    current_stock: number;
};

export type StockRequest = {
    id: number;
    quotation_id: number;
    quote_number: string;
    client_name: string;
    project_type: string;
    status: string;
    created_at: string;
    items: StockRequestItem[];
};

export type CompanyAsset = {
    id: number;
    name: string;
    description?: string;
    classification?: string;
    image_url?: string;
    purchase_date?: string;
    purchase_cost?: number;
    current_value?: number;
    status: 'Active' | 'Under Repair' | 'Disposed';
    created_at: string;
};
