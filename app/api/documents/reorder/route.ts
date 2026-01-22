import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { checkProjectAccess } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { projectId, orders } = await request.json();

    if (!projectId || !orders || !Array.isArray(orders)) {
      return NextResponse.json({ error: 'Project ID and orders array required' }, { status: 400 });
    }

    const hasAccess = await checkProjectAccess(session.userId, projectId, 'write');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Write access required' }, { status: 403 });
    }

    // Update each document's sort order
    for (const order of orders) {
      await db.update(documents)
        .set({ sortOrder: order.sortOrder, parentId: order.parentId || null })
        .where(eq(documents.id, order.id));
    }

    return NextResponse.json({ message: 'Documents reordered successfully' });
  } catch (error) {
    console.error('Reorder documents error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
