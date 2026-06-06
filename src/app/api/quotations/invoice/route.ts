import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request: Request) {
    try {
        const data = await request.json();
        const { source_id } = data;

        if (!source_id) {
            return NextResponse.json({ error: 'Source ID is required' }, { status: 400 });
        }

        const sourceQuote = db.prepare('SELECT * FROM quotations WHERE id = ?').get(source_id) as any;
        if (!sourceQuote) {
            return NextResponse.json({ error: 'Source quotation not found' }, { status: 404 });
        }

        const sourceItems = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ?').all(source_id) as any[];

        // Generate Invoice Number in format: L-26APR-INV-001
        const now = new Date();
        const yy = now.getFullYear().toString().slice(-2);
        const mmm = now.toLocaleString('en-US', { month: 'short' }).toUpperCase();
        const prefix = `L-${yy}${mmm}-INV-`;

        const latest = db.prepare(`SELECT quote_number FROM quotations WHERE quote_number LIKE ? ORDER BY id DESC LIMIT 1`).get(`${prefix}%`) as any;

        let serial = 1;
        if (latest && latest.quote_number) {
            const parts = latest.quote_number.split('-');
            const lastSerialStr = parts[parts.length - 1];
            const lastSerial = parseInt(lastSerialStr, 10);
            if (!isNaN(lastSerial)) {
                serial = lastSerial + 1;
            }
        }
        const invNumber = `${prefix}${String(serial).padStart(3, '0')}`;

        db.exec('BEGIN TRANSACTION');
        try {
            const insertQuoteStmt = db.prepare(`
                INSERT INTO quotations (quote_number, subsidiary_name, client_name, client_phone, client_address, client_state, client_city, project_type, agent_id, client_id, sundries, transportation, status, visit_status, project_status, doc_type, discount_value, linked_quotations)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const insertResult = insertQuoteStmt.run(
                invNumber,
                sourceQuote.subsidiary_name,
                sourceQuote.client_name,
                sourceQuote.client_phone,
                sourceQuote.client_address,
                sourceQuote.client_state,
                sourceQuote.client_city,
                sourceQuote.project_type,
                sourceQuote.agent_id,
                sourceQuote.client_id,
                sourceQuote.sundries,
                sourceQuote.transportation,
                'pending',
                sourceQuote.visit_status,
                'Pending', // Reset Project Status for the Invoice Lifecycle
                'invoice',
                sourceQuote.discount_value,
                sourceQuote.linked_quotations
            );

            const newId = insertResult.lastInsertRowid;

            const insertItemStmt = db.prepare(`
                INSERT INTO quotation_items (quotation_id, description, qty, unit, unit_cost, total)
                VALUES (?, ?, ?, ?, ?, ?)
            `);

            for (const item of sourceItems) {
                insertItemStmt.run(newId, item.description, item.qty, item.unit, item.unit_cost, item.total);
            }

            // Log Activity
            if (sourceQuote.client_id) {
                db.prepare(`
                    INSERT INTO activity_logs (client_id, action_type, description, ref_id)
                    VALUES (?, ?, ?, ?)
                `).run(
                    sourceQuote.client_id,
                    'created_document',
                    `Generated Official Tax Invoice (${invNumber}) from ${sourceQuote.quote_number || 'Quote'}`,
                    newId
                );
                db.prepare('UPDATE clients SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(sourceQuote.client_id);
            }

            db.exec('COMMIT');
            return NextResponse.json({ id: newId, quote_number: invNumber }, { status: 201 });
        } catch (e) {
            db.exec('ROLLBACK');
            throw e;
        }

    } catch (error) {
        return NextResponse.json({ error: 'Failed to convert to invoice' }, { status: 500 });
    }
}
