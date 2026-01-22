import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { tasks, boards, groupMembers, boardGroups, boardColumns, taskLabelAssignments, users } from '@/lib/db/schema';
import { eq, and, max, asc, desc, isNull } from 'drizzle-orm';
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

// GET - Get all tasks for a board (with optional filters)
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

    const { searchParams } = new URL(request.url);
    const sprintId = searchParams.get('sprintId');
    const columnId = searchParams.get('columnId');
    const assigneeId = searchParams.get('assigneeId');
    const backlogOnly = searchParams.get('backlog') === 'true';

    // Build query
    let whereClause = eq(tasks.boardId, boardId);

    const boardTasks = await db.query.tasks.findMany({
      where: whereClause,
      with: {
        assignee: {
          columns: { id: true, username: true, displayName: true, avatarUrl: true }
        },
        reporter: {
          columns: { id: true, username: true, displayName: true, avatarUrl: true }
        },
        column: {
          columns: { id: true, name: true, color: true }
        },
        sprint: {
          columns: { id: true, name: true, status: true }
        },
        labelAssignments: {
          with: {
            label: true
          }
        }
      },
      orderBy: [asc(tasks.sortOrder), desc(tasks.createdAt)]
    });

    // Apply filters in memory (simpler for SQLite)
    let filteredTasks = boardTasks;
    
    if (sprintId) {
      filteredTasks = filteredTasks.filter(t => t.sprintId === sprintId);
    }
    if (columnId) {
      filteredTasks = filteredTasks.filter(t => t.columnId === columnId);
    }
    if (assigneeId) {
      filteredTasks = filteredTasks.filter(t => t.assigneeId === assigneeId);
    }
    if (backlogOnly) {
      filteredTasks = filteredTasks.filter(t => !t.sprintId);
    }

    // Transform to include labels directly
    const tasksWithLabels = filteredTasks.map(task => ({
      ...task,
      labels: task.labelAssignments?.map(la => la.label) || []
    }));

    return NextResponse.json({ tasks: tasksWithLabels });
  } catch (error) {
    console.error('Get tasks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new task
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
    const { hasAccess, board } = await checkBoardAccess(boardId, session.userId, 'write');

    if (!hasAccess) {
      return NextResponse.json({ error: 'Write access required' }, { status: 403 });
    }

    const { 
      title, 
      description, 
      type = 'task', 
      priority = 'medium',
      columnId,
      sprintId,
      assigneeId,
      storyPoints,
      dueDate,
      labelIds,
      parentTaskId
    } = await request.json();

    if (!title) {
      return NextResponse.json({ error: 'Task title is required' }, { status: 400 });
    }

    // Get or default column
    let targetColumnId = columnId;
    if (!targetColumnId) {
      const defaultColumn = await db.query.boardColumns.findFirst({
        where: and(
          eq(boardColumns.boardId, boardId),
          eq(boardColumns.isDefault, true)
        )
      });
      
      if (!defaultColumn) {
        const firstColumn = await db.query.boardColumns.findFirst({
          where: eq(boardColumns.boardId, boardId),
          orderBy: asc(boardColumns.sortOrder)
        });
        targetColumnId = firstColumn?.id;
      } else {
        targetColumnId = defaultColumn.id;
      }
    }

    if (!targetColumnId) {
      return NextResponse.json({ error: 'No column available' }, { status: 400 });
    }

    // Get next task number
    const existingTasks = await db.query.tasks.findMany({
      where: eq(tasks.boardId, boardId),
      columns: { taskNumber: true }
    });
    const maxNumber = existingTasks.reduce((max, t) => t.taskNumber > max ? t.taskNumber : max, 0);

    // Get max sort order in target column
    const columnTasks = await db.query.tasks.findMany({
      where: eq(tasks.columnId, targetColumnId),
      columns: { sortOrder: true }
    });
    const maxSort = columnTasks.reduce((max, t) => t.sortOrder > max ? t.sortOrder : max, -1);

    const taskId = uuidv4();
    await db.insert(tasks).values({
      id: taskId,
      boardId,
      columnId: targetColumnId,
      sprintId: sprintId || null,
      taskNumber: maxNumber + 1,
      title,
      description: description || null,
      type,
      priority,
      storyPoints: storyPoints || null,
      assigneeId: assigneeId || null,
      reporterId: session.userId,
      parentTaskId: parentTaskId || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      sortOrder: maxSort + 1
    });

    // Add labels
    if (labelIds && Array.isArray(labelIds)) {
      for (const labelId of labelIds) {
        await db.insert(taskLabelAssignments).values({
          id: uuidv4(),
          taskId,
          labelId
        });
      }
    }

    // Notify assignee if assigned
    if (assigneeId && assigneeId !== session.userId) {
      await createNotification({
        userId: assigneeId,
        type: 'task',
        title: 'Task Assigned',
        message: `You have been assigned to "${board?.key}-${maxNumber + 1}: ${title}".`,
        link: `/boards/${boardId}?task=${taskId}`
      });
    }

    // Fetch the created task
    const newTask = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: {
        assignee: {
          columns: { id: true, username: true, displayName: true, avatarUrl: true }
        },
        reporter: {
          columns: { id: true, username: true, displayName: true }
        },
        column: {
          columns: { id: true, name: true, color: true }
        },
        labelAssignments: {
          with: { label: true }
        }
      }
    });

    return NextResponse.json({ 
      message: 'Task created successfully',
      task: {
        ...newTask,
        labels: newTask?.labelAssignments?.map(la => la.label) || [],
        taskKey: `${board?.key}-${maxNumber + 1}`
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Create task error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
