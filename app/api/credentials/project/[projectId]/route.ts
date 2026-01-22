import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { credentials } from '@/lib/db/schema';
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

    const projectCredentials = await db.query.credentials.findMany({
      where: eq(credentials.projectId, projectId),
      columns: {
        id: true,
        projectId: true,
        name: true,
        type: true,
        description: true,
        createdAt: true,
        updatedAt: true
        // Explicitly exclude encryptedValue and encryptionIv
      },
      with: {
        creator: {
          columns: { id: true, username: true, displayName: true }
        }
      }
    });

    return NextResponse.json({ credentials: projectCredentials });
  } catch (error) {
    console.error('Get credentials error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
