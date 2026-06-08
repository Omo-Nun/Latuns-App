import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { companyAssets } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: idStr } = await params;
        const id = Number(idStr);
        const data = await request.json();
        const { name, description, classification, image_url, purchase_date, purchase_cost, current_value, status } = data;

        if (!name) {
            return NextResponse.json({ error: 'Asset name is required' }, { status: 400 });
        }

        const result = await db.update(companyAssets).set({
            name,
            description: description || '',
            classification: classification || '',
            imageUrl: image_url || null,
            purchaseDate: purchase_date ? new Date(purchase_date) : null,
            purchaseCost: purchase_cost || 0,
            currentValue: current_value || 0,
            status: status || 'Active'
        }).where(eq(companyAssets.id, id)).returning({ id: companyAssets.id });

        if (result.length === 0) {
            return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Failed to update asset' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: idStr } = await params;
        const id = Number(idStr);

        const result = await db.delete(companyAssets).where(eq(companyAssets.id, id)).returning({ id: companyAssets.id });

        if (result.length === 0) {
            return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete asset' }, { status: 500 });
    }
}
