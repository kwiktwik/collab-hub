import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { taskLabels, boards, groupMembers, boardGroups } from '@/lib/db/schema';
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

// PUT - Update a label
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; labelId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { boardId, labelId } = await params;
    const { hasAccess } = await checkBoardAccess(boardId, session.userId, 'write');

    if (!hasAccess) {
      return NextResponse.json({ error: 'Write access required' }, { status: 403 });
    }

    const label = await db.query.taskLabels.findFirst({
      where: and(
        eq(taskLabels.id, labelId),
        eq(taskLabels.boardId, boardId)
      )
    });

    if (!label) {
      return NextResponse.json({ error: 'Label not found' }, { status: 404 });
    }

    const { name, color } = await request.json();

    const updates: any = {};
    if (name) updates.name = name;
    if (color) updates.color = color;

    await db.update(taskLabels)
      .set(updates)
      .where(eq(taskLabels.id, labelId));

    const updatedLabel = await db.query.taskLabels.findFirst({
      where: eq(taskLabels.id, labelId)
    });

    return NextResponse.json({ 
      message: 'Label updated successfully',
      label: updatedLabel 
    });
  } catch (error) {
    console.error('Update label error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a label
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; labelId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { boardId, labelId } = await params;
    const { hasAccess } = await checkBoardAccess(boardId, session.userId, 'admin');

    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const label = await db.query.taskLabels.findFirst({
      where: and(
        eq(taskLabels.id, labelId),
        eq(taskLabels.boardId, boardId)
      )
    });

    if (!label) {
      return NextResponse.json({ error: 'Label not found' }, { status: 404 });
    }

    // Delete will cascade to task_label_assignments
    await db.delete(taskLabels).where(eq(taskLabels.id, labelId));

    return NextResponse.json({ message: 'Label deleted successfully' });
  } catch (error) {
    console.error('Delete label error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
