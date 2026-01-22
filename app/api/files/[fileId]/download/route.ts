import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { files } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { checkProjectAccess } from '@/lib/auth';
import { getStorage } from '@/lib/services/storage';

export async function GET(
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

    const hasAccess = await checkProjectAccess(session.userId, file.projectId, 'read');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const storage = getStorage();
    const buffer = await storage.download(file.storageKey);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': file.mimeType,
        'Content-Disposition': `attachment; filename="${file.originalName}"`,
        'Content-Length': file.size.toString()
      }
    });
  } catch (error) {
    console.error('Download file error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
