import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { quotations, quotationItems, activityLogs, clients } from '@/lib/schema';
import { eq, like, sql } from 'drizzle-orm';

export async function POST(request: Request) {
    try {
        const data = await request.json();
        const { source_id } = data;

        if (!source_id) {
            return NextResponse.json({ error: 'Source ID is required' }, { status: 400 });
        }

        const sourceQuoteRes = await db.select().from(quotations).where(eq(quotations.id, Number(source_id))).limit(1);
        const sourceQuote = sourceQuoteRes[0];
        if (!sourceQuote) {
            return NextResponse.json({ error: 'Source quotation not found' }, { status: 404 });
        }

        const sourceItems = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, Number(source_id)));

        // Generate Invoice Number in format: L-26APR-INV-001
        const now = new Date();
        const yy = now.getFullYear().toString().slice(-2);
        const mmm = now.toLocaleString('en-US', { month: 'short' }).toUpperCase();
        const prefix = `L-${yy}${mmm}-INV-`;

        let invNumber = '';
        let newId = 0;

        await db.transaction(async (tx) => {
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
            invNumber = `${prefix}${String(serial).padStart(3, '0')}`;

            const insertResult = await tx.insert(quotations).values({
                quoteNumber: invNumber,
                subsidiaryName: sourceQuote.subsidiaryName,
                clientName: sourceQuote.clientName,
                clientPhone: sourceQuote.clientPhone,
                clientAddress: sourceQuote.clientAddress,
                clientState: sourceQuote.clientState,
                clientCity: sourceQuote.clientCity,
                projectType: sourceQuote.projectType,
                agentId: sourceQuote.agentId,
                clientId: sourceQuote.clientId,
                sundries: sourceQuote.sundries,
                transportation: sourceQuote.transportation,
                status: 'pending',
                visitStatus: sourceQuote.visitStatus,
                projectStatus: 'Pending', // Reset Project Status for the Invoice Lifecycle
                docType: 'invoice',
                discountValue: sourceQuote.discountValue,
                linkedQuotations: sourceQuote.linkedQuotations
            }).returning({ id: quotations.id });

            newId = insertResult[0].id;

            if (sourceItems.length > 0) {
                const itemsToInsert = sourceItems.map(item => ({
                    quotationId: newId,
                    description: item.description,
                    qty: item.qty,
                    unit: item.unit,
                    unitCost: item.unitCost,
                    total: item.total
                }));
                await tx.insert(quotationItems).values(itemsToInsert);
            }

            // Log Activity
            if (sourceQuote.clientId) {
                await tx.insert(activityLogs).values({
                    clientId: sourceQuote.clientId,
                    actionType: 'created_document',
                    description: `Generated Official Tax Invoice (${invNumber}) from ${sourceQuote.quoteNumber || 'Quote'}`,
                    refId: newId
                });
                await tx.update(clients).set({ updatedAt: new Date() }).where(eq(clients.id, sourceQuote.clientId));
            }
        });

        return NextResponse.json({ id: newId, quote_number: invNumber }, { status: 201 });
    } catch (error) {
        console.error('Invoice generation error:', error);
        return NextResponse.json({ error: 'Failed to convert to invoice' }, { status: 500 });
    }
}
