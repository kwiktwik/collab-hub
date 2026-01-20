import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Register new user
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password, displayName } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.username, username)
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const existingEmail = await db.query.users.findFirst({
      where: eq(users.email, email)
    });

    if (existingEmail) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const userId = uuidv4();
    await db.insert(users).values({
      id: userId,
      username,
      email,
      passwordHash,
      displayName: displayName || username
    });

    // Set session
    req.session.userId = userId;

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: userId,
        username,
        email,
        displayName: displayName || username
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const user = await db.query.users.findFirst({
      where: eq(users.username, username)
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Set session
    req.session.userId = user.id;

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

// Get current user
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.session.userId!),
      columns: {
        id: true,
        username: true,
        email: true,
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

// Update current user
router.put('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const { displayName, email } = req.body;

    const updates: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date()
    };

    if (displayName !== undefined) {
      updates.displayName = displayName;
    }

    if (email !== undefined) {
      // Check if email is already taken
      const existingEmail = await db.query.users.findFirst({
        where: eq(users.email, email)
      });

      if (existingEmail && existingEmail.id !== req.session.userId) {
        return res.status(400).json({ error: 'Email already in use' });
      }

      updates.email = email;
    }

    await db.update(users)
      .set(updates)
      .where(eq(users.id, req.session.userId!));

    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, req.session.userId!),
      columns: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatarUrl: true
      }
    });

    res.json({ user: updatedUser });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password
router.put('/me/password', requireAuth, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, req.session.userId!)
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await db.update(users)
      .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
      .where(eq(users.id, req.session.userId!));

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
