import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: idStr } = await params;
        const id = parseInt(idStr, 10);

        // Fetch the quotation items
        const itemsStmt = db.prepare('SELECT description, qty FROM quotation_items WHERE quotation_id = ?');
        const quoteItems = itemsStmt.all(id) as { description: string, qty: number }[];

        if (!quoteItems || quoteItems.length === 0) {
            return NextResponse.json({ error: 'No items found in this quotation.' }, { status: 400 });
        }

        // Fetch current inventory
        const invStmt = db.prepare('SELECT id, name FROM inventory_items');
        const inventory = invStmt.all() as { id: number, name: string }[];

        db.exec('BEGIN TRANSACTION');
        try {
            // 1. Check if a pending request already exists for this quote to prevent concurrent duplicates
            const existingReq = db.prepare("SELECT id FROM stock_requests WHERE quotation_id = ? AND status = 'pending'").get(id) as any;
            if (existingReq) {
                db.exec('ROLLBACK');
                return NextResponse.json({ error: 'A pending stock request for this quotation already exists.' }, { status: 400 });
            }

            // 2. Create the pending Request Header
            const reqStmt = db.prepare('INSERT INTO stock_requests (quotation_id, status) VALUES (?, ?)');
            const reqInfo = reqStmt.run(id, 'pending');
            const newRequestId = reqInfo.lastInsertRowid;

            let itemsRequested = 0;
            const reqItemStmt = db.prepare('INSERT INTO stock_request_items (request_id, inventory_item_id, requested_qty, approved_qty) VALUES (?, ?, ?, ?)');

            for (const qItem of quoteItems) {
                // Try to find a matching inventory item by name (case-insensitive)
                const matchedInv = inventory.find(inv => inv.name.toLowerCase().trim() === qItem.description.toLowerCase().trim());

                if (matchedInv) {
                    reqItemStmt.run(newRequestId, matchedInv.id, qItem.qty, qItem.qty);
                    itemsRequested++;
                }
            }

            if (itemsRequested === 0) {
                db.exec('ROLLBACK'); // Rollback the header if no items matched
                return NextResponse.json({ error: 'No items in the quotation matched existing inventory items.' }, { status: 400 });
            }

            db.exec('COMMIT');
            return NextResponse.json({ success: true, count: itemsRequested }, { status: 201 });
        } catch (e) {
            db.exec('ROLLBACK');
            throw e;
        }
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create stock request' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        // Delete the rejected stock request for this quotation to dismiss the notification
        db.prepare("DELETE FROM stock_requests WHERE quotation_id = ? AND status = 'rejected'").run(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to dismiss stock request' }, { status: 500 });
    }
}
