import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const NIGERIAN_STATES = [
    "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
    "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe",
    "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara",
    "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau",
    "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"
];

export async function GET() {
    try {
        // Fetch usage counts from database
        const usageCountsRes = await db.execute(sql.raw(`
            SELECT state, COUNT(*) as count 
            FROM clients 
            WHERE state IS NOT NULL AND state != ''
            GROUP BY state
        `));
        const usageCounts = usageCountsRes.rows as { state: string, count: number }[];

        const usageMap = new Map(usageCounts.map(u => [u.state.toLowerCase(), Number(u.count)]));

        // Sort all states by frequency, then alphabetically
        const sortedStates = [...NIGERIAN_STATES].sort((a, b) => {
            const countA = usageMap.get(a.toLowerCase()) || 0;
            const countB = usageMap.get(b.toLowerCase()) || 0;

            if (countA !== countB) {
                return countB - countA; // Higher frequency first
            }
            return a.localeCompare(b); // Alphabetical secondary
        });

        return NextResponse.json(sortedStates);
    } catch (error) {
        // Fallback to alphabetical if DB fails
        return NextResponse.json(NIGERIAN_STATES.sort());
    }
}
