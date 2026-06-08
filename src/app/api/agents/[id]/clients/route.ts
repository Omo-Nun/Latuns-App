import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { agents, clients, quotations, quotationItems } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';

export async function GET(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await props.params;

        // Fetch the agent details
        const agentRes = await db.select({
            id: agents.id,
            name: agents.name,
            phone: agents.phone,
        }).from(agents).where(eq(agents.id, Number(id))).limit(1);
        const agent = agentRes[0];

        if (!agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        // Fetch distinct clients associated with this agent through their quotations
        // Grouping by client_id to avoid duplicate client entries if they have multiple quotes
        const result = await db.execute(sql`
            SELECT 
                c.id, 
                c.name, 
                c.phone, 
                c.address,
                c.state,
                c.city,
                COUNT(q.id) as total_quotes,
                COALESCE(SUM(qi_totals.subtotal), 0) as total_value
            FROM clients c
            JOIN quotations q ON c.id = q.client_id
            LEFT JOIN (
                SELECT quotation_id, COALESCE(SUM(total), 0) as subtotal
                FROM quotation_items
                GROUP BY quotation_id
            ) qi_totals ON q.id = qi_totals.quotation_id
            WHERE q.agent_id = ${Number(id)}
            GROUP BY c.id
            ORDER BY total_value DESC, total_quotes DESC
        `);

        return NextResponse.json({ agent, clients: result.rows });
    } catch (error) {
        console.error('Failed to fetch agent clients:', error);
        return NextResponse.json({ error: 'Failed to fetch agent clients' }, { status: 500 });
    }
}
