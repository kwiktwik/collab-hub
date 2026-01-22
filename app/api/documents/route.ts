import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { checkProjectAccess } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { projectId, title, content, parentId } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const hasAccess = await checkProjectAccess(session.userId, projectId, 'write');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Write access required' }, { status: 403 });
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
      createdBy: session.userId
    });

    const document = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
      with: {
        creator: {
          columns: { id: true, username: true, displayName: true }
        }
      }
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    console.error('Create document error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
