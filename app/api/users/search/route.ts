import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { like, or } from 'drizzle-orm';
import { getSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q || q.length < 2) {
      return NextResponse.json({ error: 'Search query must be at least 2 characters' }, { status: 400 });
    }

    const searchPattern = `%${q}%`;

    const results = await db.query.users.findMany({
      where: or(
        like(users.username, searchPattern),
        like(users.email, searchPattern),
        like(users.displayName, searchPattern)
      ),
      columns: {
        id: true,
        username: true,
        displayName: true,
        email: true
      },
      limit: 20
    });

    return NextResponse.json({ users: results });
  } catch (error) {
    console.error('Search users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
