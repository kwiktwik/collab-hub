import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const { username, email, password, displayName } = await request.json();

    // Validation
    if (!username || !email || !password) {
      return NextResponse.json({ error: 'Username, email, and password are required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    if (username.length < 3) {
      return NextResponse.json({ error: 'Username must be at least 3 characters' }, { status: 400 });
    }

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.username, username.toLowerCase())
    });

    if (existingUser) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
    }

    const existingEmail = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase())
    });

    if (existingEmail) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user - no approval needed, users create their own organizations
    const userId = uuidv4();
    await db.insert(users).values({
      id: userId,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      passwordHash,
      displayName: displayName || username
    });

    // Auto-login
    const session = await getSession();
    session.userId = userId;
    await session.save();

    return NextResponse.json({
      message: 'Account created successfully! Create or join an organization to get started.',
      user: {
        id: userId,
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        displayName: displayName || username
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
