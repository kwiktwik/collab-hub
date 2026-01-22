import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { checkProjectAccess } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { documentId } = await params;

    const document = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
      with: {
        creator: {
          columns: { id: true, username: true, displayName: true }
        }
      }
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const hasAccess = await checkProjectAccess(session.userId, document.projectId, 'read');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({ document });
  } catch (error) {
    console.error('Get document error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { documentId } = await params;
    const { title, content, parentId, sortOrder } = await request.json();

    const document = await db.query.documents.findFirst({
      where: eq(documents.id, documentId)
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const hasAccess = await checkProjectAccess(session.userId, document.projectId, 'write');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Write access required' }, { status: 403 });
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

    return NextResponse.json({ document: updatedDocument });
  } catch (error) {
    console.error('Update document error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { documentId } = await params;

    const document = await db.query.documents.findFirst({
      where: eq(documents.id, documentId)
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const hasAccess = await checkProjectAccess(session.userId, document.projectId, 'write');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Write access required' }, { status: 403 });
    }

    await db.delete(documents).where(eq(documents.id, documentId));

    return NextResponse.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
