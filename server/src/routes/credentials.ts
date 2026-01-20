import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { credentials } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth, checkProjectAccess } from '../middleware/auth.js';
import { encrypt, decrypt } from '../utils/encryption.js';

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// Create a new credential
router.post('/', async (req: Request, res: Response) => {
  try {
    const { projectId, name, value, type = 'other', description } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    if (!name || !value) {
      return res.status(400).json({ error: 'Name and value are required' });
    }

    const hasAccess = await checkProjectAccess(req.user!.id, projectId, 'write');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Write access required' });
    }

    // Encrypt the credential value
    const { encrypted, iv } = encrypt(value);

    const credentialId = uuidv4();

    await db.insert(credentials).values({
      id: credentialId,
      projectId,
      name,
      type,
      encryptedValue: encrypted,
      encryptionIv: iv,
      description,
      createdBy: req.user!.id
    });

    const credential = await db.query.credentials.findFirst({
      where: eq(credentials.id, credentialId),
      columns: {
        id: true,
        projectId: true,
        name: true,
        type: true,
        description: true,
        createdAt: true,
        updatedAt: true
      },
      with: {
        creator: {
          columns: { id: true, username: true, displayName: true }
        }
      }
    });

    res.status(201).json({ credential });
  } catch (error) {
    console.error('Create credential error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all credentials in a project (without values)
router.get('/project/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    const hasAccess = await checkProjectAccess(req.user!.id, projectId, 'read');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const projectCredentials = await db.query.credentials.findMany({
      where: eq(credentials.projectId, projectId),
      columns: {
        id: true,
        projectId: true,
        name: true,
        type: true,
        description: true,
        createdAt: true,
        updatedAt: true
        // Explicitly exclude encryptedValue and encryptionIv
      },
      with: {
        creator: {
          columns: { id: true, username: true, displayName: true }
        }
      }
    });

    res.json({ credentials: projectCredentials });
  } catch (error) {
    console.error('Get credentials error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a credential's decrypted value
router.get('/:credentialId/value', async (req: Request, res: Response) => {
  try {
    const { credentialId } = req.params;

    const credential = await db.query.credentials.findFirst({
      where: eq(credentials.id, credentialId)
    });

    if (!credential) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    const hasAccess = await checkProjectAccess(req.user!.id, credential.projectId, 'read');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Decrypt the value
    const decryptedValue = decrypt(credential.encryptedValue, credential.encryptionIv);

    res.json({
      credential: {
        id: credential.id,
        name: credential.name,
        type: credential.type,
        value: decryptedValue
      }
    });
  } catch (error) {
    console.error('Get credential value error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a credential
router.put('/:credentialId', async (req: Request, res: Response) => {
  try {
    const { credentialId } = req.params;
    const { name, value, type, description } = req.body;

    const credential = await db.query.credentials.findFirst({
      where: eq(credentials.id, credentialId)
    });

    if (!credential) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    const hasAccess = await checkProjectAccess(req.user!.id, credential.projectId, 'write');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Write access required' });
    }

    const updates: Partial<typeof credentials.$inferInsert> = {
      updatedAt: new Date()
    };

    if (name !== undefined) updates.name = name;
    if (type !== undefined) updates.type = type;
    if (description !== undefined) updates.description = description;
    
    if (value !== undefined) {
      const { encrypted, iv } = encrypt(value);
      updates.encryptedValue = encrypted;
      updates.encryptionIv = iv;
    }

    await db.update(credentials)
      .set(updates)
      .where(eq(credentials.id, credentialId));

    const updatedCredential = await db.query.credentials.findFirst({
      where: eq(credentials.id, credentialId),
      columns: {
        id: true,
        projectId: true,
        name: true,
        type: true,
        description: true,
        createdAt: true,
        updatedAt: true
      },
      with: {
        creator: {
          columns: { id: true, username: true, displayName: true }
        }
      }
    });

    res.json({ credential: updatedCredential });
  } catch (error) {
    console.error('Update credential error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a credential
router.delete('/:credentialId', async (req: Request, res: Response) => {
  try {
    const { credentialId } = req.params;

    const credential = await db.query.credentials.findFirst({
      where: eq(credentials.id, credentialId)
    });

    if (!credential) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    const hasAccess = await checkProjectAccess(req.user!.id, credential.projectId, 'write');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Write access required' });
    }

    await db.delete(credentials).where(eq(credentials.id, credentialId));

    res.json({ message: 'Credential deleted successfully' });
  } catch (error) {
    console.error('Delete credential error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
