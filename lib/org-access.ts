import { db } from '@/lib/db';
import { organizationMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export type OrgRole = 'member' | 'admin' | 'owner';

export async function checkOrgAccess(
  orgId: string, 
  userId: string, 
  requiredRole: OrgRole = 'member'
): Promise<{ hasAccess: boolean; role: OrgRole | null }> {
  const membership = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.organizationId, orgId),
      eq(organizationMembers.userId, userId)
    )
  });

  if (!membership) return { hasAccess: false, role: null };

  const roleOrder = { member: 0, admin: 1, owner: 2 };
  const hasAccess = roleOrder[membership.role] >= roleOrder[requiredRole];

  return { hasAccess, role: membership.role as OrgRole };
}

export async function getOrgMembership(orgId: string, userId: string) {
  return db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.organizationId, orgId),
      eq(organizationMembers.userId, userId)
    )
  });
}

export async function getUserOrganizations(userId: string) {
  return db.query.organizationMembers.findMany({
    where: eq(organizationMembers.userId, userId),
    with: {
      organization: true
    }
  });
}
