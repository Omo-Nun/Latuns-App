import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const body = await request.json();
        const { project_status } = body;

        if (!project_status) {
            return NextResponse.json({ error: 'project_status is required' }, { status: 400 });
        }

        const stmt = db.prepare('UPDATE quotations SET project_status = ? WHERE id = ?');
        stmt.run(project_status, resolvedParams.id);

        // Log Activity & touch client updated_at
        const quote = db.prepare('SELECT client_id, quote_number, doc_type, linked_quotations FROM quotations WHERE id = ?').get(resolvedParams.id) as any;
        if (quote && quote.client_id) {
            db.prepare(`
                INSERT INTO activity_logs (client_id, action_type, description, ref_id)
                VALUES (?, ?, ?, ?)
            `).run(quote.client_id, 'status_change', `Updated status to "${project_status}" for ${quote.quote_number || 'Quote'}`, resolvedParams.id);
            db.prepare('UPDATE clients SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(quote.client_id);
        }

        // Cascade status to child quotations if this is a parent composite document
        // Goes 2 levels deep: discount_statement → project_scope → children
        if (quote && (quote.doc_type === 'project_scope' || quote.doc_type === 'discount_statement') && quote.linked_quotations) {
            try {
                const level1Ids: number[] = JSON.parse(quote.linked_quotations);
                const updateChildStmt = db.prepare('UPDATE quotations SET project_status = ? WHERE id = ?');

                for (const childId of level1Ids) {
                    updateChildStmt.run(project_status, childId);

                    const childQuote = db.prepare('SELECT client_id, quote_number, doc_type, linked_quotations FROM quotations WHERE id = ?').get(childId) as any;
                    if (childQuote) {
                        // Log activity for this child
                        if (childQuote.client_id) {
                            db.prepare(`
                                INSERT INTO activity_logs (client_id, action_type, description, ref_id)
                                VALUES (?, ?, ?, ?)
                            `).run(childQuote.client_id, 'status_change', `Status cascaded to "${project_status}" from parent document ${quote.quote_number || `#${resolvedParams.id}`}`, childId);
                            db.prepare('UPDATE clients SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(childQuote.client_id);
                        }

                        // Level 2: if this child is itself a project_scope, cascade to its children too
                        if ((childQuote.doc_type === 'project_scope' || childQuote.doc_type === 'discount_statement') && childQuote.linked_quotations) {
                            try {
                                const level2Ids: number[] = JSON.parse(childQuote.linked_quotations);
                                for (const grandChildId of level2Ids) {
                                    updateChildStmt.run(project_status, grandChildId);
                                    const gcQuote = db.prepare('SELECT client_id, quote_number FROM quotations WHERE id = ?').get(grandChildId) as any;
                                    if (gcQuote && gcQuote.client_id) {
                                        db.prepare(`
                                            INSERT INTO activity_logs (client_id, action_type, description, ref_id)
                                            VALUES (?, ?, ?, ?)
                                        `).run(gcQuote.client_id, 'status_change', `Status cascaded to "${project_status}" from ${quote.quote_number || 'parent document'}`, grandChildId);
                                        db.prepare('UPDATE clients SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(gcQuote.client_id);
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

        return NextResponse.json({ success: true, project_status });
    } catch (error) {
        console.error('Failed to update project status:', error);
        return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
    }
}
