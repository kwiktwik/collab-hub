import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
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

    const hasAccess = await checkProjectAccess(session.userId, projectId, 'read');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
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

    return NextResponse.json({ documents: documentTree, flatList: projectDocuments });
  } catch (error) {
    console.error('Get documents error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
