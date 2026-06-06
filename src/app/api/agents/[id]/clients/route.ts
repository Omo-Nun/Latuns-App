import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await props.params;

        // Fetch the agent details
        const agentStmt = db.prepare('SELECT id, name, phone FROM agents WHERE id = ?');
        const agent = agentStmt.get(Number(id));

        if (!agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        // Fetch distinct clients associated with this agent through their quotations
        // Grouping by client_id to avoid duplicate client entries if they have multiple quotes
        const clientsStmt = db.prepare(`
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
            WHERE q.agent_id = ?
            GROUP BY c.id
            ORDER BY total_value DESC, total_quotes DESC
        `);

        const clients = clientsStmt.all(Number(id));

        return NextResponse.json({ agent, clients });
    } catch (error) {
        console.error('Failed to fetch agent clients:', error);
        return NextResponse.json({ error: 'Failed to fetch agent clients' }, { status: 500 });
    }
}
