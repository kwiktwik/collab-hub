import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { groups, groupMembers, users } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// Create a new group
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const groupId = uuidv4();
    
    await db.insert(groups).values({
      id: groupId,
      name,
      description,
      createdBy: req.user!.id
    });

    // Add creator as admin member
    await db.insert(groupMembers).values({
      id: uuidv4(),
      groupId,
      userId: req.user!.id,
      role: 'admin'
    });

    const group = await db.query.groups.findFirst({
      where: eq(groups.id, groupId),
      with: {
        members: {
          with: {
            user: {
              columns: { id: true, username: true, displayName: true }
            }
          }
        }
      }
    });

    res.status(201).json({ group });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all groups user is a member of
router.get('/', async (req: Request, res: Response) => {
  try {
    const userGroupMemberships = await db.query.groupMembers.findMany({
      where: eq(groupMembers.userId, req.user!.id),
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
    });

    const userGroups = userGroupMemberships.map(m => ({
      ...m.group,
      myRole: m.role,
      memberCount: m.group.members.length
    }));

    res.json({ groups: userGroups });
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific group
router.get('/:groupId', async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;

    // Check if user is a member
    const membership = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, req.user!.id)
      )
    });

    if (!membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const group = await db.query.groups.findFirst({
      where: eq(groups.id, groupId),
      with: {
        members: {
          with: {
            user: {
              columns: { id: true, username: true, displayName: true, email: true }
            }
          }
        },
        projectAccess: {
          with: {
            project: {
              columns: { id: true, name: true, description: true, status: true }
            }
          }
        }
      }
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    res.json({ group, myRole: membership.role });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a group
router.put('/:groupId', async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const { name, description } = req.body;

    // Check if user is admin of the group
    const membership = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, req.user!.id),
        eq(groupMembers.role, 'admin')
      )
    });

    if (!membership) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const updates: Partial<typeof groups.$inferInsert> = {
      updatedAt: new Date()
    };

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;

    await db.update(groups)
      .set(updates)
      .where(eq(groups.id, groupId));

    const updatedGroup = await db.query.groups.findFirst({
      where: eq(groups.id, groupId)
    });

    res.json({ group: updatedGroup });
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a group
router.delete('/:groupId', async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;

    // Check if user is admin
    const membership = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, req.user!.id),
        eq(groupMembers.role, 'admin')
      )
    });

    if (!membership) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await db.delete(groups).where(eq(groups.id, groupId));

    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add member to group
router.post('/:groupId/members', async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const { userId, username, role = 'member' } = req.body;

    // Check if requester is admin
    const membership = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, req.user!.id),
        eq(groupMembers.role, 'admin')
      )
    });

    if (!membership) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Find user to add
    let targetUser;
    if (userId) {
      targetUser = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });
    } else if (username) {
      targetUser = await db.query.users.findFirst({
        where: eq(users.username, username)
      });
    }

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already a member
    const existingMembership = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, targetUser.id)
      )
    });

    if (existingMembership) {
      return res.status(400).json({ error: 'User is already a member' });
    }

    // Add member
    await db.insert(groupMembers).values({
      id: uuidv4(),
      groupId,
      userId: targetUser.id,
      role: role as 'admin' | 'member'
    });

    res.status(201).json({ 
      message: 'Member added successfully',
      member: {
        userId: targetUser.id,
        username: targetUser.username,
        displayName: targetUser.displayName,
        role
      }
    });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update member role
router.put('/:groupId/members/:userId', async (req: Request, res: Response) => {
  try {
    const { groupId, userId } = req.params;
    const { role } = req.body;

    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if requester is admin
    const membership = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, req.user!.id),
        eq(groupMembers.role, 'admin')
      )
    });

    if (!membership) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Prevent removing last admin
    if (role === 'member') {
      const adminCount = await db.query.groupMembers.findMany({
        where: and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.role, 'admin')
        )
      });

      if (adminCount.length === 1 && adminCount[0].userId === userId) {
        return res.status(400).json({ error: 'Cannot remove the last admin' });
      }
    }

    await db.update(groupMembers)
      .set({ role })
      .where(and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId)
      ));

    res.json({ message: 'Member role updated' });
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove member from group
router.delete('/:groupId/members/:userId', async (req: Request, res: Response) => {
  try {
    const { groupId, userId } = req.params;

    // Check if requester is admin or removing themselves
    const membership = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, req.user!.id)
      )
    });

    if (!membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (membership.role !== 'admin' && userId !== req.user!.id) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Prevent removing last admin
    const targetMembership = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId)
      )
    });

    if (targetMembership?.role === 'admin') {
      const adminCount = await db.query.groupMembers.findMany({
        where: and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.role, 'admin')
        )
      });

      if (adminCount.length === 1) {
        return res.status(400).json({ error: 'Cannot remove the last admin' });
      }
    }

    await db.delete(groupMembers)
      .where(and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId)
      ));

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
