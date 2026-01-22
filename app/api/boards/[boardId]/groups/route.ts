import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { boardGroups, boards, groupMembers, groups } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { notifyAddedToGroup, createNotification } from '@/lib/notifications';

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

// GET - Get all groups with access to this board
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { boardId } = await params;
    const { hasAccess } = await checkBoardAccess(boardId, session.userId);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const groupAccess = await db.query.boardGroups.findMany({
      where: eq(boardGroups.boardId, boardId),
      with: {
        group: {
          columns: { id: true, name: true, description: true }
        }
      }
    });

    return NextResponse.json({ groups: groupAccess });
  } catch (error) {
    console.error('Get board groups error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Add a group to the board
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { boardId } = await params;
    const { hasAccess, board } = await checkBoardAccess(boardId, session.userId, 'admin');

    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { groupId, permissionLevel = 'read' } = await request.json();

    if (!groupId) {
      return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
    }

    // Check if group exists
    const group = await db.query.groups.findFirst({
      where: eq(groups.id, groupId),
      with: {
        members: true
      }
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Check if already added
    const existing = await db.query.boardGroups.findFirst({
      where: and(
        eq(boardGroups.boardId, boardId),
        eq(boardGroups.groupId, groupId)
      )
    });

    if (existing) {
      return NextResponse.json({ error: 'Group already has access to this board' }, { status: 400 });
    }

    // Add group access
    await db.insert(boardGroups).values({
      id: uuidv4(),
      boardId,
      groupId,
      permissionLevel
    });

    // Notify all group members
    for (const member of group.members) {
      await createNotification({
        userId: member.userId,
        type: 'board',
        title: 'Board Access Granted',
        message: `Your group "${group.name}" now has ${permissionLevel} access to the board "${board?.name}".`,
        link: `/boards/${boardId}`
      });
    }

    const newAccess = await db.query.boardGroups.findFirst({
      where: and(
        eq(boardGroups.boardId, boardId),
        eq(boardGroups.groupId, groupId)
      ),
      with: {
        group: {
          columns: { id: true, name: true }
        }
      }
    });

    return NextResponse.json({ 
      message: 'Group added to board successfully',
      groupAccess: newAccess 
    }, { status: 201 });
  } catch (error) {
    console.error('Add board group error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
