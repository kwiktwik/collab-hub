import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { projectGroups, groupMembers, groups } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { checkProjectAccess } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { projectId } = await params;
    const { groupId, permissionLevel = 'read' } = await request.json();

    if (!groupId) {
      return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
    }

    const hasAccess = await checkProjectAccess(session.userId, projectId, 'admin');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Check if user has access to the group they're sharing with
    const groupMembership = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, session.userId)
      )
    });

    if (!groupMembership) {
      return NextResponse.json({ error: 'You must be a member of the group to share with it' }, { status: 403 });
    }

    // Check if already shared
    const existingShare = await db.query.projectGroups.findFirst({
      where: and(
        eq(projectGroups.projectId, projectId),
        eq(projectGroups.groupId, groupId)
      )
    });

    if (existingShare) {
      // Update existing share
      await db.update(projectGroups)
        .set({ permissionLevel })
        .where(eq(projectGroups.id, existingShare.id));
    } else {
      // Create new share
      await db.insert(projectGroups).values({
        id: uuidv4(),
        projectId,
        groupId,
        permissionLevel
      });
    }

    const group = await db.query.groups.findFirst({
      where: eq(groups.id, groupId),
      columns: { id: true, name: true }
    });

    return NextResponse.json({
      message: 'Project shared successfully',
      share: {
        group,
        permissionLevel
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Share project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
