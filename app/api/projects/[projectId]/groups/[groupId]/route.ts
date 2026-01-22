import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projectGroups } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { checkProjectAccess } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; groupId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { projectId, groupId } = await params;
    const { permissionLevel } = await request.json();

    if (!['read', 'write', 'admin'].includes(permissionLevel)) {
      return NextResponse.json({ error: 'Invalid permission level' }, { status: 400 });
    }

    const hasAccess = await checkProjectAccess(session.userId, projectId, 'admin');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    await db.update(projectGroups)
      .set({ permissionLevel })
      .where(and(
        eq(projectGroups.projectId, projectId),
        eq(projectGroups.groupId, groupId)
      ));

    return NextResponse.json({ message: 'Permission updated' });
  } catch (error) {
    console.error('Update permission error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; groupId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { projectId, groupId } = await params;

    const hasAccess = await checkProjectAccess(session.userId, projectId, 'admin');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Prevent removing last admin group
    const adminGroups = await db.query.projectGroups.findMany({
      where: and(
        eq(projectGroups.projectId, projectId),
        eq(projectGroups.permissionLevel, 'admin')
      )
    });

    if (adminGroups.length === 1 && adminGroups[0].groupId === groupId) {
      return NextResponse.json({ error: 'Cannot remove the last admin group' }, { status: 400 });
    }

    await db.delete(projectGroups)
      .where(and(
        eq(projectGroups.projectId, projectId),
        eq(projectGroups.groupId, groupId)
      ));

    return NextResponse.json({ message: 'Group access removed' });
  } catch (error) {
    console.error('Remove group access error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
