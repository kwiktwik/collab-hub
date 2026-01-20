import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { like, or } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// Search users
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const searchPattern = `%${q}%`;

    const results = await db.query.users.findMany({
      where: or(
        like(users.username, searchPattern),
        like(users.email, searchPattern),
        like(users.displayName, searchPattern)
      ),
      columns: {
        id: true,
        username: true,
        displayName: true,
        email: true
      },
      limit: 20
    });

    res.json({ users: results });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by ID
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, userId),
      columns: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
