import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { credentials } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { checkProjectAccess } from '@/lib/auth';
import { encrypt } from '@/lib/encryption';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ credentialId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { credentialId } = await params;
    const { name, value, type, description } = await request.json();

    const credential = await db.query.credentials.findFirst({
      where: eq(credentials.id, credentialId)
    });

    if (!credential) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    }

    const hasAccess = await checkProjectAccess(session.userId, credential.projectId, 'write');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Write access required' }, { status: 403 });
    }

    const updates: Partial<typeof credentials.$inferInsert> = {
      updatedAt: new Date()
    };

    if (name !== undefined) updates.name = name;
    if (type !== undefined) updates.type = type;
    if (description !== undefined) updates.description = description;
    
    if (value !== undefined) {
      const { encrypted, iv } = encrypt(value);
      updates.encryptedValue = encrypted;
      updates.encryptionIv = iv;
    }

    await db.update(credentials)
      .set(updates)
      .where(eq(credentials.id, credentialId));

    const updatedCredential = await db.query.credentials.findFirst({
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

    return NextResponse.json({ credential: updatedCredential });
  } catch (error) {
    console.error('Update credential error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ credentialId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { credentialId } = await params;

    const credential = await db.query.credentials.findFirst({
      where: eq(credentials.id, credentialId)
    });

    if (!credential) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    }

    const hasAccess = await checkProjectAccess(session.userId, credential.projectId, 'write');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Write access required' }, { status: 403 });
    }

    await db.delete(credentials).where(eq(credentials.id, credentialId));

    return NextResponse.json({ message: 'Credential deleted successfully' });
  } catch (error) {
    console.error('Delete credential error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
