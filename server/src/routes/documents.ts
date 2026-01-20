import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { documents } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth, checkProjectAccess } from '../middleware/auth.js';

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// Create a new document
router.post('/', async (req: Request, res: Response) => {
  try {
    const { projectId, title, content, parentId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const hasAccess = await checkProjectAccess(req.user!.id, projectId, 'write');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Write access required' });
    }

    // Get max sort order for sibling documents
    const siblings = await db.query.documents.findMany({
      where: and(
        eq(documents.projectId, projectId),
        parentId ? eq(documents.parentId, parentId) : undefined
      ),
      columns: { sortOrder: true }
    });

    const maxSortOrder = siblings.reduce((max, doc) => Math.max(max, doc.sortOrder), 0);

    const documentId = uuidv4();

    await db.insert(documents).values({
      id: documentId,
      projectId,
      title,
      content: content || '',
      parentId: parentId || null,
      sortOrder: maxSortOrder + 1,
      createdBy: req.user!.id
    });

    const document = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
      with: {
        creator: {
          columns: { id: true, username: true, displayName: true }
        }
      }
    });

    res.status(201).json({ document });
  } catch (error) {
    console.error('Create document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all documents in a project
router.get('/project/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    const hasAccess = await checkProjectAccess(req.user!.id, projectId, 'read');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const projectDocuments = await db.query.documents.findMany({
      where: eq(documents.projectId, projectId),
      with: {
        creator: {
          columns: { id: true, username: true, displayName: true }
        }
      },
      orderBy: (documents, { asc }) => [asc(documents.sortOrder)]
    });

    // Build tree structure
    const buildTree = (parentId: string | null): any[] => {
      return projectDocuments
        .filter(doc => doc.parentId === parentId)
        .map(doc => ({
          ...doc,
          children: buildTree(doc.id)
        }));
    };

    const documentTree = buildTree(null);

    res.json({ documents: documentTree, flatList: projectDocuments });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific document
router.get('/:documentId', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;

    const document = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
      with: {
        creator: {
          columns: { id: true, username: true, displayName: true }
        }
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const hasAccess = await checkProjectAccess(req.user!.id, document.projectId, 'read');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ document });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a document
router.put('/:documentId', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const { title, content, parentId, sortOrder } = req.body;

    const document = await db.query.documents.findFirst({
      where: eq(documents.id, documentId)
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const hasAccess = await checkProjectAccess(req.user!.id, document.projectId, 'write');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Write access required' });
    }

    const updates: Partial<typeof documents.$inferInsert> = {
      updatedAt: new Date()
    };

    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (parentId !== undefined) updates.parentId = parentId;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;

    await db.update(documents)
      .set(updates)
      .where(eq(documents.id, documentId));

    const updatedDocument = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
      with: {
        creator: {
          columns: { id: true, username: true, displayName: true }
        }
      }
    });

    res.json({ document: updatedDocument });
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a document
router.delete('/:documentId', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;

    const document = await db.query.documents.findFirst({
      where: eq(documents.id, documentId)
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const hasAccess = await checkProjectAccess(req.user!.id, document.projectId, 'write');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Write access required' });
    }

    // Delete document and all children (cascade happens in DB)
    await db.delete(documents).where(eq(documents.id, documentId));

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reorder documents
router.post('/reorder', async (req: Request, res: Response) => {
  try {
    const { projectId, orders } = req.body;

    if (!projectId || !orders || !Array.isArray(orders)) {
      return res.status(400).json({ error: 'Project ID and orders array required' });
    }

    const hasAccess = await checkProjectAccess(req.user!.id, projectId, 'write');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Write access required' });
    }

    // Update each document's sort order
    for (const order of orders) {
      await db.update(documents)
        .set({ sortOrder: order.sortOrder, parentId: order.parentId || null })
        .where(eq(documents.id, order.id));
    }

    res.json({ message: 'Documents reordered successfully' });
  } catch (error) {
    console.error('Reorder documents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
