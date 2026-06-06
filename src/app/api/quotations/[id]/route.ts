import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePermission, getSession } from '@/lib/auth';
import { calcGrandTotal } from '@/lib/financeUtils';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const error = await requirePermission('Quotations', 'can_view');
    if (error) return error;

    try {
        const { id } = await params;

        const quotation = db.prepare(`
            SELECT q.*, a.name as roof_estimator_name 
            FROM quotations q 
            LEFT JOIN agents a ON q.agent_id = a.id 
            WHERE q.id = ?
        `).get(id) as any;
        if (!quotation) {
            return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
        }

        const items = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ?').all(id);
        const payments = db.prepare('SELECT * FROM payments WHERE quotation_id = ? ORDER BY date DESC').all(id);

        // Subtotal
        const subtotal = Math.round((items.reduce((acc: number, item: any) => acc + item.total, 0) + Number.EPSILON) * 100) / 100;

        // Calculate total paid
        const total_paid = Math.round((payments.reduce((acc: number, payment: any) => acc + payment.amount, 0) + Number.EPSILON) * 100) / 100;

        // Sniff for Parent Document Hierarchy
        const parentDoc = db.prepare(`SELECT * FROM quotations WHERE doc_type != 'quotation' AND linked_quotations LIKE ?`).get(`%${id}%`) as any;
        let parent_ledger = null;

        if (parentDoc) {
            try {
                const linkedArray = parentDoc.linked_quotations ? JSON.parse(parentDoc.linked_quotations) : [];
                if (linkedArray.includes(Number(id))) {
                    const parentItems = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ?').all(parentDoc.id);
                    const parentPayments = db.prepare('SELECT * FROM payments WHERE quotation_id = ? ORDER BY date DESC').all(parentDoc.id);
                    const parentSubtotal = Math.round((parentItems.reduce((acc: number, item: any) => acc + item.total, 0) + Number.EPSILON) * 100) / 100;

                    const parentGrandTotal = calcGrandTotal({
                        subtotal: parentSubtotal,
                        sundries: parentDoc.sundries,
                        transportation: parentDoc.transportation
                    });
                    const parentTotalPaid = Math.round((parentPayments.reduce((acc: number, payment: any) => acc + payment.amount, 0) + Number.EPSILON) * 100) / 100;

                    parent_ledger = {
                        id: parentDoc.id,
                        quote_number: parentDoc.quote_number,
                        doc_type: parentDoc.doc_type,
                        grandTotal: parentGrandTotal,
                        discount_value: parentDoc.discount_value,
                        total_paid: parentTotalPaid,
                        payments: parentPayments
                    };
                }
            } catch (e) {
                // Silently bypass faulty parse
            }
        }

        // Fetch the latest stock request for this quotation (to drive Request Stock button state)
        const latestStockRequest = db.prepare(
            'SELECT id, status FROM stock_requests WHERE quotation_id = ? ORDER BY created_at DESC LIMIT 1'
        ).get(id) as any;

        return NextResponse.json({
            ...quotation,
            subtotal,
            total_paid,
            items,
            payments,
            parent_ledger,
            latest_stock_request: latestStockRequest || null
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch quotation' }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const error = await requirePermission('Quotations', 'can_edit');
    if (error) return error;

    try {
        const { id } = await params;
        const data = await request.json();
        const { 
            status, sundries, transportation, client_name, client_phone, client_address, client_state, client_city, 
            project_type, subsidiary_name, agent_id, items, client_visited, visit_status, header_note,
            project_scope, discount_statement 
        } = data;

        db.exec('BEGIN TRANSACTION');
        try {
            // Update quotation fields
            const updates = [];
            const values = [];

            if (status !== undefined) { updates.push('status = ?'); values.push(status); }
            if (sundries !== undefined) { updates.push('sundries = ?'); values.push(sundries); }
            if (transportation !== undefined) { updates.push('transportation = ?'); values.push(transportation); }

            if (client_name !== undefined) {
                updates.push('client_name = ?'); values.push(client_name);

                // Find the current client_id for this quotation
                const currentQuotation = db.prepare('SELECT client_id FROM quotations WHERE id = ?').get(id) as { client_id: number } | undefined;
                let clientId = currentQuotation?.client_id;

                if (clientId) {
                    // Update existing client record
                    db.prepare(`
                        UPDATE clients 
                        SET name = ?, phone = ?, address = ?, state = ?, city = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `).run(
                        client_name,
                        client_phone || '',
                        client_address || '',
                        client_state || '',
                        client_city || '',
                        clientId
                    );
                } else {
                    // Try to find client by phone/name to avoid duplicates if quotation had no client_id
                    const existingClient = db.prepare(`
                        SELECT id FROM clients 
                        WHERE name = ? AND (phone = ? OR (phone = '' AND ? = ''))
                        LIMIT 1
                    `).get(client_name, client_phone || '', client_phone || '') as any;

                    if (existingClient) {
                        clientId = existingClient.id;
                        // Also update their details to match latest entry
                        db.prepare(`
                            UPDATE clients 
                            SET address = ?, state = ?, city = ?, updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        `).run(client_address || '', client_state || '', client_city || '', clientId);
                    } else {
                        const cStmt = db.prepare(`
                            INSERT INTO clients (name, phone, address, state, city)
                            VALUES (?, ?, ?, ?, ?)
                        `);
                        const cInfo = cStmt.run(
                            client_name,
                            client_phone || '',
                            client_address || '',
                            client_state || '',
                            client_city || ''
                        );
                        clientId = Number(cInfo.lastInsertRowid);
                    }
                    updates.push('client_id = ?'); values.push(clientId);
                }
            }

            if (client_phone !== undefined) { updates.push('client_phone = ?'); values.push(client_phone); }
            if (client_address !== undefined) { updates.push('client_address = ?'); values.push(client_address); }
            if (client_state !== undefined) { updates.push('client_state = ?'); values.push(client_state); }
            if (client_city !== undefined) { updates.push('client_city = ?'); values.push(client_city); }
            if (project_type !== undefined) { updates.push('project_type = ?'); values.push(project_type); }
            if (subsidiary_name !== undefined) { updates.push('subsidiary_name = ?'); values.push(subsidiary_name); }
            if (agent_id !== undefined) { updates.push('agent_id = ?'); values.push(agent_id); }
            if (client_visited !== undefined) { updates.push('client_visited = ?'); values.push(client_visited); }
            if (visit_status !== undefined) { updates.push('visit_status = ?'); values.push(visit_status); }
            if (header_note !== undefined) { updates.push('header_note = ?'); values.push(header_note); }
            if (project_scope !== undefined) { updates.push('project_scope = ?'); values.push(project_scope); }
            if (discount_statement !== undefined) { updates.push('discount_statement = ?'); values.push(discount_statement); }

            if (updates.length > 0) {
                const stmt = db.prepare(`UPDATE quotations SET ${updates.join(', ')} WHERE id = ?`);
                stmt.run(...values, id);
            }

            // Update items if provided
            if (items && Array.isArray(items)) {
                // Delete old items
                db.prepare('DELETE FROM quotation_items WHERE quotation_id = ?').run(id);
                // Insert new items
                const iStmt = db.prepare(`
                    INSERT INTO quotation_items (quotation_id, description, qty, unit, unit_cost, total)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);
                for (const item of items) {
                    if (!item.description || !item.qty || !item.unit || !item.unit_cost) {
                        throw new Error('Invalid item data');
                    }
                    iStmt.run(id, item.description, item.qty, item.unit, item.unit_cost, item.total);
                }
            }

            // Audit Log
            const session = await getSession();
            if (session) {
                const q = db.prepare('SELECT quote_number FROM quotations WHERE id = ?').get(id) as any;
                logAudit(session.user.id, session.user.username, 'Update', 'Quotations', `Updated quotation ${q?.quote_number || id}`, 'quotation', Number(id));
            }

            db.exec('COMMIT');
            return NextResponse.json({ success: true });
        } catch (e) {
            db.exec('ROLLBACK');
            throw e;
        }
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update quotation' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const error = await requirePermission('Quotations', 'can_delete');
    if (error) return error;

    try {
        const { id } = await params;
        const session = await getSession();

        const q = db.prepare('SELECT quote_number FROM quotations WHERE id = ?').get(id) as any;

        // Because of ON DELETE CASCADE, deleting the quotation will delete items and payments
        db.prepare('DELETE FROM quotations WHERE id = ?').run(id);

        if (session) {
            logAudit(session.user.id, session.user.username, 'Delete', 'Quotations', `Deleted quotation ${q?.quote_number || id}`, 'quotation', Number(id));
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete quotation' }, { status: 500 });
    }
}
