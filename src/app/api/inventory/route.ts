import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
    const error = await requirePermission('Inventory', 'can_view');
    if (error) return error;

    try {
        const items = db.prepare('SELECT * FROM inventory_items ORDER BY display_order ASC, name ASC').all();
        return NextResponse.json(items);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const error = await requirePermission('Inventory', 'can_edit');
    if (error) return error;

    try {
        const data = await request.json();
        const { name, unit, description, default_price, tags, min_stock, low_stock } = data;

        if (!name || !unit) {
            return NextResponse.json({ error: 'Name and unit are required' }, { status: 400 });
        }

        const stmt = db.prepare('INSERT INTO inventory_items (name, unit, description, default_price, tags, min_stock, low_stock) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const info = stmt.run(name, unit, description || '', default_price || 0, tags || null, min_stock === undefined ? 10 : min_stock, low_stock === undefined ? 20 : low_stock);

        return NextResponse.json({ id: info.lastInsertRowid }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to add item' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const error = await requirePermission('Inventory', 'can_delete');
    if (error) return error;

    try {

        const { searchParams } = new URL(request.url);
        if (searchParams.get('action') !== 'reset_all_confirm') {
            return NextResponse.json({ error: 'To reset all inventory, use action=reset_all_confirm' }, { status: 400 });
        }

        db.exec('BEGIN TRANSACTION');
        try {
            db.prepare('UPDATE inventory_items SET stock_qty = 0').run();
            db.prepare('DELETE FROM inventory_logs').run();
            db.prepare('DELETE FROM stock_requests').run();
            // stock_request_items will be deleted via CASCADE
            db.exec('COMMIT');
        } catch (e) {
            db.exec('ROLLBACK');
            throw e;
        }
        return NextResponse.json({ message: 'Inventory levels and history reset successfully' });
    } catch (error) {
        console.error('Reset failed:', error);
        return NextResponse.json({ error: 'Failed to reset inventory' }, { status: 500 });
    }
}
