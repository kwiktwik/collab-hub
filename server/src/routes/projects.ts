import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { projects, projectGroups, groupMembers, groups } from '../db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { requireAuth, checkProjectAccess } from '../middleware/auth.js';

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// Create a new project
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, groupId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    if (!groupId) {
      return res.status(400).json({ error: 'Group ID is required' });
    }

    // Check if user is admin of the group
    const membership = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, req.user!.id),
        eq(groupMembers.role, 'admin')
      )
    });

    if (!membership) {
      return res.status(403).json({ error: 'Admin access to group required' });
    }

    const projectId = uuidv4();

    // Create project
    await db.insert(projects).values({
      id: projectId,
      name,
      description,
      createdBy: req.user!.id
    });

    // Attach project to group with admin access
    await db.insert(projectGroups).values({
      id: uuidv4(),
      projectId,
      groupId,
      permissionLevel: 'admin'
    });

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      with: {
        groupAccess: {
          with: {
            group: {
              columns: { id: true, name: true }
            }
          }
        }
      }
    });

    res.status(201).json({ project });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all projects user has access to
router.get('/', async (req: Request, res: Response) => {
  try {
    // Get all groups user is a member of
    const userGroups = await db.query.groupMembers.findMany({
      where: eq(groupMembers.userId, req.user!.id),
      columns: { groupId: true }
    });

    if (userGroups.length === 0) {
      return res.json({ projects: [] });
    }

    const groupIds = userGroups.map(g => g.groupId);

    // Get all projects these groups have access to
    const projectAccessList = await db.query.projectGroups.findMany({
      where: inArray(projectGroups.groupId, groupIds),
      with: {
        project: {
          with: {
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

    // Deduplicate projects and aggregate access info
    const projectMap = new Map();
    for (const access of projectAccessList) {
      if (!projectMap.has(access.projectId)) {
        projectMap.set(access.projectId, {
          ...access.project,
          accessGroups: []
        });
      }
      projectMap.get(access.projectId).accessGroups.push({
        group: access.group,
        permissionLevel: access.permissionLevel
      });
    }

    const userProjects = Array.from(projectMap.values());

    res.json({ projects: userProjects });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific project
router.get('/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    const hasAccess = await checkProjectAccess(req.user!.id, projectId, 'read');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      with: {
        creator: {
          columns: { id: true, username: true, displayName: true }
        },
        groupAccess: {
          with: {
            group: {
              with: {
                members: {
                  with: {
                    user: {
                      columns: { id: true, username: true, displayName: true }
                    }
                  }
                }
              }
            }
          }
        },
        documents: {
          columns: { id: true, title: true, parentId: true, sortOrder: true, createdAt: true }
        },
        folders: {
          columns: { id: true, name: true, parentId: true }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ project });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a project
router.put('/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { name, description, status } = req.body;

    const hasAccess = await checkProjectAccess(req.user!.id, projectId, 'admin');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const updates: Partial<typeof projects.$inferInsert> = {
      updatedAt: new Date()
    };

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;

    await db.update(projects)
      .set(updates)
      .where(eq(projects.id, projectId));

    const updatedProject = await db.query.projects.findFirst({
      where: eq(projects.id, projectId)
    });

    res.json({ project: updatedProject });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a project
router.delete('/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    const hasAccess = await checkProjectAccess(req.user!.id, projectId, 'admin');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await db.delete(projects).where(eq(projects.id, projectId));

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Share project with a group
router.post('/:projectId/groups', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { groupId, permissionLevel = 'read' } = req.body;

    if (!groupId) {
      return res.status(400).json({ error: 'Group ID is required' });
    }

    const hasAccess = await checkProjectAccess(req.user!.id, projectId, 'admin');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Check if user has access to the group they're sharing with
    const groupMembership = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, req.user!.id)
      )
    });

    if (!groupMembership) {
      return res.status(403).json({ error: 'You must be a member of the group to share with it' });
    }

    // Check if already shared
    const existingShare = await db.query.projectGroups.findFirst({
      where: and(
        eq(projectGroups.projectId, projectId),
        eq(projectGroups.groupId, groupId)
      )
    });

    if (existingShare) {
      // Update existing share
      await db.update(projectGroups)
        .set({ permissionLevel })
        .where(eq(projectGroups.id, existingShare.id));
    } else {
      // Create new share
      await db.insert(projectGroups).values({
        id: uuidv4(),
        projectId,
        groupId,
        permissionLevel
      });
    }

    const group = await db.query.groups.findFirst({
      where: eq(groups.id, groupId),
      columns: { id: true, name: true }
    });

    res.status(201).json({
      message: 'Project shared successfully',
      share: {
        group,
        permissionLevel
      }
    });
  } catch (error) {
    console.error('Share project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update project group permission
router.put('/:projectId/groups/:groupId', async (req: Request, res: Response) => {
  try {
    const { projectId, groupId } = req.params;
    const { permissionLevel } = req.body;

    if (!['read', 'write', 'admin'].includes(permissionLevel)) {
      return res.status(400).json({ error: 'Invalid permission level' });
    }

    const hasAccess = await checkProjectAccess(req.user!.id, projectId, 'admin');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await db.update(projectGroups)
      .set({ permissionLevel })
      .where(and(
        eq(projectGroups.projectId, projectId),
        eq(projectGroups.groupId, groupId)
      ));

    res.json({ message: 'Permission updated' });
  } catch (error) {
    console.error('Update permission error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove group access from project
router.delete('/:projectId/groups/:groupId', async (req: Request, res: Response) => {
  try {
    const { projectId, groupId } = req.params;

    const hasAccess = await checkProjectAccess(req.user!.id, projectId, 'admin');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Prevent removing last admin group
    const adminGroups = await db.query.projectGroups.findMany({
      where: and(
        eq(projectGroups.projectId, projectId),
        eq(projectGroups.permissionLevel, 'admin')
      )
    });

    if (adminGroups.length === 1 && adminGroups[0].groupId === groupId) {
      return res.status(400).json({ error: 'Cannot remove the last admin group' });
    }

    await db.delete(projectGroups)
      .where(and(
        eq(projectGroups.projectId, projectId),
        eq(projectGroups.groupId, groupId)
      ));

    res.json({ message: 'Group access removed' });
  } catch (error) {
    console.error('Remove group access error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
