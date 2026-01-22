import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { boards, boardColumns, boardGroups, groupMembers, organizationMembers } from '@/lib/db/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { checkOrgAccess } from '@/lib/org-access';

// Default columns for new boards
const DEFAULT_COLUMNS = [
  { name: 'Backlog', color: '#6b7280', sortOrder: 0, isDefault: true },
  { name: 'To Do', color: '#3b82f6', sortOrder: 1, isDefault: false },
  { name: 'In Progress', color: '#f59e0b', sortOrder: 2, isDefault: false },
  { name: 'Done', color: '#10b981', sortOrder: 3, isDefault: false },
  { name: 'Deployed', color: '#8b5cf6', sortOrder: 4, isDefault: false }
];

// GET - List all boards the user has access to
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('organizationId');

    // Get user's organizations
    const userOrgMemberships = await db.query.organizationMembers.findMany({
      where: eq(organizationMembers.userId, session.userId),
      columns: { organizationId: true }
    });
    const orgIds = userOrgMemberships.map(m => m.organizationId);

    if (orgIds.length === 0) {
      return NextResponse.json({ boards: [] });
    }

    // Get user's groups
    const userGroups = await db.query.groupMembers.findMany({
      where: eq(groupMembers.userId, session.userId),
      columns: { groupId: true }
    });

    const groupIds = userGroups.map(g => g.groupId);

    // Get boards accessible through user's groups
    let accessibleBoards: any[] = [];
    
    if (groupIds.length > 0) {
      const boardGroupAccess = await db.query.boardGroups.findMany({
        where: inArray(boardGroups.groupId, groupIds),
        with: {
          board: {
            with: {
              organization: {
                columns: { id: true, name: true, slug: true }
              },
              creator: {
                columns: { id: true, username: true, displayName: true }
              }
            }
          },
          group: {
            columns: { id: true, name: true }
          }
        }
      });

      // Group by board and collect access info
      const boardMap = new Map<string, any>();
      for (const access of boardGroupAccess) {
        // Only include boards from user's orgs
        if (!orgIds.includes(access.board.organizationId)) continue;
        
        if (!boardMap.has(access.boardId)) {
          boardMap.set(access.boardId, {
            ...access.board,
            accessGroups: [],
            myPermission: 'read'
          });
        }
        const board = boardMap.get(access.boardId);
        board.accessGroups.push({
          group: access.group,
          permissionLevel: access.permissionLevel
        });
        // Track highest permission
        const permOrder: Record<string, number> = { read: 0, write: 1, admin: 2 };
        if (permOrder[access.permissionLevel] > permOrder[board.myPermission]) {
          board.myPermission = access.permissionLevel;
        }
      }

      accessibleBoards = Array.from(boardMap.values());
    }

    // Also get boards created by user (they have implicit admin access)
    const createdBoards = await db.query.boards.findMany({
      where: eq(boards.createdBy, session.userId),
      with: {
        organization: {
          columns: { id: true, name: true, slug: true }
        },
        creator: {
          columns: { id: true, username: true, displayName: true }
        }
      }
    });

    // Merge and deduplicate
    for (const board of createdBoards) {
      if (!accessibleBoards.find(b => b.id === board.id)) {
        accessibleBoards.push({ ...board, myPermission: 'admin', accessGroups: [] });
      }
    }

    // Filter by org if specified
    if (orgId) {
      accessibleBoards = accessibleBoards.filter(b => b.organizationId === orgId);
    }

    // Sort by updated date
    accessibleBoards.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return NextResponse.json({ boards: accessibleBoards });
  } catch (error) {
    console.error('Get boards error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new board
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { name, description, key, groupIds, organizationId, projectId } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Board name is required' }, { status: 400 });
    }

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization is required' }, { status: 400 });
    }

    if (!key || !/^[A-Z]{2,10}$/.test(key)) {
      return NextResponse.json({ 
        error: 'Board key is required and must be 2-10 uppercase letters (e.g., PROJ, DEV)' 
      }, { status: 400 });
    }

    // Verify user is member of organization
    const { hasAccess } = await checkOrgAccess(organizationId, session.userId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    // Check key uniqueness within organization
    const existingBoard = await db.query.boards.findFirst({
      where: and(eq(boards.key, key), eq(boards.organizationId, organizationId))
    });

    if (existingBoard) {
      return NextResponse.json({ error: 'Board key already exists in this organization' }, { status: 400 });
    }

    // Create board
    const boardId = uuidv4();
    await db.insert(boards).values({
      id: boardId,
      organizationId,
      projectId: projectId || null,
      name,
      description: description || null,
      key,
      createdBy: session.userId
    });

    // Create default columns
    for (const col of DEFAULT_COLUMNS) {
      await db.insert(boardColumns).values({
        id: uuidv4(),
        boardId,
        name: col.name,
        color: col.color,
        sortOrder: col.sortOrder,
        isDefault: col.isDefault
      });
    }

    // Add group access if provided
    if (groupIds && Array.isArray(groupIds) && groupIds.length > 0) {
      // Verify user is admin of these groups
      const userGroupMemberships = await db.query.groupMembers.findMany({
        where: eq(groupMembers.userId, session.userId)
      });

      const adminGroupIds = userGroupMemberships
        .filter(m => m.role === 'admin')
        .map(m => m.groupId);

      for (const groupId of groupIds) {
        if (adminGroupIds.includes(groupId)) {
          await db.insert(boardGroups).values({
            id: uuidv4(),
            boardId,
            groupId,
            permissionLevel: 'write'
          });
        }
      }
    }

    // Fetch the created board with relations
    const newBoard = await db.query.boards.findFirst({
      where: eq(boards.id, boardId),
      with: {
        creator: {
          columns: { id: true, username: true, displayName: true }
        },
        columns: true,
        groupAccess: {
          with: {
            group: {
              columns: { id: true, name: true }
            }
          }
        }
      }
    });

    return NextResponse.json({ 
      message: 'Board created successfully',
      board: newBoard 
    }, { status: 201 });
  } catch (error) {
    console.error('Create board error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
