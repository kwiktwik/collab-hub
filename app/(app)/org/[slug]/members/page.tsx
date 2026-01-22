'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Users, Mail, UserPlus, Shield, Crown, Trash2 } from 'lucide-react';
import Modal from '@/components/Modal';

interface Member {
  id: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    email: string;
    avatarUrl: string | null;
  };
}

interface Invite {
  id: string;
  email: string;
  role: 'admin' | 'member';
  expiresAt: string;
  inviter: { displayName: string | null; username: string };
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  myRole: 'owner' | 'admin' | 'member';
}

export default function OrgMembersPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  
  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');
  const [inviteLink, setInviteLink] = useState('');

  useEffect(() => {
    loadOrg();
  }, [slug]);

  const loadOrg = async () => {
    try {
      // First get org by slug
      const orgsRes = await fetch('/api/organizations');
      const orgsData = await orgsRes.json();
      const organization = orgsData.organizations?.find((o: any) => o.slug === slug);
      
      if (!organization) {
        router.push('/dashboard');
        return;
      }

      setOrg(organization);

      // Load members
      const membersRes = await fetch(`/api/organizations/${organization.id}/members`);
      const membersData = await membersRes.json();
      setMembers(membersData.members || []);

      // Load invites if admin
      if (organization.myRole === 'owner' || organization.myRole === 'admin') {
        const invitesRes = await fetch(`/api/organizations/${organization.id}/invites`);
        const invitesData = await invitesRes.json();
        setInvites(invitesData.invites || []);
      }
    } catch (error) {
      console.error('Error loading organization:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      setError('Please enter a valid email');
      return;
    }

    setInviting(true);
    setError('');

    try {
      const res = await fetch(`/api/organizations/${org?.id}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to send invite');
        return;
      }

      setInviteLink(window.location.origin + data.inviteLink);
      setInviteEmail('');
      loadOrg();
    } catch (err) {
      setError('Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'member') => {
    try {
      const res = await fetch(`/api/organizations/${org?.id}/members/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });

      if (res.ok) {
        loadOrg();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update role');
      }
    } catch (error) {
      console.error('Error updating role:', error);
    }
  };

  const handleRemoveMember = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name} from ${org?.name}?`)) return;

    try {
      const res = await fetch(`/api/organizations/${org?.id}/members/${userId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        loadOrg();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to remove member');
      }
    } catch (error) {
      console.error('Error removing member:', error);
    }
  };

  const canManage = org?.myRole === 'owner' || org?.myRole === 'admin';

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner" />
      </div>
    );
  }

  if (!org) return null;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Members</h1>
          <p className="text-muted">{org.name} · {members.length} members</p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowInviteModal(true)}>
            <UserPlus size={18} />
            Invite People
          </button>
        )}
      </div>

      <div className="page-content">
        {/* Members List */}
        <div className="card">
          <div className="card-header">
            <h2>Team Members</h2>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    <th>Joined</th>
                    {canManage && <th style={{ width: '100px' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {members.map(member => (
                    <tr key={member.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, var(--primary-color), #ec4899)',
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 600
                            }}
                          >
                            {member.user.displayName?.[0]?.toUpperCase() || member.user.username[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500 }}>
                              {member.user.displayName || member.user.username}
                            </div>
                            <div className="text-sm text-muted">{member.user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          {member.role === 'owner' && <Crown size={14} color="#f59e0b" />}
                          {member.role === 'admin' && <Shield size={14} color="#8b5cf6" />}
                          <span className={`badge badge-${member.role === 'owner' ? 'warning' : member.role === 'admin' ? 'primary' : 'secondary'}`}>
                            {member.role}
                          </span>
                        </div>
                      </td>
                      <td className="text-muted">
                        {new Date(member.createdAt).toLocaleDateString()}
                      </td>
                      {canManage && (
                        <td>
                          {member.role !== 'owner' && (
                            <div className="flex gap-2">
                              <select
                                className="form-input"
                                value={member.role}
                                onChange={(e) => handleRoleChange(member.userId, e.target.value as any)}
                                style={{ width: '100px', padding: '0.375rem' }}
                              >
                                <option value="member">Member</option>
                                <option value="admin">Admin</option>
                              </select>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleRemoveMember(member.userId, member.user.displayName || member.user.username)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Pending Invites */}
        {canManage && invites.length > 0 && (
          <div className="card mt-4">
            <div className="card-header">
              <h2>Pending Invites</h2>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Invited By</th>
                      <th>Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map(invite => (
                      <tr key={invite.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <Mail size={16} className="text-muted" />
                            {invite.email}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-secondary">{invite.role}</span>
                        </td>
                        <td className="text-muted">
                          {invite.inviter.displayName || invite.inviter.username}
                        </td>
                        <td className="text-muted">
                          {new Date(invite.expiresAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => { 
          setShowInviteModal(false); 
          setInviteEmail(''); 
          setInviteLink(''); 
          setError(''); 
        }}
        title="Invite to Organization"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowInviteModal(false)}>
              Close
            </button>
            {!inviteLink && (
              <button className="btn btn-primary" onClick={handleInvite} disabled={inviting}>
                {inviting ? <span className="spinner" /> : 'Send Invite'}
              </button>
            )}
          </>
        }
      >
        {error && <div className="alert alert-error mb-4">{error}</div>}

        {inviteLink ? (
          <div>
            <div className="alert alert-success mb-4">
              Invite sent! Share this link with the invitee:
            </div>
            <div className="form-group">
              <input
                type="text"
                className="form-input"
                value={inviteLink}
                readOnly
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <div className="form-help">This link expires in 7 days.</div>
            </div>
            <button 
              className="btn btn-secondary"
              onClick={() => {
                navigator.clipboard.writeText(inviteLink);
                alert('Link copied!');
              }}
            >
              Copy Link
            </button>
          </div>
        ) : (
          <>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Role</label>
              <select
                className="form-input"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as any)}
              >
                <option value="member">Member - Can view and work on projects</option>
                <option value="admin">Admin - Can manage members and settings</option>
              </select>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
