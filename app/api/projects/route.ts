import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { projects, projectGroups, groupMembers, organizationMembers, groups } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { checkOrgAccess } from '@/lib/org-access';

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
      return NextResponse.json({ projects: [] });
    }

    // Get all groups user is a member of
    const userGroups = await db.query.groupMembers.findMany({
      where: eq(groupMembers.userId, session.userId),
      columns: { groupId: true }
    });

    if (userGroups.length === 0) {
      return NextResponse.json({ projects: [] });
    }

    const groupIds = userGroups.map(g => g.groupId);

    // Get all projects these groups have access to
    const projectAccessList = await db.query.projectGroups.findMany({
      where: inArray(projectGroups.groupId, groupIds),
      with: {
        project: {
          with: {
            organization: {
              columns: { id: true, name: true, slug: true }
            },
            creator: {
              columns: { id: true, username: true, displayName: true }
            }
          }
        },
        group: {
          columns: { id: true, name: true }
        }
      }
    });

    // Deduplicate projects and aggregate access info
    const projectMap = new Map();
    for (const access of projectAccessList) {
      // Only include projects from user's orgs
      if (!orgIds.includes(access.project.organizationId)) continue;
      
      if (!projectMap.has(access.projectId)) {
        projectMap.set(access.projectId, {
          ...access.project,
          accessGroups: []
        });
      }
      projectMap.get(access.projectId).accessGroups.push({
        group: access.group,
        permissionLevel: access.permissionLevel
      });
    }

    let userProjects = Array.from(projectMap.values());

    // Filter by org if specified
    if (orgId) {
      userProjects = userProjects.filter(p => p.organizationId === orgId);
    }

    return NextResponse.json({ projects: userProjects });
  } catch (error) {
    console.error('Get projects error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { name, description, groupId, organizationId } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization is required' }, { status: 400 });
    }

    if (!groupId) {
      return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
    }

    // Verify user is member of organization
    const { hasAccess } = await checkOrgAccess(organizationId, session.userId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    // Verify group belongs to organization
    const group = await db.query.groups.findFirst({
      where: and(eq(groups.id, groupId), eq(groups.organizationId, organizationId))
    });
    if (!group) {
      return NextResponse.json({ error: 'Group not found in this organization' }, { status: 400 });
    }

    // Check if user is admin of the group
    const membership = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, session.userId),
        eq(groupMembers.role, 'admin')
      )
    });

    if (!membership) {
      return NextResponse.json({ error: 'Admin access to group required' }, { status: 403 });
    }

    const projectId = uuidv4();

    // Create project
    await db.insert(projects).values({
      id: projectId,
      organizationId,
      name,
      description,
      createdBy: session.userId
    });

    // Attach project to group with admin access
    await db.insert(projectGroups).values({
      id: uuidv4(),
      projectId,
      groupId,
      permissionLevel: 'admin'
    });

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      with: {
        organization: {
          columns: { id: true, name: true, slug: true }
        },
        groupAccess: {
          with: {
            group: {
              columns: { id: true, name: true }
            }
          }
        }
      }
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('Create project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
