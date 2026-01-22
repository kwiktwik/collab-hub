import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { files, folders } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { checkProjectAccess } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { projectId } = await params;
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');

    const hasAccess = await checkProjectAccess(session.userId, projectId, 'read');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    let whereClause;
    if (folderId) {
      whereClause = and(
        eq(files.projectId, projectId),
        eq(files.folderId, folderId)
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

    return NextResponse.json({ files: projectFiles, folders: projectFolders });
  } catch (error) {
    console.error('Get files error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
