import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { boardColumns, boards, groupMembers, boardGroups, tasks } from '@/lib/db/schema';
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

// PUT - Update a column
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; columnId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { boardId, columnId } = await params;
    const { hasAccess } = await checkBoardAccess(boardId, session.userId, 'admin');

    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { name, color, wipLimit, isDefault } = await request.json();

    const column = await db.query.boardColumns.findFirst({
      where: and(
        eq(boardColumns.id, columnId),
        eq(boardColumns.boardId, boardId)
      )
    });

    if (!column) {
      return NextResponse.json({ error: 'Column not found' }, { status: 404 });
    }

    const updates: any = {};
    if (name) updates.name = name;
    if (color !== undefined) updates.color = color;
    if (wipLimit !== undefined) updates.wipLimit = wipLimit;
    
    // If setting as default, unset other defaults
    if (isDefault === true) {
      await db.update(boardColumns)
        .set({ isDefault: false })
        .where(eq(boardColumns.boardId, boardId));
      updates.isDefault = true;
    }

    await db.update(boardColumns)
      .set(updates)
      .where(eq(boardColumns.id, columnId));

    const updatedColumn = await db.query.boardColumns.findFirst({
      where: eq(boardColumns.id, columnId)
    });

    return NextResponse.json({ 
      message: 'Column updated successfully',
      column: updatedColumn 
    });
  } catch (error) {
    console.error('Update column error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a column
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; columnId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { boardId, columnId } = await params;
    const { hasAccess } = await checkBoardAccess(boardId, session.userId, 'admin');

    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const column = await db.query.boardColumns.findFirst({
      where: and(
        eq(boardColumns.id, columnId),
        eq(boardColumns.boardId, boardId)
      )
    });

    if (!column) {
      return NextResponse.json({ error: 'Column not found' }, { status: 404 });
    }

    // Check if column has tasks
    const columnTasks = await db.query.tasks.findMany({
      where: eq(tasks.columnId, columnId),
      columns: { id: true }
    });

    if (columnTasks.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete column with tasks. Move or delete tasks first.' 
      }, { status: 400 });
    }

    // Don't allow deleting the only column
    const allColumns = await db.query.boardColumns.findMany({
      where: eq(boardColumns.boardId, boardId),
      columns: { id: true }
    });

    if (allColumns.length <= 1) {
      return NextResponse.json({ 
        error: 'Cannot delete the only column. Create another column first.' 
      }, { status: 400 });
    }

    await db.delete(boardColumns).where(eq(boardColumns.id, columnId));

    return NextResponse.json({ message: 'Column deleted successfully' });
  } catch (error) {
    console.error('Delete column error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
