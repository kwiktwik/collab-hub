import { db } from './db';
import { users, groupMembers, projectGroups } from './db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from './session';
import { NextResponse } from 'next/server';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getSession();
  
  if (!session.userId) {
    return null;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      avatarUrl: true
    }
  });

  return user || null;
}

/**
 * Require authentication - returns user or throws error response
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  
  if (!user) {
    throw NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  return user;
}

/**
 * Check if user has access to a project
 */
export async function checkProjectAccess(
  userId: string,
  projectId: string,
  requiredPermission: 'read' | 'write' | 'admin' = 'read'
): Promise<boolean> {
  const permissionOrder = ['read', 'write', 'admin'];
  const requiredLevel = permissionOrder.indexOf(requiredPermission);

  // Get all groups the user is a member of
  const userGroups = await db.query.groupMembers.findMany({
    where: eq(groupMembers.userId, userId),
    columns: { groupId: true }
  });

  if (userGroups.length === 0) {
    return false;
  }

  const groupIds = userGroups.map(g => g.groupId);

  // Check if any of the user's groups have access to the project
  const projectAccess = await db.query.projectGroups.findMany({
    where: eq(projectGroups.projectId, projectId)
  });

  for (const access of projectAccess) {
    if (groupIds.includes(access.groupId)) {
      const accessLevel = permissionOrder.indexOf(access.permissionLevel);
      if (accessLevel >= requiredLevel) {
        return true;
      }
    }
  }

  return false;
}
