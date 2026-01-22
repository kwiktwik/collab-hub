import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { credentials } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { checkProjectAccess } from '@/lib/auth';
import { encrypt } from '@/lib/encryption';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { projectId, name, value, type = 'other', description } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    if (!name || !value) {
      return NextResponse.json({ error: 'Name and value are required' }, { status: 400 });
    }

    const hasAccess = await checkProjectAccess(session.userId, projectId, 'write');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Write access required' }, { status: 403 });
    }

    // Encrypt the credential value
    const { encrypted, iv } = encrypt(value);

    const credentialId = uuidv4();

    await db.insert(credentials).values({
      id: credentialId,
      projectId,
      name,
      type,
      encryptedValue: encrypted,
      encryptionIv: iv,
      description,
      createdBy: session.userId
    });

    const credential = await db.query.credentials.findFirst({
      where: eq(credentials.id, credentialId),
      columns: {
        id: true,
        projectId: true,
        name: true,
        type: true,
        description: true,
        createdAt: true,
        updatedAt: true
      },
      with: {
        creator: {
          columns: { id: true, username: true, displayName: true }
        }
      }
    });

    return NextResponse.json({ credential }, { status: 201 });
  } catch (error) {
    console.error('Create credential error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
