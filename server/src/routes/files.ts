import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import { db } from '../db/index.js';
import { files, folders } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth, checkProjectAccess } from '../middleware/auth.js';
import { getStorage } from '../services/storage/index.js';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Apply auth middleware to all routes
router.use(requireAuth);

// Upload a file
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { projectId, folderId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const hasAccess = await checkProjectAccess(req.user!.id, projectId, 'write');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Write access required' });
    }

    // Verify folder exists if specified
    if (folderId) {
      const folder = await db.query.folders.findFirst({
        where: eq(folders.id, folderId)
      });

      if (!folder || folder.projectId !== projectId) {
        return res.status(400).json({ error: 'Invalid folder' });
      }
    }

    const storage = getStorage();
    const fileId = uuidv4();
    const fileExt = path.extname(req.file.originalname);
    const storageKey = `projects/${projectId}/files/${fileId}${fileExt}`;

    // Upload to storage
    await storage.upload(storageKey, req.file.buffer, req.file.mimetype);

    // Save file record
    await db.insert(files).values({
      id: fileId,
      projectId,
      name: req.file.originalname,
      originalName: req.file.originalname,
      storageKey,
      mimeType: req.file.mimetype,
      size: req.file.size,
      folderId: folderId || null,
      createdBy: req.user!.id
    });

    const file = await db.query.files.findFirst({
      where: eq(files.id, fileId),
      with: {
        creator: {
          columns: { id: true, username: true, displayName: true }
        }
      }
    });

    res.status(201).json({ file });
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all files in a project
router.get('/project/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { folderId } = req.query;

    const hasAccess = await checkProjectAccess(req.user!.id, projectId, 'read');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let whereClause;
    if (folderId) {
      whereClause = and(
        eq(files.projectId, projectId),
        eq(files.folderId, folderId as string)
      );
    } else {
      whereClause = eq(files.projectId, projectId);
    }

    const projectFiles = await db.query.files.findMany({
      where: whereClause,
      with: {
        creator: {
          columns: { id: true, username: true, displayName: true }
        },
        folder: {
          columns: { id: true, name: true }
        }
      }
    });

    // Get folders
    const projectFolders = await db.query.folders.findMany({
      where: eq(folders.projectId, projectId),
      with: {
        creator: {
          columns: { id: true, username: true, displayName: true }
        }
      }
    });

    res.json({ files: projectFiles, folders: projectFolders });
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download a file
router.get('/:fileId/download', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;

    const file = await db.query.files.findFirst({
      where: eq(files.id, fileId)
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const hasAccess = await checkProjectAccess(req.user!.id, file.projectId, 'read');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const storage = getStorage();
    const stream = await storage.getStream(file.storageKey);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.setHeader('Content-Length', file.size);

    stream.pipe(res);
  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get download URL
router.get('/:fileId/url', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;

    const file = await db.query.files.findFirst({
      where: eq(files.id, fileId)
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const hasAccess = await checkProjectAccess(req.user!.id, file.projectId, 'read');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const storage = getStorage();
    const url = await storage.getSignedUrl(file.storageKey, 3600);

    res.json({ url, expiresIn: 3600 });
  } catch (error) {
    console.error('Get file URL error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rename a file
router.put('/:fileId', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const { name, folderId } = req.body;

    const file = await db.query.files.findFirst({
      where: eq(files.id, fileId)
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const hasAccess = await checkProjectAccess(req.user!.id, file.projectId, 'write');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Write access required' });
    }

    const updates: Partial<typeof files.$inferInsert> = {};

    if (name !== undefined) updates.name = name;
    if (folderId !== undefined) updates.folderId = folderId;

    await db.update(files)
      .set(updates)
      .where(eq(files.id, fileId));

    const updatedFile = await db.query.files.findFirst({
      where: eq(files.id, fileId),
      with: {
        creator: {
          columns: { id: true, username: true, displayName: true }
        },
        folder: {
          columns: { id: true, name: true }
        }
      }
    });

    res.json({ file: updatedFile });
  } catch (error) {
    console.error('Update file error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a file
router.delete('/:fileId', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;

    const file = await db.query.files.findFirst({
      where: eq(files.id, fileId)
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const hasAccess = await checkProjectAccess(req.user!.id, file.projectId, 'write');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Write access required' });
    }

    // Delete from storage
    const storage = getStorage();
    await storage.delete(file.storageKey);

    // Delete from database
    await db.delete(files).where(eq(files.id, fileId));

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a folder
router.post('/folders', async (req: Request, res: Response) => {
  try {
    const { projectId, name, parentId } = req.body;

    if (!projectId || !name) {
      return res.status(400).json({ error: 'Project ID and name are required' });
    }

    const hasAccess = await checkProjectAccess(req.user!.id, projectId, 'write');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Write access required' });
    }

    const folderId = uuidv4();

    await db.insert(folders).values({
      id: folderId,
      projectId,
      name,
      parentId: parentId || null,
      createdBy: req.user!.id
    });

    const folder = await db.query.folders.findFirst({
      where: eq(folders.id, folderId),
      with: {
        creator: {
          columns: { id: true, username: true, displayName: true }
        }
      }
    });

    res.status(201).json({ folder });
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a folder
router.put('/folders/:folderId', async (req: Request, res: Response) => {
  try {
    const { folderId } = req.params;
    const { name, parentId } = req.body;

    const folder = await db.query.folders.findFirst({
      where: eq(folders.id, folderId)
    });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const hasAccess = await checkProjectAccess(req.user!.id, folder.projectId, 'write');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Write access required' });
    }

    const updates: Partial<typeof folders.$inferInsert> = {};

    if (name !== undefined) updates.name = name;
    if (parentId !== undefined) updates.parentId = parentId;

    await db.update(folders)
      .set(updates)
      .where(eq(folders.id, folderId));

    const updatedFolder = await db.query.folders.findFirst({
      where: eq(folders.id, folderId)
    });

    res.json({ folder: updatedFolder });
  } catch (error) {
    console.error('Update folder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a folder
router.delete('/folders/:folderId', async (req: Request, res: Response) => {
  try {
    const { folderId } = req.params;

    const folder = await db.query.folders.findFirst({
      where: eq(folders.id, folderId)
    });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const hasAccess = await checkProjectAccess(req.user!.id, folder.projectId, 'write');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Write access required' });
    }

    // Get all files in this folder
    const folderFiles = await db.query.files.findMany({
      where: eq(files.folderId, folderId)
    });

    // Delete files from storage
    const storage = getStorage();
    for (const file of folderFiles) {
      await storage.delete(file.storageKey);
    }

    // Delete files from database
    await db.delete(files).where(eq(files.folderId, folderId));

    // Delete folder
    await db.delete(folders).where(eq(folders.id, folderId));

    res.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
