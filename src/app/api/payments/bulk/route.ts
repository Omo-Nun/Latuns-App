import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { clientId, date, allocations } = body;

        if (!allocations || !Array.isArray(allocations)) {
            return NextResponse.json({ error: 'Invalid allocations' }, { status: 400 });
        }

        db.exec('BEGIN TRANSACTION');
        try {
            const pStmt = db.prepare(`
                INSERT INTO payments (quotation_id, amount, date, note)
                VALUES (?, ?, ?, ?)
            `);

            let totalSum = 0;
            const refIds: number[] = [];

            for (const alloc of allocations) {
                const amount = parseFloat(alloc.amount);
                if (isNaN(amount) || amount <= 0) continue;
                
                pStmt.run(alloc.quotationId, amount, date || new Date().toISOString(), alloc.note || 'Bulk Payment Allocation');
                totalSum += amount;
                refIds.push(alloc.quotationId);
            }

            // Log Activity for Client if possible
            if (clientId) {
                db.prepare(`
                    INSERT INTO activity_logs (client_id, action_type, description)
                    VALUES (?, 'payment_received', ?)
                `).run(
                    clientId, 
                    `Recorded Bulk Payment of ₦${totalSum.toLocaleString()} allocated across ${refIds.length} projects.`
                );
                db.prepare('UPDATE clients SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(clientId);
            }

            db.exec('COMMIT');
            return NextResponse.json({ success: true, total: totalSum });
        } catch (e) {
            db.exec('ROLLBACK');
            throw e;
        }
    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message || 'Failed to process bulk payment' }, { status: 500 });
    }
}
