import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { credentials } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { checkProjectAccess } from '@/lib/auth';
import { decrypt } from '@/lib/encryption';

export async function GET(
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

    const hasAccess = await checkProjectAccess(session.userId, credential.projectId, 'read');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Decrypt the value
    const decryptedValue = decrypt(credential.encryptedValue, credential.encryptionIv);

    return NextResponse.json({
      credential: {
        id: credential.id,
        name: credential.name,
        type: credential.type,
        value: decryptedValue
      }
    });
  } catch (error) {
    console.error('Get credential value error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
