import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { boardColumns, boards, groupMembers, boardGroups } from '@/lib/db/schema';
import { eq, asc, max } from 'drizzle-orm';
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

// GET - Get all columns for a board
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

    const columns = await db.query.boardColumns.findMany({
      where: eq(boardColumns.boardId, boardId),
      orderBy: asc(boardColumns.sortOrder)
    });

    return NextResponse.json({ columns });
  } catch (error) {
    console.error('Get columns error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new column
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
    const { hasAccess } = await checkBoardAccess(boardId, session.userId, 'admin');

    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { name, color, wipLimit } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Column name is required' }, { status: 400 });
    }

    // Get highest sort order
    const existingColumns = await db.query.boardColumns.findMany({
      where: eq(boardColumns.boardId, boardId),
      columns: { sortOrder: true }
    });

    const maxOrder = existingColumns.reduce((max, col) => 
      col.sortOrder > max ? col.sortOrder : max, -1
    );

    const columnId = uuidv4();
    await db.insert(boardColumns).values({
      id: columnId,
      boardId,
      name,
      color: color || '#6366f1',
      sortOrder: maxOrder + 1,
      wipLimit: wipLimit || null,
      isDefault: false
    });

    const newColumn = await db.query.boardColumns.findFirst({
      where: eq(boardColumns.id, columnId)
    });

    return NextResponse.json({ 
      message: 'Column created successfully',
      column: newColumn 
    }, { status: 201 });
  } catch (error) {
    console.error('Create column error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Reorder columns (batch update)
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

    const { columns: columnOrder } = await request.json();

    if (!Array.isArray(columnOrder)) {
      return NextResponse.json({ error: 'Column order array required' }, { status: 400 });
    }

    // Update each column's sort order
    for (let i = 0; i < columnOrder.length; i++) {
      await db.update(boardColumns)
        .set({ sortOrder: i })
        .where(eq(boardColumns.id, columnOrder[i].id));
    }

    const updatedColumns = await db.query.boardColumns.findMany({
      where: eq(boardColumns.boardId, boardId),
      orderBy: asc(boardColumns.sortOrder)
    });

    return NextResponse.json({ 
      message: 'Columns reordered successfully',
      columns: updatedColumns 
    });
  } catch (error) {
    console.error('Reorder columns error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
