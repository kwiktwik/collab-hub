import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { files, folders } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { checkProjectAccess } from '@/lib/auth';
import { getStorage } from '@/lib/services/storage';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ folderId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { folderId } = await params;
    const { name, parentId } = await request.json();

    const folder = await db.query.folders.findFirst({
      where: eq(folders.id, folderId)
    });

    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    const hasAccess = await checkProjectAccess(session.userId, folder.projectId, 'write');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Write access required' }, { status: 403 });
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

    return NextResponse.json({ folder: updatedFolder });
  } catch (error) {
    console.error('Update folder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ folderId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { folderId } = await params;

    const folder = await db.query.folders.findFirst({
      where: eq(folders.id, folderId)
    });

    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    const hasAccess = await checkProjectAccess(session.userId, folder.projectId, 'write');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Write access required' }, { status: 403 });
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

    return NextResponse.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    console.error('Delete folder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
