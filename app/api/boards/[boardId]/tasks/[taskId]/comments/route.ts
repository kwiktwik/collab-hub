import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { taskComments, tasks, boards, groupMembers, boardGroups, taskWatchers } from '@/lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
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

// GET - Get all comments for a task
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
    const { hasAccess } = await checkBoardAccess(boardId, session.userId);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const comments = await db.query.taskComments.findMany({
      where: eq(taskComments.taskId, taskId),
      with: {
        user: {
          columns: { id: true, username: true, displayName: true, avatarUrl: true }
        }
      },
      orderBy: asc(taskComments.createdAt)
    });

    return NextResponse.json({ comments });
  } catch (error) {
    console.error('Get comments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Add a comment
export async function POST(
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

    const { content } = await request.json();

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Comment content is required' }, { status: 400 });
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

    const commentId = uuidv4();
    await db.insert(taskComments).values({
      id: commentId,
      taskId,
      userId: session.userId,
      content: content.trim()
    });

    // Notify task assignee and reporter (if not the commenter)
    const notifyUsers = new Set<string>();
    if (task.assigneeId && task.assigneeId !== session.userId) {
      notifyUsers.add(task.assigneeId);
    }
    if (task.reporterId !== session.userId) {
      notifyUsers.add(task.reporterId);
    }

    // Also notify watchers
    const watchers = await db.query.taskWatchers.findMany({
      where: eq(taskWatchers.taskId, taskId)
    });
    for (const watcher of watchers) {
      if (watcher.userId !== session.userId) {
        notifyUsers.add(watcher.userId);
      }
    }

    const currentUser = await db.query.users.findFirst({
      where: eq(groupMembers.userId, session.userId),
      columns: { displayName: true, username: true }
    });

    for (const userId of Array.from(notifyUsers)) {
      await createNotification({
        userId,
        type: 'task',
        title: 'New Comment',
        message: `${currentUser?.displayName || currentUser?.username || 'Someone'} commented on "${board?.key}-${task.taskNumber}: ${task.title}".`,
        link: `/boards/${boardId}?task=${taskId}`
      });
    }

    const newComment = await db.query.taskComments.findFirst({
      where: eq(taskComments.id, commentId),
      with: {
        user: {
          columns: { id: true, username: true, displayName: true, avatarUrl: true }
        }
      }
    });

    return NextResponse.json({ 
      message: 'Comment added successfully',
      comment: newComment 
    }, { status: 201 });
  } catch (error) {
    console.error('Add comment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
