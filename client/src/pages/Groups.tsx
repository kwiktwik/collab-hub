import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Plus, Search, Shield } from 'lucide-react';
import { groupsApi } from '../services/api';
import { Group } from '../types';
import Layout from '../components/Layout';
import Modal from '../components/Modal';

export function Groups() {
  const navigate = useNavigate();
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
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const response = await groupsApi.list();
      setGroups(response.data.groups);
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      const response = await groupsApi.create(newGroup);
      navigate(`/groups/${response.data.group.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create group');
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
      <Layout>
        <div className="loading-page">
          <div className="spinner" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
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
                to={`/groups/${group.id}`}
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
    </Layout>
  );
}

export default Groups;
