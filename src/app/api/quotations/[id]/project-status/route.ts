import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { quotations, activityLogs, clients } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const id = Number(resolvedParams.id);
        const body = await request.json();
        const { project_status } = body;

        if (!project_status) {
            return NextResponse.json({ error: 'project_status is required' }, { status: 400 });
        }

        await db.transaction(async (tx) => {
            await tx.update(quotations).set({ projectStatus: project_status }).where(eq(quotations.id, id));

            // Log Activity & touch client updated_at
            const quoteRes = await tx.select({ 
                clientId: quotations.clientId, 
                quoteNumber: quotations.quoteNumber, 
                docType: quotations.docType, 
                linkedQuotations: quotations.linkedQuotations 
            }).from(quotations).where(eq(quotations.id, id)).limit(1);
            
            const quote = quoteRes[0];
            
            if (quote && quote.clientId) {
                await tx.insert(activityLogs).values({
                    clientId: quote.clientId,
                    actionType: 'status_change',
                    description: `Updated status to "${project_status}" for ${quote.quoteNumber || 'Quote'}`,
                    refId: id
                });
                await tx.update(clients).set({ updatedAt: new Date() }).where(eq(clients.id, quote.clientId));
            }

            // Cascade status to child quotations if this is a parent composite document
            // Goes 2 levels deep: discount_statement → project_scope → children
            if (quote && (quote.docType === 'project_scope' || quote.docType === 'discount_statement') && quote.linkedQuotations) {
                try {
                    const level1Ids: number[] = JSON.parse(quote.linkedQuotations);

                    for (const childId of level1Ids) {
                        await tx.update(quotations).set({ projectStatus: project_status }).where(eq(quotations.id, childId));

                        const childQuoteRes = await tx.select({ 
                            clientId: quotations.clientId, 
                            quoteNumber: quotations.quoteNumber, 
                            docType: quotations.docType, 
                            linkedQuotations: quotations.linkedQuotations 
                        }).from(quotations).where(eq(quotations.id, childId)).limit(1);
                        
                        const childQuote = childQuoteRes[0];
                        if (childQuote) {
                            // Log activity for this child
                            if (childQuote.clientId) {
                                await tx.insert(activityLogs).values({
                                    clientId: childQuote.clientId,
                                    actionType: 'status_change',
                                    description: `Status cascaded to "${project_status}" from parent document ${quote.quoteNumber || `#${id}`}`,
                                    refId: childId
                                });
                                await tx.update(clients).set({ updatedAt: new Date() }).where(eq(clients.id, childQuote.clientId));
                            }

                            // Level 2: if this child is itself a project_scope, cascade to its children too
                            if ((childQuote.docType === 'project_scope' || childQuote.docType === 'discount_statement') && childQuote.linkedQuotations) {
                                try {
                                    const level2Ids: number[] = JSON.parse(childQuote.linkedQuotations);
                                    for (const grandChildId of level2Ids) {
                                        await tx.update(quotations).set({ projectStatus: project_status }).where(eq(quotations.id, grandChildId));
                                        
                                        const gcQuoteRes = await tx.select({ 
                                            clientId: quotations.clientId, 
                                            quoteNumber: quotations.quoteNumber 
                                        }).from(quotations).where(eq(quotations.id, grandChildId)).limit(1);
                                        
                                        const gcQuote = gcQuoteRes[0];
                                        if (gcQuote && gcQuote.clientId) {
                                            await tx.insert(activityLogs).values({
                                                clientId: gcQuote.clientId,
                                                actionType: 'status_change',
                                                description: `Status cascaded to "${project_status}" from ${quote.quoteNumber || 'parent document'}`,
                                                refId: grandChildId
                                            });
                                            await tx.update(clients).set({ updatedAt: new Date() }).where(eq(clients.id, gcQuote.clientId));
                                        }
                                    }
                                } catch (e) {
                                    console.error('Failed to cascade to grandchildren:', e);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error('Failed to cascade status to children:', e);
                }
            }
        });

        return NextResponse.json({ success: true, project_status });
    } catch (error) {
        console.error('Failed to update project status:', error);
        return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
    }
}
