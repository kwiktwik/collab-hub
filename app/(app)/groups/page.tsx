'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, Plus, Search, Shield, Building2 } from 'lucide-react';
import Modal from '@/components/Modal';
import type { Group } from '@/lib/types';

interface Organization {
  id: string;
  name: string;
  slug: string;
  myRole: string;
}

export default function GroupsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [search, setSearch] = useState('');

  // Form state
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: ''
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadOrganizations();
  }, []);

  useEffect(() => {
    if (currentOrg) {
      loadGroups();
      if (searchParams.get('new') === 'true') {
        setShowNewModal(true);
      }
    }
  }, [currentOrg, searchParams]);

  const loadOrganizations = async () => {
    try {
      const res = await fetch('/api/organizations');
      const data = await res.json();
      const orgs = data.organizations || [];
      setOrganizations(orgs);
      
      if (orgs.length > 0) {
        const savedOrgId = typeof window !== 'undefined' ? localStorage.getItem('currentOrgId') : null;
        const org = orgs.find((o: Organization) => o.id === savedOrgId) || orgs[0];
        setCurrentOrg(org);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error loading organizations:', error);
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    if (!currentOrg) return;
    try {
      const res = await fetch(`/api/groups?organizationId=${currentOrg.id}`);
      const data = await res.json();
      setGroups(data.groups || []);
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setLoading(false);
    }
  };

  // Show create organization prompt if no org
  if (!loading && organizations.length === 0) {
    return (
      <div className="empty-state" style={{ marginTop: '4rem' }}>
        <div className="empty-state-icon" style={{ background: 'linear-gradient(135deg, var(--primary-color), #ec4899)' }}>
          <Building2 size={32} />
        </div>
        <h2>Create Your First Organization</h2>
        <p>Organizations are workspaces where you and your team collaborate. Create one to start using groups.</p>
        <Link href="/organizations/new" className="btn btn-primary btn-lg">
          <Plus size={18} />
          Create Organization
        </Link>
      </div>
    );
  }

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!currentOrg) {
      setError('Please select an organization');
      return;
    }
    
    setCreating(true);

    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newGroup,
          organizationId: currentOrg.id
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Failed to create group');
        return;
      }
      
      router.push(`/groups/${data.group.id}`);
    } catch (err: any) {
      setError('Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(search.toLowerCase()) ||
    group.description?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>Groups</h1>
        <div className="page-header-actions">
          <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
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
              placeholder="Search groups..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '40px' }}
            />
          </div>
          <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>
            <Plus size={18} />
            New Group
          </button>
        </div>
      </div>

      <div className="page-content">
        {filteredGroups.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <Users className="empty-state-icon" />
              <h3 className="empty-state-title">
                {search ? 'No groups found' : 'No groups yet'}
              </h3>
              <p className="empty-state-description">
                {search 
                  ? 'Try adjusting your search criteria'
                  : 'Create a group to start collaborating with your team'}
              </p>
              {!search && (
                <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>
                  <Plus size={16} />
                  Create Group
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3">
            {filteredGroups.map(group => (
              <Link 
                key={group.id} 
                href={`/groups/${group.id}`}
                className="card project-card"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="card-body">
                  <div className="project-card-header">
                    <h4 className="project-card-title">{group.name}</h4>
                    <span className={`badge badge-${group.myRole === 'admin' ? 'primary' : 'secondary'}`}>
                      {group.myRole}
                    </span>
                  </div>
                  {group.description && (
                    <p className="project-card-description">{group.description}</p>
                  )}
                  <div className="project-card-footer">
                    <span>
                      <Users size={14} style={{ marginRight: '0.25rem' }} />
                      {group.memberCount || group.members?.length || 0} members
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* New Group Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => {
          setShowNewModal(false);
          setNewGroup({ name: '', description: '' });
          setError('');
        }}
        title="Create New Group"
        footer={
          <>
            <button 
              className="btn btn-secondary" 
              onClick={() => setShowNewModal(false)}
            >
              Cancel
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleCreateGroup}
              disabled={creating || !newGroup.name}
            >
              {creating ? <span className="spinner" /> : 'Create Group'}
            </button>
          </>
        }
      >
        {error && <div className="alert alert-error">{error}</div>}
        
        <form onSubmit={handleCreateGroup}>
          <div className="form-group">
            <label className="form-label" htmlFor="groupName">Group Name</label>
            <input
              id="groupName"
              type="text"
              className="form-input"
              value={newGroup.name}
              onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
              placeholder="Enter group name"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="groupDescription">Description (optional)</label>
            <textarea
              id="groupDescription"
              className="form-input form-textarea"
              value={newGroup.description}
              onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
              placeholder="Describe your group"
              rows={3}
            />
          </div>
        </form>

        <div className="form-help" style={{ marginTop: '1rem' }}>
          <Shield size={14} style={{ marginRight: '0.25rem' }} />
          You will be the admin of this group.
        </div>
      </Modal>
    </>
  );
}
