import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tasks, boards, groupMembers, boardGroups, taskLabelAssignments, taskComments, taskAttachments } from '@/lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { createNotification } from '@/lib/notifications';
import { v4 as uuidv4 } from 'uuid';

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

// GET - Get task details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; taskId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { boardId, taskId } = await params;
    const { hasAccess, board } = await checkBoardAccess(boardId, session.userId);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const task = await db.query.tasks.findFirst({
      where: and(
        eq(tasks.id, taskId),
        eq(tasks.boardId, boardId)
      ),
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
          with: { label: true }
        },
        comments: {
          with: {
            user: {
              columns: { id: true, username: true, displayName: true, avatarUrl: true }
            }
          },
          orderBy: asc(taskComments.createdAt)
        },
        attachments: {
          with: {
            uploader: {
              columns: { id: true, username: true, displayName: true }
            }
          }
        },
        subtasks: {
          with: {
            assignee: {
              columns: { id: true, username: true, displayName: true }
            },
            column: {
              columns: { id: true, name: true, color: true }
            }
          }
        }
      }
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      task: {
        ...task,
        labels: task.labelAssignments?.map(la => la.label) || [],
        taskKey: `${board?.key}-${task.taskNumber}`
      }
    });
  } catch (error) {
    console.error('Get task error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update task
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; taskId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { boardId, taskId } = await params;
    const { hasAccess, board } = await checkBoardAccess(boardId, session.userId, 'write');

    if (!hasAccess) {
      return NextResponse.json({ error: 'Write access required' }, { status: 403 });
    }

    const existingTask = await db.query.tasks.findFirst({
      where: and(
        eq(tasks.id, taskId),
        eq(tasks.boardId, boardId)
      )
    });

    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const body = await request.json();
    const { 
      title, 
      description, 
      type, 
      priority,
      columnId,
      sprintId,
      assigneeId,
      storyPoints,
      dueDate,
      sortOrder,
      labelIds
    } = body;

    const updates: any = { updatedAt: new Date() };

    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (type !== undefined) updates.type = type;
    if (priority !== undefined) updates.priority = priority;
    if (columnId !== undefined) updates.columnId = columnId;
    if (sprintId !== undefined) updates.sprintId = sprintId || null;
    if (storyPoints !== undefined) updates.storyPoints = storyPoints;
    if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;

    // Handle assignee change
    if (assigneeId !== undefined) {
      updates.assigneeId = assigneeId || null;
      
      // Notify new assignee
      if (assigneeId && assigneeId !== existingTask.assigneeId && assigneeId !== session.userId) {
        await createNotification({
          userId: assigneeId,
          type: 'task',
          title: 'Task Assigned',
          message: `You have been assigned to "${board?.key}-${existingTask.taskNumber}: ${existingTask.title}".`,
          link: `/boards/${boardId}?task=${taskId}`
        });
      }
    }

    await db.update(tasks)
      .set(updates)
      .where(eq(tasks.id, taskId));

    // Update labels if provided
    if (labelIds !== undefined && Array.isArray(labelIds)) {
      // Remove existing labels
      await db.delete(taskLabelAssignments)
        .where(eq(taskLabelAssignments.taskId, taskId));
      
      // Add new labels
      for (const labelId of labelIds) {
        await db.insert(taskLabelAssignments).values({
          id: uuidv4(),
          taskId,
          labelId
        });
      }
    }

    const updatedTask = await db.query.tasks.findFirst({
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
        sprint: {
          columns: { id: true, name: true, status: true }
        },
        labelAssignments: {
          with: { label: true }
        }
      }
    });

    return NextResponse.json({ 
      message: 'Task updated successfully',
      task: {
        ...updatedTask,
        labels: updatedTask?.labelAssignments?.map(la => la.label) || [],
        taskKey: `${board?.key}-${updatedTask?.taskNumber}`
      }
    });
  } catch (error) {
    console.error('Update task error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; taskId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { boardId, taskId } = await params;
    const { hasAccess } = await checkBoardAccess(boardId, session.userId, 'write');

    if (!hasAccess) {
      return NextResponse.json({ error: 'Write access required' }, { status: 403 });
    }

    const task = await db.query.tasks.findFirst({
      where: and(
        eq(tasks.id, taskId),
        eq(tasks.boardId, boardId)
      )
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Delete task (cascades to comments, attachments, label assignments)
    await db.delete(tasks).where(eq(tasks.id, taskId));

    return NextResponse.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
