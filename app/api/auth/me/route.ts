import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/session';

export async function GET() {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { displayName, email } = await request.json();

    const updates: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date()
    };

    if (displayName !== undefined) {
      updates.displayName = displayName;
    }

    if (email !== undefined) {
      // Check if email is already taken
      const existingEmail = await db.query.users.findFirst({
        where: eq(users.email, email)
      });

      if (existingEmail && existingEmail.id !== session.userId) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
      }

      updates.email = email;
    }

    await db.update(users)
      .set(updates)
      .where(eq(users.id, session.userId));

    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatarUrl: true
      }
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
