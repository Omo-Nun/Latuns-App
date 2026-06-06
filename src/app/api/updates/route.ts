import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Fetch quotations that don't have a structured client_id
        const unlinked = db.prepare(`
            SELECT id, quote_number, client_name, client_phone, created_at, project_type 
            FROM quotations 
            WHERE client_id IS NULL OR client_id = ''
            ORDER BY client_name ASC
        `).all();

        // Group them by identical name and phone pair
        const groups: Record<string, any> = {};
        for (const q of unlinked as any[]) {
            const name = q.client_name?.trim() || 'Unknown';
            const phone = q.client_phone?.trim() || '';
            const key = `${name}::${phone}`.toLowerCase();

            if (!groups[key]) {
                groups[key] = {
                    client_name: name,
                    client_phone: phone,
                    quotations: []
                };
            }
            groups[key].quotations.push(q);
        }

        return NextResponse.json(Object.values(groups));
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch unlinked quotations' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { client_name, client_phone, quotation_ids } = await request.json();

        if (!client_name || !quotation_ids || !Array.isArray(quotation_ids)) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        db.exec('BEGIN TRANSACTION');
        try {
            // First, check if this EXACT client already exists natively
            let clientId: number | bigint | null = null;
            const existing = db.prepare(`
                SELECT id FROM clients 
                WHERE name = ? AND (phone = ? OR (phone = '' AND ? = '')) 
                LIMIT 1
            `).get(client_name, client_phone || '', client_phone || '') as any;

            if (existing) {
                clientId = existing.id;
            } else {
                const cStmt = db.prepare('INSERT INTO clients (name, phone) VALUES (?, ?)');
                const info = cStmt.run(client_name, client_phone || '');
                clientId = info.lastInsertRowid;
            }

            // Map all target quotations to this centralized Profile
            const updateStmt = db.prepare('UPDATE quotations SET client_id = ? WHERE id = ?');
            for (const qId of quotation_ids) {
                updateStmt.run(clientId, qId);
            }

            db.exec('COMMIT');
            return NextResponse.json({ success: true, client_id: Number(clientId) });
        } catch (e) {
            db.exec('ROLLBACK');
            throw e;
        }

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to merge quotations' }, { status: 500 });
    }
}
