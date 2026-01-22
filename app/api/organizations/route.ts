import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { organizations, organizationMembers } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getSession } from '@/lib/session';

// Helper to create URL-friendly slug
function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

// GET - List user's organizations
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get organizations where user is a member
    const memberships = await db.query.organizationMembers.findMany({
      where: eq(organizationMembers.userId, session.userId),
      with: {
        organization: {
          with: {
            creator: {
              columns: { id: true, username: true, displayName: true }
            }
          }
        }
      },
      orderBy: desc(organizationMembers.createdAt)
    });

    const orgs = memberships.map(m => ({
      ...m.organization,
      myRole: m.role
    }));

    return NextResponse.json({ organizations: orgs });
  } catch (error) {
    console.error('Get organizations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new organization
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { name, description } = await request.json();

    if (!name || name.trim().length < 2) {
      return NextResponse.json({ error: 'Organization name must be at least 2 characters' }, { status: 400 });
    }

    // Generate unique slug
    let slug = createSlug(name);
    let slugExists = await db.query.organizations.findFirst({
      where: eq(organizations.slug, slug)
    });

    // If slug exists, append a number
    let counter = 1;
    const baseSlug = slug;
    while (slugExists) {
      slug = `${baseSlug}-${counter}`;
      counter++;
      slugExists = await db.query.organizations.findFirst({
        where: eq(organizations.slug, slug)
      });
    }

    // Create organization
    const orgId = uuidv4();
    await db.insert(organizations).values({
      id: orgId,
      name: name.trim(),
      slug,
      description: description?.trim() || null,
      createdBy: session.userId
    });

    // Add creator as owner
    await db.insert(organizationMembers).values({
      id: uuidv4(),
      organizationId: orgId,
      userId: session.userId,
      role: 'owner'
    });

    const newOrg = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      with: {
        creator: {
          columns: { id: true, username: true, displayName: true }
        }
      }
    });

    return NextResponse.json({ 
      message: 'Organization created successfully',
      organization: { ...newOrg, myRole: 'owner' }
    }, { status: 201 });
  } catch (error) {
    console.error('Create organization error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
