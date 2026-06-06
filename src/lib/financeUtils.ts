/**
 * Centralized financial calculation logic for Latuns ERP
 */

// Safely round to 2 decimal places to prevent floating point precision errors
export const round2 = (num: number): number => {
    return Math.round((num + Number.EPSILON) * 100) / 100;
};

export interface QuotationLike {
    subtotal?: number;
    sundries?: string | number;
    transportation?: string | number;
    discount_value?: number;
    total_paid?: number;
    doc_type?: string;
    [key: string]: any;
}

/**
 * Calculates the numeric value of sundries (workmanship/margin).
 * Supports flat amounts or percentage strings (e.g., "10%").
 */
export const calcSundries = (q: QuotationLike): number => {
    const subtotal = Number(q.subtotal) || 0;
    const sundries = q.sundries;

    let val = 0;
    if (typeof sundries === 'string' && sundries.includes('%')) {
        const percentage = parseFloat(sundries.replace('%', ''));
        val = isNaN(percentage) ? 0 : (subtotal * percentage) / 100;
    } else {
        const flatVal = parseFloat(String(sundries || 0));
        val = isNaN(flatVal) ? 0 : flatVal;
    }
    return round2(val);
};

/**
 * Calculates the Grand Total of a quotation BEFORE discounts.
 * Grand Total = Subtotal + Sundries + Transportation
 */
export const calcGrandTotal = (q: QuotationLike): number => {
    const subtotal = Number(q.subtotal) || 0;
    const sundriesVal = calcSundries(q);
    const transportation = parseFloat(String(q.transportation || 0));
    
    const total = subtotal + sundriesVal + (isNaN(transportation) ? 0 : transportation);
    return round2(total);
};

/**
 * Calculates the Net Total after applying discounts.
 * Net Total = Grand Total - Discount
 */
export const calcNetTotal = (q: QuotationLike): number => {
    const grandTotal = calcGrandTotal(q);
    const discount = parseFloat(String(q.discount_value || 0));
    
    const net = grandTotal - (isNaN(discount) ? 0 : discount);
    return round2(net);
};

/**
 * Calculates the remaining balance.
 * Balance = Net Total - Total Paid
 */
export const calcBalance = (q: QuotationLike): number => {
    const netTotal = calcNetTotal(q);
    const paid = parseFloat(String(q.total_paid || 0));
    const bal = netTotal - (isNaN(paid) ? 0 : paid);
    return round2(bal);
};

/**
 * Checks if a document type should hide detailed breakdowns (sundries/transportation)
 */
export const isCompositeDoc = (docType?: string): boolean => {
    const dt = docType?.toLowerCase();
    return dt === 'project_scope' || dt === 'discount_statement';
};
