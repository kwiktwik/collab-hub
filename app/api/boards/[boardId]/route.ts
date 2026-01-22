import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { boards, boardColumns, boardGroups, groupMembers, tasks, sprints, taskLabels } from '@/lib/db/schema';
import { eq, inArray, asc } from 'drizzle-orm';
import { getSession } from '@/lib/session';

// Helper to check board access
async function checkBoardAccess(boardId: string, userId: string, requiredLevel: 'read' | 'write' | 'admin' = 'read') {
  const board = await db.query.boards.findFirst({
    where: eq(boards.id, boardId)
  });

  if (!board) return { hasAccess: false, board: null, permission: null };

  // Creator has admin access
  if (board.createdBy === userId) {
    return { hasAccess: true, board, permission: 'admin' as const };
  }

  // Check group access
  const userGroups = await db.query.groupMembers.findMany({
    where: eq(groupMembers.userId, userId),
    columns: { groupId: true }
  });

  const groupIds = userGroups.map(g => g.groupId);

  if (groupIds.length === 0) {
    return { hasAccess: false, board, permission: null };
  }

  const boardAccess = await db.query.boardGroups.findMany({
    where: eq(boardGroups.boardId, boardId)
  });

  const userBoardAccess = boardAccess.filter(ba => groupIds.includes(ba.groupId));

  if (userBoardAccess.length === 0) {
    return { hasAccess: false, board, permission: null };
  }

  // Get highest permission
  const permOrder = { read: 0, write: 1, admin: 2 };
  let highestPerm: 'read' | 'write' | 'admin' = 'read';
  for (const access of userBoardAccess) {
    if (permOrder[access.permissionLevel] > permOrder[highestPerm]) {
      highestPerm = access.permissionLevel;
    }
  }

  // Check if user has required permission level
  const hasAccess = permOrder[highestPerm] >= permOrder[requiredLevel];

  return { hasAccess, board, permission: highestPerm };
}

// GET - Get board with all data
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
    const { hasAccess, permission } = await checkBoardAccess(boardId, session.userId);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get full board data
    const board = await db.query.boards.findFirst({
      where: eq(boards.id, boardId),
      with: {
        creator: {
          columns: { id: true, username: true, displayName: true }
        },
        columns: {
          orderBy: asc(boardColumns.sortOrder)
        },
        sprints: {
          with: {
            creator: {
              columns: { id: true, username: true, displayName: true }
            }
          }
        },
        labels: true,
        groupAccess: {
          with: {
            group: {
              columns: { id: true, name: true }
            }
          }
        }
      }
    });

    // Get tasks with all relations
    const boardTasks = await db.query.tasks.findMany({
      where: eq(tasks.boardId, boardId),
      with: {
        assignee: {
          columns: { id: true, username: true, displayName: true, avatarUrl: true }
        },
        reporter: {
          columns: { id: true, username: true, displayName: true, avatarUrl: true }
        },
        labelAssignments: {
          with: {
            label: true
          }
        }
      },
      orderBy: asc(tasks.sortOrder)
    });

    // Transform tasks to include labels directly
    const tasksWithLabels = boardTasks.map(task => ({
      ...task,
      labels: task.labelAssignments?.map(la => la.label) || []
    }));

    // Organize tasks by column
    const columns = board?.columns?.map(col => ({
      ...col,
      tasks: tasksWithLabels.filter(t => t.columnId === col.id)
    })) || [];

    return NextResponse.json({ 
      board: {
        ...board,
        columns,
        myPermission: permission
      }
    });
  } catch (error) {
    console.error('Get board error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update board
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { boardId } = await params;
    const { hasAccess } = await checkBoardAccess(boardId, session.userId, 'admin');

    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { name, description } = await request.json();

    const updates: any = { updatedAt: new Date() };
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;

    await db.update(boards)
      .set(updates)
      .where(eq(boards.id, boardId));

    const updatedBoard = await db.query.boards.findFirst({
      where: eq(boards.id, boardId)
    });

    return NextResponse.json({ 
      message: 'Board updated successfully',
      board: updatedBoard 
    });
  } catch (error) {
    console.error('Update board error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete board
export async function DELETE(
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

    // Only the creator can delete the board
    if (board?.createdBy !== session.userId) {
      return NextResponse.json({ error: 'Only the board creator can delete it' }, { status: 403 });
    }

    await db.delete(boards).where(eq(boards.id, boardId));

    return NextResponse.json({ message: 'Board deleted successfully' });
  } catch (error) {
    console.error('Delete board error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


