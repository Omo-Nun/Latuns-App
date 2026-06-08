import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePermission, getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { quotations, quotationItems, clients, activityLogs, payments } from '@/lib/schema';
import { eq, or, and, sql, desc, asc, like, gte, lte } from 'drizzle-orm';

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

        const whereClauses = [];

        if (search) {
            whereClauses.push(`(q.client_name ILIKE '%${search}%' OR q.client_address ILIKE '%${search}%' OR q.quote_number ILIKE '%${search}%')`);
        }

        if (startDate && endDate) {
            whereClauses.push(`DATE(q.created_at) >= '${startDate}' AND DATE(q.created_at) <= '${endDate}'`);
        } else if (date) {
            whereClauses.push(`DATE(q.created_at) = '${date}'`);
        }

        if (year) {
            whereClauses.push(`EXTRACT(YEAR FROM q.created_at)::text = '${year}'`);
        }

        if (visited) {
            whereClauses.push(`q.visit_status = '${visited}'`);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const allowedSortKeys = ['id', 'created_at', 'client_name', 'project_type', 'project_status', 'subtotal'];
        const safeSortKey = allowedSortKeys.includes(sortKey) ? (sortKey === 'subtotal' ? 'subtotal' : `q.${sortKey}`) : 'q.created_at';

        const query = `
            SELECT 
                q.*, 
                COALESCE(SUM(qi.total), 0) as subtotal,
                COALESCE((SELECT SUM(amount) FROM payments WHERE quotation_id = q.id), 0) as total_paid
            FROM quotations q
            LEFT JOIN quotation_items qi ON q.id = qi.quotation_id
            ${whereSql}
            GROUP BY q.id 
            ORDER BY ${safeSortKey} ${sortDir} 
            LIMIT ${limit} OFFSET ${offset}
        `;

        const countQuery = `SELECT COUNT(DISTINCT q.id) as count FROM quotations q ${whereSql}`;

        const rawQuotesRes = await db.execute(sql.raw(query));
        const countRes = await db.execute(sql.raw(countQuery));
        const totalCount = Number(countRes.rows[0].count);

        return NextResponse.json({
            data: rawQuotesRes.rows,
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

        let quotationId = 0;

        await db.transaction(async (tx) => {
            // Find latest quote with this prefix
            const latestRes = await tx.execute(sql.raw(`SELECT quote_number FROM quotations WHERE quote_number LIKE '${prefix}%' ORDER BY id DESC LIMIT 1`));
            const latest = latestRes.rows[0] as any;

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

            let clientId: number | null = null;

            // Auto-create or fetch client profile
            const clientRes = await tx.execute(sql`
                SELECT id FROM clients 
                WHERE name = ${client_name} AND (phone = ${client_phone || ''} OR (phone = '' AND ${client_phone || ''} = ''))
                LIMIT 1
            `);
            const existingClient = clientRes.rows[0] as any;

            if (existingClient) {
                clientId = existingClient.id;
            } else {
                const cInfo = await tx.insert(clients).values({
                    name: client_name,
                    phone: client_phone || '',
                    address: client_address || '',
                    state: client_state || '',
                    city: client_city || ''
                }).returning({ id: clients.id });
                clientId = cInfo[0].id;
            }

            const qInfo = await tx.insert(quotations).values({
                quoteNumber: quote_number,
                subsidiaryName: subsidiary_name || 'LATUNS ROOFING SYSTEM',
                agentId: agent_id || null,
                clientId: clientId,
                clientName: client_name,
                clientPhone: client_phone || '',
                clientAddress: client_address || '',
                clientState: client_state || '',
                clientCity: client_city || '',
                projectType: project_type || '',
                sundries: String(sundries || ''),
                transportation: Number(transportation || 0),
                status: 'pending',
                docType: doc_type || 'quotation',
                discountValue: Number(discount_value || 0),
                linkedQuotations: linked_quotations ? JSON.stringify(linked_quotations) : null,
                headerNote: header_note || null,
                projectScope: project_scope || null,
                discountStatement: discount_statement || null
            }).returning({ id: quotations.id });
            
            quotationId = qInfo[0].id;

            const itemsToInsert = items.map((item: any) => {
                if (!item.description || !item.qty || !item.unit || !item.unit_cost) {
                    throw new Error('Invalid item data');
                }
                return {
                    quotationId: quotationId,
                    description: item.description,
                    qty: Number(item.qty),
                    unit: item.unit,
                    unitCost: Number(item.unit_cost),
                    total: Number(item.total)
                };
            });

            await tx.insert(quotationItems).values(itemsToInsert);

            // Log Activity
            if (clientId) {
                const actionDesc = is_composite ? `Generated ${doc_type === 'project_scope' ? 'Project Scope' : 'Discount Statement'} (${quote_number})` : `Created Quotation (${quote_number})`;
                await tx.insert(activityLogs).values({
                    clientId: clientId,
                    actionType: 'created_document',
                    description: actionDesc,
                    refId: quotationId
                });
                await tx.update(clients).set({ updatedAt: new Date() }).where(eq(clients.id, clientId));
            }

            // Audit Log
            const session = await getSession();
            if (session) {
                await logAudit(session.user.id, session.user.username, 'Create', 'Quotations', `Created ${doc_type || 'quotation'} ${quote_number}`, 'quotation', quotationId);
            }
        });

        return NextResponse.json({ id: Number(quotationId), success: true }, { status: 201 });
    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message || 'Failed to create quotation' }, { status: 500 });
    }
}
