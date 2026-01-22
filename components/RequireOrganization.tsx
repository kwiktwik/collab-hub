'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { Building2, Plus } from 'lucide-react';

interface RequireOrganizationProps {
  hasOrg: boolean;
  children: ReactNode;
}

export default function RequireOrganization({ hasOrg, children }: RequireOrganizationProps) {
  if (!hasOrg) {
    return (
      <div className="empty-state" style={{ marginTop: '4rem' }}>
        <div className="empty-state-icon" style={{ background: 'linear-gradient(135deg, var(--primary-color), #ec4899)' }}>
          <Building2 size={32} />
        </div>
        <h2>Create Your First Organization</h2>
        <p>Organizations are workspaces where you and your team can collaborate on projects, boards, and more.</p>
        <Link href="/organizations/new" className="btn btn-primary btn-lg">
          <Plus size={18} />
          Create Organization
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
