import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sprints, boards, groupMembers, boardGroups, tasks } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSession } from '@/lib/session';

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

// GET - Get sprint details with tasks
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; sprintId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { boardId, sprintId } = await params;
    const { hasAccess } = await checkBoardAccess(boardId, session.userId);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const sprint = await db.query.sprints.findFirst({
      where: and(
        eq(sprints.id, sprintId),
        eq(sprints.boardId, boardId)
      ),
      with: {
        creator: {
          columns: { id: true, username: true, displayName: true }
        },
        tasks: {
          with: {
            assignee: {
              columns: { id: true, username: true, displayName: true, avatarUrl: true }
            },
            column: {
              columns: { id: true, name: true, color: true }
            }
          }
        }
      }
    });

    if (!sprint) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    }

    return NextResponse.json({ sprint });
  } catch (error) {
    console.error('Get sprint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update sprint
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; sprintId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { boardId, sprintId } = await params;
    const { hasAccess } = await checkBoardAccess(boardId, session.userId, 'write');

    if (!hasAccess) {
      return NextResponse.json({ error: 'Write access required' }, { status: 403 });
    }

    const sprint = await db.query.sprints.findFirst({
      where: and(
        eq(sprints.id, sprintId),
        eq(sprints.boardId, boardId)
      )
    });

    if (!sprint) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    }

    const { name, goal, startDate, endDate, status } = await request.json();

    const updates: any = { updatedAt: new Date() };
    if (name) updates.name = name;
    if (goal !== undefined) updates.goal = goal;
    if (startDate !== undefined) updates.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) updates.endDate = endDate ? new Date(endDate) : null;
    if (status && ['planning', 'active', 'completed'].includes(status)) {
      // Only one sprint can be active at a time
      if (status === 'active') {
        await db.update(sprints)
          .set({ status: 'planning' })
          .where(and(
            eq(sprints.boardId, boardId),
            eq(sprints.status, 'active')
          ));
      }
      updates.status = status;
    }

    await db.update(sprints)
      .set(updates)
      .where(eq(sprints.id, sprintId));

    const updatedSprint = await db.query.sprints.findFirst({
      where: eq(sprints.id, sprintId),
      with: {
        creator: {
          columns: { id: true, username: true, displayName: true }
        }
      }
    });

    return NextResponse.json({ 
      message: 'Sprint updated successfully',
      sprint: updatedSprint 
    });
  } catch (error) {
    console.error('Update sprint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete sprint
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; sprintId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { boardId, sprintId } = await params;
    const { hasAccess } = await checkBoardAccess(boardId, session.userId, 'admin');

    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const sprint = await db.query.sprints.findFirst({
      where: and(
        eq(sprints.id, sprintId),
        eq(sprints.boardId, boardId)
      )
    });

    if (!sprint) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    }

    // Move tasks back to backlog (null sprint)
    await db.update(tasks)
      .set({ sprintId: null })
      .where(eq(tasks.sprintId, sprintId));

    await db.delete(sprints).where(eq(sprints.id, sprintId));

    return NextResponse.json({ message: 'Sprint deleted successfully' });
  } catch (error) {
    console.error('Delete sprint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
