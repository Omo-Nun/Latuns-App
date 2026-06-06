import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePermission, getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const error = await requirePermission('Quotations', 'can_view');
    if (error) return error;

    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const search = searchParams.get('search') || '';
        const date = searchParams.get('date') || '';
        const startDate = searchParams.get('startDate') || '';
        const endDate = searchParams.get('endDate') || '';
        const year = searchParams.get('year') || '';
        const visited = searchParams.get('visited') || '';
        const sortKey = searchParams.get('sortKey') || 'created_at';
        const sortDir = searchParams.get('sortDir') === 'asc' ? 'ASC' : 'DESC';
        const offset = (page - 1) * limit;

        let query = `
            SELECT 
                q.*, 
                COALESCE(SUM(qi.total), 0) as subtotal,
                COALESCE((SELECT SUM(amount) FROM payments WHERE quotation_id = q.id), 0) as total_paid
            FROM quotations q
            LEFT JOIN quotation_items qi ON q.id = qi.quotation_id
            WHERE 1=1
        `;
        const params: any[] = [];

        if (search) {
            query += ` AND (q.client_name LIKE ? OR q.client_address LIKE ? OR q.quote_number LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (startDate && endDate) {
            query += ` AND DATE(q.created_at) >= ? AND DATE(q.created_at) <= ?`;
            params.push(startDate, endDate);
        } else if (date) {
            query += ` AND DATE(q.created_at) = ?`;
            params.push(date);
        }

        if (year) {
            query += ` AND strftime('%Y', q.created_at) = ?`;
            params.push(year);
        }

        if (visited) {
            query += ` AND q.visit_status = ?`;
            params.push(visited);
        }

        const allowedSortKeys = ['id', 'created_at', 'client_name', 'project_type', 'project_status', 'subtotal'];
        const safeSortKey = allowedSortKeys.includes(sortKey) ? (sortKey === 'subtotal' ? 'subtotal' : `q.${sortKey}`) : 'q.created_at';

        query += ` GROUP BY q.id ORDER BY ${safeSortKey} ${sortDir} LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const rawQuotes = db.prepare(query).all(...params);

        // Get total count for pagination
        let countQuery = `SELECT COUNT(*) as count FROM quotations q WHERE 1=1`;
        const countParams: any[] = [];
        if (search) {
            countQuery += ` AND (q.client_name LIKE ? OR q.client_address LIKE ? OR q.quote_number LIKE ?)`;
            countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (startDate && endDate) {
            countQuery += ` AND DATE(q.created_at) >= ? AND DATE(q.created_at) <= ?`;
            countParams.push(startDate, endDate);
        } else if (date) {
            countQuery += ` AND DATE(q.created_at) = ?`;
            countParams.push(date);
        }
        if (year) {
            countQuery += ` AND strftime('%Y', q.created_at) = ?`;
            countParams.push(year);
        }
        if (visited) {
            countQuery += ` AND q.visit_status = ?`;
            countParams.push(visited);
        }
        const totalCount = (db.prepare(countQuery).get(...countParams) as any).count;

        return NextResponse.json({
            data: rawQuotes,
            meta: {
                totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit)
            }
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch quotations' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const error = await requirePermission('Quotations', 'can_edit');
    if (error) return error;

    try {
        const data = await request.json();
        const { 
            client_name, client_phone, client_address, client_state, client_city, 
            project_type, subsidiary_name, agent_id, sundries, transportation, 
            items, is_composite, doc_type, discount_value, linked_quotations, 
            header_note, project_scope, discount_statement 
        } = data;

        if (!client_name || !items || items.length === 0) {
            return NextResponse.json({ error: 'Client name and at least one item are required' }, { status: 400 });
        }

        // Generate quote_number in format: L-26APR-QTN-001
        const now = new Date();
        const yy = now.getFullYear().toString().slice(-2);
        const mmm = now.toLocaleString('en-US', { month: 'short' }).toUpperCase();
        
        let typeCode = 'QTN';
        if (doc_type === 'project_scope') typeCode = 'PS';
        if (doc_type === 'discount_statement') typeCode = 'DS';
        if (doc_type === 'invoice') typeCode = 'INV';

        const prefix = `L-${yy}${mmm}-${typeCode}-`;
        let quote_number = '';

        let quotationId: number | bigint = 0;

        db.exec('BEGIN TRANSACTION');
        try {
            // Find latest quote with this prefix
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
            quote_number = `${prefix}${String(serial).padStart(3, '0')}`;

            let clientId: number | bigint | null = null;

            // Auto-create or fetch client profile
            const existingClient = db.prepare(`
                SELECT id FROM clients 
                WHERE name = ? AND (phone = ? OR (phone = '' AND ? = ''))
                LIMIT 1
            `).get(client_name, client_phone || '', client_phone || '') as any;

            if (existingClient) {
                clientId = existingClient.id;
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
                clientId = cInfo.lastInsertRowid;
            }

            const qStmt = db.prepare(`
                INSERT INTO quotations (
                    quote_number, subsidiary_name, agent_id, client_id, client_name, 
                    client_phone, client_address, client_state, client_city, 
                    project_type, sundries, transportation, status, doc_type, 
                    discount_value, linked_quotations, header_note, 
                    project_scope, discount_statement
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
            `);
            const info = qStmt.run(
                quote_number,
                subsidiary_name || 'LATUNS ROOFING SYSTEM',
                agent_id || null,
                clientId,
                client_name,
                client_phone || '',
                client_address || '',
                client_state || '',
                client_city || '',
                project_type || '',
                sundries || '',
                transportation || 0,
                doc_type || 'quotation',
                discount_value || 0,
                linked_quotations ? JSON.stringify(linked_quotations) : null,
                header_note || null,
                project_scope || null,
                discount_statement || null
            );
            quotationId = info.lastInsertRowid;

            const iStmt = db.prepare(`
        INSERT INTO quotation_items (quotation_id, description, qty, unit, unit_cost, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

            for (const item of items) {
                if (!item.description || !item.qty || !item.unit || !item.unit_cost) {
                    throw new Error('Invalid item data');
                }
                iStmt.run(quotationId, item.description, item.qty, item.unit, item.unit_cost, item.total);
            }

            // Log Activity
            if (clientId) {
                const actionDesc = is_composite ? `Generated ${doc_type === 'project_scope' ? 'Project Scope' : 'Discount Statement'} (${quote_number})` : `Created Quotation (${quote_number})`;
                db.prepare(`
                    INSERT INTO activity_logs (client_id, action_type, description, ref_id)
                    VALUES (?, ?, ?, ?)
                `).run(clientId, 'created_document', actionDesc, quotationId);
                db.prepare('UPDATE clients SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(clientId);
            }

            // Audit Log
            const session = await getSession();
            if (session) {
                logAudit(session.user.id, session.user.username, 'Create', 'Quotations', `Created ${doc_type || 'quotation'} ${quote_number}`, 'quotation', Number(quotationId));
            }

            db.exec('COMMIT');
        } catch (e) {
            db.exec('ROLLBACK');
            throw e;
        }

        return NextResponse.json({ id: Number(quotationId), success: true }, { status: 201 });
    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message || 'Failed to create quotation' }, { status: 500 });
    }
}
