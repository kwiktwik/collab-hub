import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { organizationInvites, organizationMembers, organizations, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { createNotification } from '@/lib/notifications';

// GET - Get invite details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const invite = await db.query.organizationInvites.findFirst({
      where: eq(organizationInvites.token, token),
      with: {
        organization: {
          columns: { id: true, name: true, slug: true, description: true }
        },
        inviter: {
          columns: { id: true, username: true, displayName: true }
        }
      }
    });

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    if (invite.acceptedAt) {
      return NextResponse.json({ error: 'Invite already used' }, { status: 400 });
    }

    if (new Date(invite.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Invite expired' }, { status: 400 });
    }

    return NextResponse.json({ invite });
  } catch (error) {
    console.error('Get invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Accept invite
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { token } = await params;

    const invite = await db.query.organizationInvites.findFirst({
      where: eq(organizationInvites.token, token),
      with: {
        organization: {
          columns: { id: true, name: true, slug: true }
        }
      }
    });

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    if (invite.acceptedAt) {
      return NextResponse.json({ error: 'Invite already used' }, { status: 400 });
    }

    if (new Date(invite.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Invite expired' }, { status: 400 });
    }

    // Verify email matches (if user has email)
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: { email: true }
    });

    if (currentUser?.email.toLowerCase() !== invite.email.toLowerCase()) {
      return NextResponse.json({ 
        error: 'This invite was sent to a different email address' 
      }, { status: 403 });
    }

    // Check if already a member
    const existingMembership = await db.query.organizationMembers.findFirst({
      where: eq(organizationMembers.userId, session.userId)
    });

    if (existingMembership?.organizationId === invite.organizationId) {
      return NextResponse.json({ error: 'You are already a member' }, { status: 400 });
    }

    // Accept invite
    await db.update(organizationInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(organizationInvites.id, invite.id));

    // Add as member
    await db.insert(organizationMembers).values({
      id: uuidv4(),
      organizationId: invite.organizationId,
      userId: session.userId,
      role: invite.role
    });

    // Notify the inviter
    await createNotification({
      userId: invite.invitedBy,
      type: 'success',
      title: 'Invite Accepted',
      message: `${currentUser?.email} has joined "${invite.organization?.name}".`,
      link: `/org/${invite.organization?.slug}/members`
    });

    return NextResponse.json({ 
      message: 'Successfully joined organization',
      organization: invite.organization
    });
  } catch (error) {
    console.error('Accept invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
