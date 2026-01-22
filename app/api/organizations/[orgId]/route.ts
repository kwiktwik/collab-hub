import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { organizations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { checkOrgAccess } from '@/lib/org-access';

// GET - Get organization details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { orgId } = await params;
    const { hasAccess, role } = await checkOrgAccess(orgId, session.userId);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      with: {
        creator: {
          columns: { id: true, username: true, displayName: true }
        },
        members: {
          with: {
            user: {
              columns: { id: true, username: true, displayName: true, email: true, avatarUrl: true }
            }
          }
        }
      }
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      organization: { ...org, myRole: role }
    });
  } catch (error) {
    console.error('Get organization error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update organization
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { orgId } = await params;
    const { hasAccess } = await checkOrgAccess(orgId, session.userId, 'admin');

    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { name, description } = await request.json();

    const updates: any = { updatedAt: new Date() };
    if (name) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;

    await db.update(organizations)
      .set(updates)
      .where(eq(organizations.id, orgId));

    const updatedOrg = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId)
    });

    return NextResponse.json({ 
      message: 'Organization updated successfully',
      organization: updatedOrg 
    });
  } catch (error) {
    console.error('Update organization error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete organization
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { orgId } = await params;
    const { hasAccess, role } = await checkOrgAccess(orgId, session.userId, 'owner');

    if (!hasAccess || role !== 'owner') {
      return NextResponse.json({ error: 'Only the owner can delete the organization' }, { status: 403 });
    }

    await db.delete(organizations).where(eq(organizations.id, orgId));

    return NextResponse.json({ message: 'Organization deleted successfully' });
  } catch (error) {
    console.error('Delete organization error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
