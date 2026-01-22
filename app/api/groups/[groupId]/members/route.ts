import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { groupMembers, users, groups } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { notifyAddedToGroup } from '@/lib/notifications';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { groupId } = await params;
    const { userId, username, role = 'member' } = await request.json();

    // Check if requester is admin
    const membership = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, session.userId),
        eq(groupMembers.role, 'admin')
      )
    });

    if (!membership) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Find user to add
    let targetUser;
    if (userId) {
      targetUser = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });
    } else if (username) {
      targetUser = await db.query.users.findFirst({
        where: eq(users.username, username)
      });
    }

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if already a member
    const existingMembership = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, targetUser.id)
      )
    });

    if (existingMembership) {
      return NextResponse.json({ error: 'User is already a member' }, { status: 400 });
    }

    // Add member
    await db.insert(groupMembers).values({
      id: uuidv4(),
      groupId,
      userId: targetUser.id,
      role: role as 'admin' | 'member'
    });

    // Get group name for notification
    const group = await db.query.groups.findFirst({
      where: eq(groups.id, groupId),
      columns: { name: true }
    });

    // Notify the user they were added
    await notifyAddedToGroup(targetUser.id, group?.name || 'a group', groupId, role);

    return NextResponse.json({ 
      message: 'Member added successfully',
      member: {
        userId: targetUser.id,
        username: targetUser.username,
        displayName: targetUser.displayName,
        role
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Add member error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
