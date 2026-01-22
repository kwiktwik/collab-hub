'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Users, 
  Folder, 
  Plus, 
  Trash2,
  UserMinus,
  Search
} from 'lucide-react';
import Modal from '@/components/Modal';
import type { Group, GroupMember, User } from '@/lib/types';

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.groupId as string;
  
  const [group, setGroup] = useState<Group | null>(null);
  const [myRole, setMyRole] = useState<'admin' | 'member'>('member');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Add member
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newMemberRole, setNewMemberRole] = useState<'admin' | 'member'>('member');
  const [adding, setAdding] = useState(false);
  
  const [error, setError] = useState('');

  useEffect(() => {
    if (groupId) {
      loadGroup();
      loadCurrentUser();
    }
  }, [groupId]);

  useEffect(() => {
    const timer = setTimeout(handleSearchUsers, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      setCurrentUser(data.user);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const loadGroup = async () => {
    try {
      const res = await fetch(`/api/groups/${groupId}`);
      if (!res.ok) {
        router.push('/groups');
        return;
      }
      const data = await res.json();
      setGroup(data.group);
      setMyRole(data.myRole);
    } catch (error) {
      console.error('Error loading group:', error);
      router.push('/groups');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchUsers = async () => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setSearching(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      // Filter out existing members
      const memberIds = new Set(group?.members?.map(m => m.userId));
      setSearchResults((data.users || []).filter((u: User) => !memberIds.has(u.id)));
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUser) return;
    
    setAdding(true);
    setError('');
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: selectedUser.id, 
          role: newMemberRole 
        })
      });
      
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to add member');
        return;
      }
      
      await loadGroup();
      setShowAddModal(false);
      setSelectedUser(null);
      setSearchQuery('');
      setSearchResults([]);
      setNewMemberRole('member');
    } catch (err: any) {
      setError('Failed to add member');
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: 'admin' | 'member') => {
    try {
      await fetch(`/api/groups/${groupId}/members/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      await loadGroup();
    } catch (err: any) {
      alert('Failed to update role');
    }
  };

  const handleRemoveMember = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to remove ${username} from this group?`)) return;
    
    try {
      await fetch(`/api/groups/${groupId}/members/${userId}`, { method: 'DELETE' });
      await loadGroup();
    } catch (err: any) {
      alert('Failed to remove member');
    }
  };

  const handleDeleteGroup = async () => {
    if (!confirm('Are you sure you want to delete this group? This action cannot be undone.')) return;
    
    try {
      await fetch(`/api/groups/${groupId}`, { method: 'DELETE' });
      router.push('/groups');
    } catch (err: any) {
      alert('Failed to delete group');
    }
  };

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <h3>Group not found</h3>
          <Link href="/groups" className="btn btn-primary">Back to Groups</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="flex items-center gap-4">
          <button className="btn btn-ghost btn-icon" onClick={() => router.push('/groups')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1>{group.name}</h1>
              <span className={`badge badge-${myRole === 'admin' ? 'primary' : 'secondary'}`}>
                {myRole}
              </span>
            </div>
            {group.description && (
              <p className="text-muted text-sm mt-2">{group.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Members */}
        <div className="card mb-4">
          <div className="card-header">
            <h3 className="card-title">
              <Users size={18} style={{ marginRight: '0.5rem' }} />
              Members ({group.members?.length || 0})
            </h3>
            {myRole === 'admin' && (
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => setShowAddModal(true)}
              >
                <Plus size={16} />
                Add Member
              </button>
            )}
          </div>
          <div className="card-body">
            {group.members && group.members.length > 0 ? (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      {myRole === 'admin' && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {group.members.map(member => (
                      <tr key={member.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <div 
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                background: 'var(--primary-color)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 600,
                                fontSize: '0.875rem'
                              }}
                            >
                              {member.user?.displayName?.[0]?.toUpperCase() || member.user?.username?.[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 500 }}>
                                {member.user?.displayName || member.user?.username}
                              </div>
                              <div className="text-sm text-muted">
                                @{member.user?.username}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          {myRole === 'admin' && member.userId !== currentUser?.id ? (
                            <select
                              className="form-input form-select"
                              value={member.role}
                              onChange={(e) => handleUpdateRole(member.userId, e.target.value as 'admin' | 'member')}
                              style={{ width: 'auto' }}
                            >
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                            </select>
                          ) : (
                            <span className={`badge badge-${member.role === 'admin' ? 'primary' : 'secondary'}`}>
                              {member.role}
                              {member.userId === currentUser?.id && ' (you)'}
                            </span>
                          )}
                        </td>
                        {myRole === 'admin' && (
                          <td>
                            {member.userId !== currentUser?.id && (
                              <button
                                className="btn btn-ghost btn-icon btn-sm"
                                onClick={() => handleRemoveMember(member.userId, member.user?.username || 'user')}
                                title="Remove member"
                              >
                                <UserMinus size={16} />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted">No members yet.</p>
            )}
          </div>
        </div>

        {/* Projects */}
        <div className="card mb-4">
          <div className="card-header">
            <h3 className="card-title">
              <Folder size={18} style={{ marginRight: '0.5rem' }} />
              Projects Access
            </h3>
          </div>
          <div className="card-body">
            {group.projectAccess && group.projectAccess.length > 0 ? (
              <div className="grid grid-cols-3">
                {group.projectAccess.map(access => (
                  <Link
                    key={access.id}
                    href={`/projects/${access.project?.id}`}
                    className="card project-card"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div className="card-body">
                      <div className="project-card-header">
                        <h4 className="project-card-title">{access.project?.name}</h4>
                        <span className={`badge badge-${
                          access.permissionLevel === 'admin' ? 'primary' :
                          access.permissionLevel === 'write' ? 'success' : 'secondary'
                        }`}>
                          {access.permissionLevel}
                        </span>
                      </div>
                      {access.project?.description && (
                        <p className="project-card-description">{access.project.description}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Folder className="empty-state-icon" />
                <h3 className="empty-state-title">No projects yet</h3>
                <p className="empty-state-description">
                  This group doesn&apos;t have access to any projects yet.
                </p>
                {myRole === 'admin' && (
                  <Link href="/projects?new=true" className="btn btn-primary">
                    <Plus size={16} />
                    Create Project
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Danger Zone */}
        {myRole === 'admin' && (
          <div className="card" style={{ borderColor: 'var(--danger-color)' }}>
            <div className="card-header">
              <h3 className="card-title" style={{ color: 'var(--danger-color)' }}>
                Danger Zone
              </h3>
            </div>
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <h4>Delete this group</h4>
                  <p className="text-sm text-muted mt-2">
                    Once you delete a group, there is no going back.
                  </p>
                </div>
                <button className="btn btn-danger" onClick={handleDeleteGroup}>
                  <Trash2 size={16} />
                  Delete Group
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setSelectedUser(null);
          setSearchQuery('');
          setSearchResults([]);
          setError('');
        }}
        title="Add Member"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
              Cancel
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleAddMember}
              disabled={adding || !selectedUser}
            >
              {adding ? <span className="spinner" /> : 'Add Member'}
            </button>
          </>
        }
      >
        {error && <div className="alert alert-error">{error}</div>}
        
        <div className="form-group">
          <label className="form-label">Search Users</label>
          <div style={{ position: 'relative' }}>
            <Search 
              size={18} 
              style={{ 
                position: 'absolute', 
                left: '12px', 
                top: '50%', 
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} 
            />
            <input
              type="text"
              className="form-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by username or email..."
              style={{ paddingLeft: '40px' }}
            />
          </div>
        </div>

        {searching && (
          <div className="flex items-center gap-2 text-muted text-sm">
            <span className="spinner" />
            Searching...
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="form-group">
            <label className="form-label">Select User</label>
            <div style={{ 
              border: '1px solid var(--border-color)', 
              borderRadius: 'var(--radius-md)',
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              {searchResults.map(user => (
                <button
                  key={user.id}
                  className="dropdown-item"
                  style={{ 
                    width: '100%', 
                    background: selectedUser?.id === user.id ? 'var(--background-color)' : 'transparent'
                  }}
                  onClick={() => setSelectedUser(user)}
                >
                  <div 
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'var(--primary-color)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      fontSize: '0.875rem'
                    }}
                  >
                    {user.displayName?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 500 }}>{user.displayName || user.username}</div>
                    <div className="text-sm text-muted">@{user.username}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedUser && (
          <div className="form-group">
            <label className="form-label">Role</label>
            <select
              className="form-input form-select"
              value={newMemberRole}
              onChange={(e) => setNewMemberRole(e.target.value as 'admin' | 'member')}
            >
              <option value="member">Member - Can access shared projects</option>
              <option value="admin">Admin - Can manage group members</option>
            </select>
          </div>
        )}
      </Modal>
    </>
  );
}
