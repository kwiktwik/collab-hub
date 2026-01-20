import { Request, Response, NextFunction } from 'express';
import { db } from '../db/index.js';
import { users, groupMembers, projectGroups } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

// Extend Express session types
declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

// Extend Express Request types
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        email: string;
        displayName: string | null;
      };
    }
  }
}

/**
 * Middleware to require authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

/**
 * Middleware to load user data if authenticated
 */
export async function loadUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.session.userId) {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, req.session.userId),
        columns: {
          id: true,
          username: true,
          email: true,
          displayName: true
        }
      });
      
      if (user) {
        req.user = user;
      } else {
        // User no longer exists, clear session
        req.session.destroy(() => {});
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  }
  next();
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

/**
 * Middleware factory to require project access
 */
export function requireProjectAccess(permission: 'read' | 'write' | 'admin' = 'read') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const projectId = req.params.projectId || req.body.projectId;
    
    if (!projectId) {
      res.status(400).json({ error: 'Project ID required' });
      return;
    }

    const hasAccess = await checkProjectAccess(req.user.id, projectId, permission);
    
    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    next();
  };
}
