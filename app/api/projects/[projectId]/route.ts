import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
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

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      with: {
        creator: {
          columns: { id: true, username: true, displayName: true }
        },
        groupAccess: {
          with: {
            group: {
              with: {
                members: {
                  with: {
                    user: {
                      columns: { id: true, username: true, displayName: true }
                    }
                  }
                }
              }
            }
          }
        },
        documents: {
          columns: { id: true, title: true, parentId: true, sortOrder: true, createdAt: true }
        },
        folders: {
          columns: { id: true, name: true, parentId: true }
        }
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Get project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { projectId } = await params;
    const { name, description, status } = await request.json();

    const hasAccess = await checkProjectAccess(session.userId, projectId, 'admin');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const updates: Partial<typeof projects.$inferInsert> = {
      updatedAt: new Date()
    };

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;

    await db.update(projects)
      .set(updates)
      .where(eq(projects.id, projectId));

    const updatedProject = await db.query.projects.findFirst({
      where: eq(projects.id, projectId)
    });

    return NextResponse.json({ project: updatedProject });
  } catch (error) {
    console.error('Update project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { projectId } = await params;

    const hasAccess = await checkProjectAccess(session.userId, projectId, 'admin');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    await db.delete(projects).where(eq(projects.id, projectId));

    return NextResponse.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
