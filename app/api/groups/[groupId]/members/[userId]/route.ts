import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { groupMembers, groups } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { notifyGroupRoleChanged, notifyRemovedFromGroup } from '@/lib/notifications';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; userId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { groupId, userId } = await params;
    const { role } = await request.json();

    if (!['admin', 'member'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

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

    // Prevent removing last admin
    if (role === 'member') {
      const adminCount = await db.query.groupMembers.findMany({
        where: and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.role, 'admin')
        )
      });

      if (adminCount.length === 1 && adminCount[0].userId === userId) {
        return NextResponse.json({ error: 'Cannot remove the last admin' }, { status: 400 });
      }
    }

    await db.update(groupMembers)
      .set({ role })
      .where(and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId)
      ));

    // Get group name and notify user
    const group = await db.query.groups.findFirst({
      where: eq(groups.id, groupId),
      columns: { name: true }
    });

    // Notify the user of role change (unless they changed their own role)
    if (userId !== session.userId) {
      await notifyGroupRoleChanged(userId, group?.name || 'a group', groupId, role);
    }

    return NextResponse.json({ message: 'Member role updated' });
  } catch (error) {
    console.error('Update member error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; userId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { groupId, userId } = await params;

    // Check if requester is admin or removing themselves
    const membership = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, session.userId)
      )
    });

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (membership.role !== 'admin' && userId !== session.userId) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Prevent removing last admin
    const targetMembership = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId)
      )
    });

    if (targetMembership?.role === 'admin') {
      const adminCount = await db.query.groupMembers.findMany({
        where: and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.role, 'admin')
        )
      });

      if (adminCount.length === 1) {
        return NextResponse.json({ error: 'Cannot remove the last admin' }, { status: 400 });
      }
    }

    // Get group name before deletion
    const group = await db.query.groups.findFirst({
      where: eq(groups.id, groupId),
      columns: { name: true }
    });

    await db.delete(groupMembers)
      .where(and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId)
      ));

    // Notify the user of removal (unless they removed themselves)
    if (userId !== session.userId) {
      await notifyRemovedFromGroup(userId, group?.name || 'a group');
    }

    return NextResponse.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
