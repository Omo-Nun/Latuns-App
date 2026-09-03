import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePermission, getSession } from '@/lib/auth';
import { calcGrandTotal, round2 } from '@/lib/financeUtils';
import { logAudit } from '@/lib/audit';
import { quotations, agents, quotationItems, payments, stockRequests, clients } from '@/lib/schema';
import { eq, desc, like, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const error = await requirePermission('Quotations', 'can_view');
    if (error) return error;

    try {
        const { id: idStr } = await params;
        const id = Number(idStr);

        const qRes = await db.select({
            id: quotations.id,
            quoteNumber: quotations.quoteNumber,
            subsidiaryName: quotations.subsidiaryName,
            agentId: quotations.agentId,
            clientId: quotations.clientId,
            clientName: quotations.clientName,
            clientPhone: quotations.clientPhone,
            clientAddress: quotations.clientAddress,
            clientState: quotations.clientState,
            clientCity: quotations.clientCity,
            projectType: quotations.projectType,
            sundries: quotations.sundries,
            transportation: quotations.transportation,
            status: quotations.status,
            createdAt: quotations.createdAt,
            clientVisited: quotations.clientVisited,
            visitStatus: quotations.visitStatus,
            docType: quotations.docType,
            discountValue: quotations.discountValue,
            linkedQuotations: quotations.linkedQuotations,
            headerNote: quotations.headerNote,
            projectScope: quotations.projectScope,
            discountStatement: quotations.discountStatement,
            roof_estimator_name: agents.name
        })
        .from(quotations)
        .leftJoin(agents, eq(quotations.agentId, agents.id))
        .where(eq(quotations.id, id))
        .limit(1);

        const quotation = qRes[0];
        
        if (!quotation) {
            return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
        }

        const items = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, id));
        const paymentsList = await db.select().from(payments).where(eq(payments.quotationId, id)).orderBy(desc(payments.date));

        // Subtotal
        const subtotal = Math.round((items.reduce((acc: number, item: any) => acc + Number(item.total), 0) + Number.EPSILON) * 100) / 100;

        // Calculate total paid
        const total_paid = Math.round((paymentsList.reduce((acc: number, payment: any) => acc + Number(payment.amount), 0) + Number.EPSILON) * 100) / 100;

        // Sniff for Parent Document Hierarchy
        // We use like('%"id"%') or similar, since linkedQuotations is a JSON string array of IDs
        const parentDocRes = await db.select()
            .from(quotations)
            .where(sql`${quotations.docType} != 'quotation' AND ${quotations.linkedQuotations} LIKE ${'%' + id + '%'}`)
            .limit(1);
        const parentDoc = parentDocRes[0];
        
        let parent_ledger = null;

        if (parentDoc) {
            try {
                const linkedArray = parentDoc.linkedQuotations ? JSON.parse(parentDoc.linkedQuotations) : [];
                if (linkedArray.includes(id)) {
                    const parentItems = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, parentDoc.id));
                    const parentPayments = await db.select().from(payments).where(eq(payments.quotationId, parentDoc.id)).orderBy(desc(payments.date));
                    const parentSubtotal = Math.round((parentItems.reduce((acc: number, item: any) => acc + Number(item.total), 0) + Number.EPSILON) * 100) / 100;

                    const parentGrandTotal = calcGrandTotal({
                        subtotal: parentSubtotal,
                        sundries: parentDoc.sundries || '',
                        transportation: Number(parentDoc.transportation)
                    });
                    const parentTotalPaid = Math.round((parentPayments.reduce((acc: number, payment: any) => acc + Number(payment.amount), 0) + Number.EPSILON) * 100) / 100;

                    parent_ledger = {
                        id: parentDoc.id,
                        quote_number: parentDoc.quoteNumber,
                        doc_type: parentDoc.docType,
                        grandTotal: parentGrandTotal,
                        discount_value: parentDoc.discountValue,
                        total_paid: parentTotalPaid,
                        payments: parentPayments
                    };
                }
            } catch (e) {
                // Silently bypass faulty parse
            }
        }

        // Fetch the latest stock request for this quotation (to drive Request Stock button state)
        const latestStockRequestRes = await db.select({ id: stockRequests.id, status: stockRequests.status })
            .from(stockRequests)
            .where(eq(stockRequests.quotationId, id))
            .orderBy(desc(stockRequests.createdAt))
            .limit(1);
        const latestStockRequest = latestStockRequestRes[0];

        // Format to map snake_case response to match UI expectations
        const formattedQuotation = {
            id: quotation.id,
            quote_number: quotation.quoteNumber,
            subsidiary_name: quotation.subsidiaryName,
            agent_id: quotation.agentId,
            client_id: quotation.clientId,
            client_name: quotation.clientName,
            client_phone: quotation.clientPhone,
            client_address: quotation.clientAddress,
            client_state: quotation.clientState,
            client_city: quotation.clientCity,
            project_type: quotation.projectType,
            sundries: quotation.sundries,
            transportation: quotation.transportation,
            status: quotation.status,
            created_at: quotation.createdAt,
            client_visited: quotation.clientVisited,
            visit_status: quotation.visitStatus,
            doc_type: quotation.docType,
            discount_value: quotation.discountValue,
            linked_quotations: quotation.linkedQuotations,
            header_note: quotation.headerNote,
            project_scope: quotation.projectScope,
            discount_statement: quotation.discountStatement,
            roof_estimator_name: quotation.roof_estimator_name
        };

        const formattedItems = items.map(i => ({
            id: i.id,
            quotation_id: i.quotationId,
            description: i.description,
            qty: i.qty,
            unit: i.unit,
            unit_cost: i.unitCost,
            total: i.total
        }));

        return NextResponse.json({
            ...formattedQuotation,
            subtotal,
            total_paid,
            items: formattedItems,
            payments: paymentsList,
            parent_ledger,
            latest_stock_request: latestStockRequest || null
        });
    } catch (error) {
        console.error('Fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch quotation' }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const error = await requirePermission('Quotations', 'can_edit');
    if (error) return error;

    try {
        const { id: idStr } = await params;
        const id = Number(idStr);
        const data = await request.json();
        const { 
            status, sundries, transportation, client_name, client_phone, client_address, client_state, client_city, 
            project_type, subsidiary_name, agent_id, items, client_visited, visit_status, header_note,
            project_scope, discount_statement 
        } = data;

        await db.transaction(async (tx) => {
            const updates: any = {};

            if (status !== undefined) updates.status = status;
            if (sundries !== undefined) updates.sundries = String(sundries);
            if (transportation !== undefined) updates.transportation = String(Number(transportation));

            if (client_name !== undefined) {
                updates.clientName = client_name;

                // Find the current client_id for this quotation
                const currentQuotationRes = await tx.select({ clientId: quotations.clientId }).from(quotations).where(eq(quotations.id, id)).limit(1);
                let clientId = currentQuotationRes[0]?.clientId;

                if (clientId) {
                    // Update existing client record
                    await tx.update(clients).set({
                        name: client_name,
                        phone: client_phone || '',
                        address: client_address || '',
                        state: client_state || '',
                        city: client_city || '',
                        updatedAt: new Date()
                    }).where(eq(clients.id, Number(clientId)));
                } else {
                    // Try to find client by phone/name to avoid duplicates if quotation had no client_id
                    const existingClientRes = await tx.execute(sql`
                        SELECT id FROM clients 
                        WHERE name = ${client_name} AND (phone = ${client_phone || ''} OR (phone = '' AND ${client_phone || ''} = ''))
                        LIMIT 1
                    `);
                    const existingClient = existingClientRes.rows[0] as any;

                    if (existingClient) {
                        clientId = existingClient.id;
                        // Also update their details to match latest entry
                        await tx.update(clients).set({
                            address: client_address || '',
                            state: client_state || '',
                            city: client_city || '',
                            updatedAt: new Date()
                        }).where(eq(clients.id, Number(clientId)));
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
                    updates.clientId = clientId;
                }
            }

            if (client_phone !== undefined) updates.clientPhone = client_phone;
            if (client_address !== undefined) updates.clientAddress = client_address;
            if (client_state !== undefined) updates.clientState = client_state;
            if (client_city !== undefined) updates.clientCity = client_city;
            if (project_type !== undefined) updates.projectType = project_type;
            if (subsidiary_name !== undefined) updates.subsidiaryName = subsidiary_name;
            if (agent_id !== undefined) updates.agentId = agent_id;
            if (client_visited !== undefined) updates.clientVisited = client_visited ? true : false;
            if (visit_status !== undefined) updates.visitStatus = visit_status;
            if (header_note !== undefined) updates.headerNote = header_note;
            if (project_scope !== undefined) updates.projectScope = project_scope;
            if (discount_statement !== undefined) updates.discountStatement = discount_statement;

            if (Object.keys(updates).length > 0) {
                await tx.update(quotations).set(updates).where(eq(quotations.id, id));
            }

            // Update items if provided
            if (items && Array.isArray(items)) {
                // Delete old items
                await tx.delete(quotationItems).where(eq(quotationItems.quotationId, id));
                
                // Insert new items
                if (items.length > 0) {
                    const itemsToInsert = items.map((item: any) => {
                        if (!item.description || !item.qty || !item.unit || !item.unit_cost) {
                            throw new Error('Invalid item data');
                        }
                        const qty = Number(item.qty);
                        const unitCost = Number(item.unit_cost);
                        return {
                            quotationId: id,
                            description: item.description,
                            qty: String(qty),
                            unit: item.unit,
                            unitCost: String(unitCost),
                            total: String(round2(qty * unitCost))
                        };
                    });
                    await tx.insert(quotationItems).values(itemsToInsert);
                }
            }

            // Audit Log
            const session = await getSession();
            if (session) {
                const qRes = await tx.select({ quoteNumber: quotations.quoteNumber }).from(quotations).where(eq(quotations.id, id)).limit(1);
                const q = qRes[0];
                await logAudit(session.user.id, session.user.username, 'Update', 'Quotations', `Updated quotation ${q?.quoteNumber || id}`, 'quotation', id);
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Update error:', error);
        return NextResponse.json({ error: 'Failed to update quotation' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const error = await requirePermission('Quotations', 'can_delete');
    if (error) return error;

    try {
        const { id: idStr } = await params;
        const id = Number(idStr);
        const session = await getSession();

        const qRes = await db.select({ quoteNumber: quotations.quoteNumber }).from(quotations).where(eq(quotations.id, id)).limit(1);
        const q = qRes[0];

        // Because of ON DELETE CASCADE, deleting the quotation will delete items and payments
        // We will do it explicitly just to be safe if DB lacks constraints
        await db.transaction(async (tx) => {
            await tx.delete(quotationItems).where(eq(quotationItems.quotationId, id));
            await tx.delete(payments).where(eq(payments.quotationId, id));
            await tx.delete(quotations).where(eq(quotations.id, id));
        });

        if (session) {
            await logAudit(session.user.id, session.user.username, 'Delete', 'Quotations', `Deleted quotation ${q?.quoteNumber || id}`, 'quotation', id);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete error:', error);
        return NextResponse.json({ error: 'Failed to delete quotation' }, { status: 500 });
    }
}
