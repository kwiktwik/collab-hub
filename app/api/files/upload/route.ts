import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { files, folders } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { checkProjectAccess } from '@/lib/auth';
import { getStorage } from '@/lib/services/storage';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;
    const folderId = formData.get('folderId') as string | null;

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    const hasAccess = await checkProjectAccess(session.userId, projectId, 'write');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Write access required' }, { status: 403 });
    }

    // Verify folder exists if specified
    if (folderId) {
      const folder = await db.query.folders.findFirst({
        where: eq(folders.id, folderId)
      });

      if (!folder || folder.projectId !== projectId) {
        return NextResponse.json({ error: 'Invalid folder' }, { status: 400 });
      }
    }

    const storage = getStorage();
    const fileId = uuidv4();
    const fileExt = file.name.split('.').pop() || '';
    const storageKey = `projects/${projectId}/files/${fileId}.${fileExt}`;

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to storage
    await storage.upload(storageKey, buffer, file.type);

    // Save file record
    await db.insert(files).values({
      id: fileId,
      projectId,
      name: file.name,
      originalName: file.name,
      storageKey,
      mimeType: file.type,
      size: file.size,
      folderId: folderId || null,
      createdBy: session.userId
    });

    const savedFile = await db.query.files.findFirst({
      where: eq(files.id, fileId),
      with: {
        creator: {
          columns: { id: true, username: true, displayName: true }
        }
      }
    });

    return NextResponse.json({ file: savedFile }, { status: 201 });
  } catch (error) {
    console.error('Upload file error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
