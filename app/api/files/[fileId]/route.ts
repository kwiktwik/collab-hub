import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { files } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { checkProjectAccess } from '@/lib/auth';
import { getStorage } from '@/lib/services/storage';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { fileId } = await params;
    const { name, folderId } = await request.json();

    const file = await db.query.files.findFirst({
      where: eq(files.id, fileId)
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const hasAccess = await checkProjectAccess(session.userId, file.projectId, 'write');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Write access required' }, { status: 403 });
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

    return NextResponse.json({ file: updatedFile });
  } catch (error) {
    console.error('Update file error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { fileId } = await params;

    const file = await db.query.files.findFirst({
      where: eq(files.id, fileId)
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const hasAccess = await checkProjectAccess(session.userId, file.projectId, 'write');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Write access required' }, { status: 403 });
    }

    // Delete from storage
    const storage = getStorage();
    await storage.delete(file.storageKey);

    // Delete from database
    await db.delete(files).where(eq(files.id, fileId));

    return NextResponse.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
