import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { quotations, clients } from '@/lib/schema';
import { eq, isNull, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Fetch quotations that don't have a structured client_id
        const unlinkedRes = await db.execute(sql.raw(`
            SELECT id, quote_number, client_name, client_phone, created_at, project_type 
            FROM quotations 
            WHERE client_id IS NULL
            ORDER BY client_name ASC
        `));
        const unlinked = unlinkedRes.rows;

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

        let clientIdOut: number | null = null;

        await db.transaction(async (tx) => {
            // First, check if this EXACT client already exists natively
            const safePhone = client_phone || '';
            const existingRes = await tx.execute(sql`
                SELECT id FROM clients 
                WHERE name = ${client_name} AND (phone = ${safePhone} OR (phone = '' AND ${safePhone} = '')) 
                LIMIT 1
            `);
            const existing = existingRes.rows[0];

            let clientId: number;
            if (existing) {
                clientId = Number(existing.id);
            } else {
                const cStmt = await tx.insert(clients).values({
                    name: client_name,
                    phone: safePhone
                }).returning({ id: clients.id });
                clientId = cStmt[0].id;
            }

            clientIdOut = clientId;

            // Map all target quotations to this centralized Profile
            for (const qId of quotation_ids) {
                await tx.update(quotations).set({ clientId: clientId }).where(eq(quotations.id, Number(qId)));
            }
        });

        return NextResponse.json({ success: true, client_id: clientIdOut });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to merge quotations' }, { status: 500 });
    }
}
