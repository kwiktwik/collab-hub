import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { organizationInvites, organizationMembers, organizations, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { createNotification } from '@/lib/notifications';
import { checkOrgAccess } from '@/lib/org-access';

// GET - List pending invites
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
    const { hasAccess } = await checkOrgAccess(orgId, session.userId, 'admin');

    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const invites = await db.query.organizationInvites.findMany({
      where: and(
        eq(organizationInvites.organizationId, orgId),
        eq(organizationInvites.acceptedAt, null as any)
      ),
      with: {
        inviter: {
          columns: { id: true, username: true, displayName: true }
        }
      }
    });

    // Filter out expired invites
    const now = new Date();
    const activeInvites = invites.filter(i => new Date(i.expiresAt) > now);

    return NextResponse.json({ invites: activeInvites });
  } catch (error) {
    console.error('Get invites error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create invite
export async function POST(
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

    const { email, role = 'member' } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    if (!['admin', 'member'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Check if user is already a member
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase())
    });

    if (existingUser) {
      const existingMembership = await db.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, existingUser.id)
        )
      });

      if (existingMembership) {
        return NextResponse.json({ error: 'User is already a member' }, { status: 400 });
      }
    }

    // Check if invite already exists
    const existingInvite = await db.query.organizationInvites.findFirst({
      where: and(
        eq(organizationInvites.organizationId, orgId),
        eq(organizationInvites.email, email.toLowerCase())
      )
    });

    if (existingInvite && !existingInvite.acceptedAt && new Date(existingInvite.expiresAt) > new Date()) {
      return NextResponse.json({ error: 'Invite already pending for this email' }, { status: 400 });
    }

    // Create invite
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const inviteId = uuidv4();
    await db.insert(organizationInvites).values({
      id: inviteId,
      organizationId: orgId,
      email: email.toLowerCase(),
      role,
      invitedBy: session.userId,
      token,
      expiresAt
    });

    // If user already exists, notify them
    if (existingUser) {
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, orgId),
        columns: { name: true, slug: true }
      });

      await createNotification({
        userId: existingUser.id,
        type: 'invite',
        title: 'Organization Invite',
        message: `You've been invited to join "${org?.name}".`,
        link: `/invite/${token}`
      });
    }

    const newInvite = await db.query.organizationInvites.findFirst({
      where: eq(organizationInvites.id, inviteId),
      with: {
        inviter: {
          columns: { id: true, username: true, displayName: true }
        }
      }
    });

    return NextResponse.json({ 
      message: 'Invite sent successfully',
      invite: newInvite,
      inviteLink: `/invite/${token}`
    }, { status: 201 });
  } catch (error) {
    console.error('Create invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
