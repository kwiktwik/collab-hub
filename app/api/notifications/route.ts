import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { getSession } from '@/lib/session';

// GET user's notifications
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');

    let whereClause = eq(notifications.userId, session.userId);
    if (unreadOnly) {
      whereClause = and(
        eq(notifications.userId, session.userId),
        eq(notifications.isRead, false)
      ) as any;
    }

    const userNotifications = await db.query.notifications.findMany({
      where: whereClause,
      orderBy: desc(notifications.createdAt),
      limit
    });

    // Get unread count
    const unreadNotifications = await db.query.notifications.findMany({
      where: and(
        eq(notifications.userId, session.userId),
        eq(notifications.isRead, false)
      )
    });

    return NextResponse.json({ 
      notifications: userNotifications,
      unreadCount: unreadNotifications.length
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Mark all as read
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { action } = await request.json();

    if (action === 'mark_all_read') {
      await db.update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.userId, session.userId));

      return NextResponse.json({ message: 'All notifications marked as read' });
    }

    if (action === 'clear_all') {
      await db.delete(notifications)
        .where(eq(notifications.userId, session.userId));

      return NextResponse.json({ message: 'All notifications cleared' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Update notifications error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
