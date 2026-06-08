import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { companyAssets } from '@/lib/schema';
import { desc } from 'drizzle-orm';
import { requirePermission } from '@/lib/auth';
import { toSnakeCase } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
    const error = await requirePermission('Inventory', 'can_view');
    if (error) return error;

    try {
        const assets = await db.select().from(companyAssets).orderBy(desc(companyAssets.createdAt));
        return NextResponse.json(toSnakeCase(assets));
    } catch (error) {
        console.error('Failed to fetch assets error:', error);
        return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const data = await request.json();
        const { name, description, classification, image_url, purchase_date, purchase_cost, current_value, status } = data;

        if (!name) {
            return NextResponse.json({ error: 'Asset name is required' }, { status: 400 });
        }

        const insertResult = await db.insert(companyAssets).values({
            name,
            description: description || '',
            classification: classification || '',
            imageUrl: image_url || null,
            purchaseDate: purchase_date ? new Date(purchase_date) : null,
            purchaseCost: Number(purchase_cost) || 0,
            currentValue: Number(current_value) || 0,
            status: status || 'Active'
        }).returning({ id: companyAssets.id });

        return NextResponse.json({ id: insertResult[0].id, success: true }, { status: 201 });
    } catch (error) {
        console.error('Failed to create asset error:', error);
        return NextResponse.json({ error: 'Failed to create asset' }, { status: 500 });
    }
}
