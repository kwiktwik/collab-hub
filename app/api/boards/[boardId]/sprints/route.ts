import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { sprints, boards, groupMembers, boardGroups, tasks } from '@/lib/db/schema';
import { eq, desc, and, asc } from 'drizzle-orm';
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

// GET - Get all sprints for a board
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

    const boardSprints = await db.query.sprints.findMany({
      where: eq(sprints.boardId, boardId),
      with: {
        creator: {
          columns: { id: true, username: true, displayName: true }
        }
      },
      orderBy: desc(sprints.createdAt)
    });

    // Get task counts for each sprint
    const sprintsWithCounts = await Promise.all(boardSprints.map(async sprint => {
      const sprintTasks = await db.query.tasks.findMany({
        where: eq(tasks.sprintId, sprint.id),
        columns: { id: true, storyPoints: true }
      });

      return {
        ...sprint,
        taskCount: sprintTasks.length,
        totalPoints: sprintTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0)
      };
    }));

    return NextResponse.json({ sprints: sprintsWithCounts });
  } catch (error) {
    console.error('Get sprints error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new sprint
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
    const { hasAccess } = await checkBoardAccess(boardId, session.userId, 'write');

    if (!hasAccess) {
      return NextResponse.json({ error: 'Write access required' }, { status: 403 });
    }

    const { name, goal, startDate, endDate } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Sprint name is required' }, { status: 400 });
    }

    const sprintId = uuidv4();
    await db.insert(sprints).values({
      id: sprintId,
      boardId,
      name,
      goal: goal || null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      status: 'planning',
      createdBy: session.userId
    });

    const newSprint = await db.query.sprints.findFirst({
      where: eq(sprints.id, sprintId),
      with: {
        creator: {
          columns: { id: true, username: true, displayName: true }
        }
      }
    });

    return NextResponse.json({ 
      message: 'Sprint created successfully',
      sprint: newSprint 
    }, { status: 201 });
  } catch (error) {
    console.error('Create sprint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
