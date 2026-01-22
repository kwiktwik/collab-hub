import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { boardGroups, boards, groupMembers, groups } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { createNotification } from '@/lib/notifications';

// Helper to check board access
async function checkBoardAccess(boardId: string, userId: string, requiredLevel: 'read' | 'write' | 'admin' = 'read') {
  const board = await db.query.boards.findFirst({
    where: eq(boards.id, boardId)
  });

  if (!board) return { hasAccess: false, board: null, permission: null };

  if (board.createdBy === userId) {
    return { hasAccess: true, board, permission: 'admin' as const };
  }

  const userGroups = await db.query.groupMembers.findMany({
    where: eq(groupMembers.userId, userId),
    columns: { groupId: true }
  });

  const groupIds = userGroups.map(g => g.groupId);
  if (groupIds.length === 0) return { hasAccess: false, board, permission: null };

  const boardAccess = await db.query.boardGroups.findMany({
    where: eq(boardGroups.boardId, boardId)
  });

  const userBoardAccess = boardAccess.filter(ba => groupIds.includes(ba.groupId));
  if (userBoardAccess.length === 0) return { hasAccess: false, board, permission: null };

  const permOrder = { read: 0, write: 1, admin: 2 };
  let highestPerm: 'read' | 'write' | 'admin' = 'read';
  for (const access of userBoardAccess) {
    if (permOrder[access.permissionLevel] > permOrder[highestPerm]) {
      highestPerm = access.permissionLevel;
    }
  }

  return { hasAccess: permOrder[highestPerm] >= permOrder[requiredLevel], board, permission: highestPerm };
}

// PUT - Update group permission level
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; groupId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { boardId, groupId } = await params;
    const { hasAccess, board } = await checkBoardAccess(boardId, session.userId, 'admin');

    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { permissionLevel } = await request.json();

    if (!['read', 'write', 'admin'].includes(permissionLevel)) {
      return NextResponse.json({ error: 'Invalid permission level' }, { status: 400 });
    }

    const existing = await db.query.boardGroups.findFirst({
      where: and(
        eq(boardGroups.boardId, boardId),
        eq(boardGroups.groupId, groupId)
      )
    });

    if (!existing) {
      return NextResponse.json({ error: 'Group access not found' }, { status: 404 });
    }

    await db.update(boardGroups)
      .set({ permissionLevel })
      .where(and(
        eq(boardGroups.boardId, boardId),
        eq(boardGroups.groupId, groupId)
      ));

    // Get group info for notification
    const group = await db.query.groups.findFirst({
      where: eq(groups.id, groupId),
      with: { members: true }
    });

    // Notify group members
    if (group) {
      for (const member of group.members) {
        await createNotification({
          userId: member.userId,
          type: 'board',
          title: 'Board Permission Updated',
          message: `Your group "${group.name}" now has ${permissionLevel} access to the board "${board?.name}".`,
          link: `/boards/${boardId}`
        });
      }
    }

    return NextResponse.json({ message: 'Permission level updated successfully' });
  } catch (error) {
    console.error('Update board group error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove group access
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; groupId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { boardId, groupId } = await params;
    const { hasAccess, board } = await checkBoardAccess(boardId, session.userId, 'admin');

    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const existing = await db.query.boardGroups.findFirst({
      where: and(
        eq(boardGroups.boardId, boardId),
        eq(boardGroups.groupId, groupId)
      )
    });

    if (!existing) {
      return NextResponse.json({ error: 'Group access not found' }, { status: 404 });
    }

    // Get group info for notification
    const group = await db.query.groups.findFirst({
      where: eq(groups.id, groupId),
      with: { members: true }
    });

    await db.delete(boardGroups)
      .where(and(
        eq(boardGroups.boardId, boardId),
        eq(boardGroups.groupId, groupId)
      ));

    // Notify group members
    if (group) {
      for (const member of group.members) {
        await createNotification({
          userId: member.userId,
          type: 'board',
          title: 'Board Access Removed',
          message: `Your group "${group.name}" no longer has access to the board "${board?.name}".`,
        });
      }
    }

    return NextResponse.json({ message: 'Group access removed successfully' });
  } catch (error) {
    console.error('Remove board group error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
