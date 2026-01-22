import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { groups, groupMembers, organizationMembers } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('organizationId');

    // Get user's organizations
    const userOrgMemberships = await db.query.organizationMembers.findMany({
      where: eq(organizationMembers.userId, session.userId),
      columns: { organizationId: true }
    });
    const orgIds = userOrgMemberships.map(m => m.organizationId);

    if (orgIds.length === 0) {
      return NextResponse.json({ groups: [] });
    }

    // Get groups in user's organizations where user is a member
    const userGroupMemberships = await db.query.groupMembers.findMany({
      where: eq(groupMembers.userId, session.userId),
      with: {
        group: {
          with: {
            organization: {
              columns: { id: true, name: true, slug: true }
            },
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
    });

    let userGroups = userGroupMemberships
      .filter(m => orgIds.includes(m.group.organizationId))
      .map(m => ({
        ...m.group,
        myRole: m.role,
        memberCount: m.group.members.length
      }));

    // Filter by org if specified
    if (orgId) {
      userGroups = userGroups.filter(g => g.organizationId === orgId);
    }

    return NextResponse.json({ groups: userGroups });
  } catch (error) {
    console.error('Get groups error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { name, description, organizationId } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
    }

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization is required' }, { status: 400 });
    }

    // Verify user is an admin/owner of the organization
    const orgMembership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, session.userId)
      )
    });

    if (!orgMembership || orgMembership.role === 'member') {
      return NextResponse.json({ 
        error: 'You must be an admin of the organization to create groups' 
      }, { status: 403 });
    }

    const groupId = uuidv4();
    
    await db.insert(groups).values({
      id: groupId,
      organizationId,
      name,
      description,
      createdBy: session.userId
    });

    // Add creator as admin member
    await db.insert(groupMembers).values({
      id: uuidv4(),
      groupId,
      userId: session.userId,
      role: 'admin'
    });

    const group = await db.query.groups.findFirst({
      where: eq(groups.id, groupId),
      with: {
        organization: {
          columns: { id: true, name: true, slug: true }
        },
        members: {
          with: {
            user: {
              columns: { id: true, username: true, displayName: true }
            }
          }
        }
      }
    });

    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    console.error('Create group error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
