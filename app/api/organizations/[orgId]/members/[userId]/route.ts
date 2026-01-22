import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { organizationMembers, organizations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { createNotification } from '@/lib/notifications';
import { checkOrgAccess } from '@/lib/org-access';

// PUT - Update member role
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { orgId, userId } = await params;
    const { hasAccess, role: myRole } = await checkOrgAccess(orgId, session.userId, 'admin');

    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { role } = await request.json();

    if (!['admin', 'member'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Use admin or member.' }, { status: 400 });
    }

    // Get target user's current role
    const targetMembership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, userId)
      )
    });

    if (!targetMembership) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Can't change owner's role
    if (targetMembership.role === 'owner') {
      return NextResponse.json({ error: 'Cannot change owner role' }, { status: 400 });
    }

    // Only owner can change admin roles
    if (targetMembership.role === 'admin' && myRole !== 'owner') {
      return NextResponse.json({ error: 'Only owner can change admin roles' }, { status: 403 });
    }

    await db.update(organizationMembers)
      .set({ role })
      .where(and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, userId)
      ));

    // Notify user
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      columns: { name: true, slug: true }
    });

    await createNotification({
      userId,
      type: 'info',
      title: 'Role Updated',
      message: `Your role in "${org?.name}" has been changed to ${role}.`,
      link: `/org/${org?.slug}`
    });

    return NextResponse.json({ message: 'Role updated successfully' });
  } catch (error) {
    console.error('Update member role error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove member from organization
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { orgId, userId } = await params;
    
    // User can leave themselves, or admin can remove others
    const isSelf = userId === session.userId;
    
    if (!isSelf) {
      const { hasAccess } = await checkOrgAccess(orgId, session.userId, 'admin');
      if (!hasAccess) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
    }

    const targetMembership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, userId)
      )
    });

    if (!targetMembership) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Owner cannot be removed
    if (targetMembership.role === 'owner') {
      return NextResponse.json({ error: 'Owner cannot be removed. Transfer ownership first.' }, { status: 400 });
    }

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      columns: { name: true }
    });

    await db.delete(organizationMembers)
      .where(and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, userId)
      ));

    // Notify user if removed by someone else
    if (!isSelf) {
      await createNotification({
        userId,
        type: 'warning',
        title: 'Removed from Organization',
        message: `You have been removed from "${org?.name}".`
      });
    }

    return NextResponse.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
