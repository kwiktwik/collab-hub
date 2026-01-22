'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  LayoutGrid, 
  Plus, 
  Users, 
  Calendar,
  MoreVertical,
  Trash2,
  Settings,
  Building2
} from 'lucide-react';
import Modal from '@/components/Modal';

interface Board {
  id: string;
  name: string;
  description: string | null;
  key: string;
  projectId?: string | null;
  project?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
  creator?: { id: string; username: string; displayName: string | null };
  myPermission?: 'read' | 'write' | 'admin';
  accessGroups?: Array<{ group: { id: string; name: string }; permissionLevel: string }>;
}

interface Project {
  id: string;
  name: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  myRole: string;
}

export default function BoardsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newBoard, setNewBoard] = useState({ name: '', description: '', key: '', projectId: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [userGroups, setUserGroups] = useState<any[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  useEffect(() => {
    loadOrganizations();
  }, []);

  useEffect(() => {
    if (currentOrg) {
      loadBoards();
      loadUserGroups();
      loadProjects();
      
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

  const loadBoards = async () => {
    if (!currentOrg) return;
    try {
      const res = await fetch(`/api/boards?organizationId=${currentOrg.id}`);
      const data = await res.json();
      setBoards(data.boards || []);
    } catch (error) {
      console.error('Error loading boards:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    if (!currentOrg) return;
    try {
      const res = await fetch(`/api/projects?organizationId=${currentOrg.id}`);
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const loadUserGroups = async () => {
    if (!currentOrg) return;
    try {
      const res = await fetch(`/api/groups?organizationId=${currentOrg.id}`);
      const data = await res.json();
      setUserGroups((data.groups || []).filter((g: any) => g.myRole === 'admin'));
    } catch (error) {
      console.error('Error loading groups:', error);
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
        <p>Organizations are workspaces where you and your team collaborate. Create one to start using boards.</p>
        <Link href="/organizations/new" className="btn btn-primary btn-lg">
          <Plus size={18} />
          Create Organization
        </Link>
      </div>
    );
  }

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!currentOrg) {
      setError('Please select an organization first');
      return;
    }
    
    if (!newBoard.name.trim()) {
      setError('Board name is required');
      return;
    }

    if (!newBoard.key.trim() || !/^[A-Z]{2,10}$/.test(newBoard.key)) {
      setError('Board key must be 2-10 uppercase letters');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newBoard.name,
          description: newBoard.description,
          key: newBoard.key,
          projectId: newBoard.projectId || null,
          organizationId: currentOrg.id,
          groupIds: selectedGroups
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create board');
        return;
      }

      router.push(`/boards/${data.board.id}`);
    } catch (error) {
      setError('Failed to create board');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteBoard = async (boardId: string, boardName: string) => {
    if (!confirm(`Are you sure you want to delete "${boardName}"? This will delete all tasks and cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/boards/${boardId}`, { method: 'DELETE' });
      if (res.ok) {
        loadBoards();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete board');
      }
    } catch (error) {
      alert('Failed to delete board');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Boards</h1>
          <p className="text-muted">Manage your JIRA-like task boards</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>
          <Plus size={18} />
          New Board
        </button>
      </div>

      <div className="page-content">
        {loading ? (
          <div className="loading-page">
            <div className="spinner" />
          </div>
        ) : boards.length === 0 ? (
          <div className="card">
            <div className="card-body">
              <div className="empty-state">
                <LayoutGrid className="empty-state-icon" />
                <h3 className="empty-state-title">No boards yet</h3>
                <p className="empty-state-description">
                  Create your first board to start managing tasks like JIRA
                </p>
                <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>
                  <Plus size={18} />
                  Create Board
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3">
            {boards.map(board => (
              <div key={board.id} className="card card-hover">
                <div className="card-body">
                  <div className="flex justify-between items-start mb-3">
                    <Link href={`/boards/${board.id}`} className="board-link">
                      <div className="board-key">{board.key}</div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{board.name}</h3>
                    </Link>
                    {board.myPermission === 'admin' && (
                      <div className="dropdown">
                        <button className="btn btn-ghost btn-icon btn-sm">
                          <MoreVertical size={16} />
                        </button>
                        <div className="dropdown-menu">
                          <Link href={`/boards/${board.id}/settings`} className="dropdown-item">
                            <Settings size={14} />
                            Settings
                          </Link>
                          <button
                            className="dropdown-item text-danger"
                            onClick={() => handleDeleteBoard(board.id, board.name)}
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {board.description && (
                    <p className="text-muted text-sm mb-3" style={{ 
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {board.description}
                    </p>
                  )}

                  <div className="flex gap-2 flex-wrap mb-3">
                    <span className={`badge badge-${board.myPermission === 'admin' ? 'primary' : board.myPermission === 'write' ? 'success' : 'secondary'}`}>
                      {board.myPermission}
                    </span>
                    {board.accessGroups && board.accessGroups.length > 0 && (
                      <span className="badge badge-secondary">
                        <Users size={12} />
                        {board.accessGroups.length} group{board.accessGroups.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted">
                    <Calendar size={14} />
                    Updated {formatDate(board.updatedAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Board Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => {
          setShowNewModal(false);
          setNewBoard({ name: '', description: '', key: '', projectId: '' });
          setSelectedGroups([]);
          setError('');
        }}
        title="Create New Board"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowNewModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateBoard} disabled={creating}>
              {creating ? <span className="spinner" /> : 'Create Board'}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateBoard}>
          {error && <div className="alert alert-error mb-4">{error}</div>}

          {projects.length > 0 && (
            <div className="form-group">
              <label className="form-label">Project (Optional)</label>
              <select
                className="form-input"
                value={newBoard.projectId}
                onChange={(e) => setNewBoard({ ...newBoard, projectId: e.target.value })}
              >
                <option value="">No project (standalone board)</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
              <div className="form-help">Optionally attach this board to a project</div>
            </div>
          )}
          
          <div className="form-group">
            <label className="form-label">Board Name *</label>
            <input
              type="text"
              className="form-input"
              value={newBoard.name}
              onChange={(e) => setNewBoard({ ...newBoard, name: e.target.value })}
              placeholder="e.g., Product Development"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Board Key *</label>
            <input
              type="text"
              className="form-input"
              value={newBoard.key}
              onChange={(e) => setNewBoard({ ...newBoard, key: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 10) })}
              placeholder="e.g., PROD"
              maxLength={10}
            />
            <div className="form-help">2-10 uppercase letters. Used for task IDs like {newBoard.key || 'PROD'}-123</div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-input form-textarea"
              value={newBoard.description}
              onChange={(e) => setNewBoard({ ...newBoard, description: e.target.value })}
              placeholder="What is this board for?"
              rows={3}
            />
          </div>

          {userGroups.length > 0 && (
            <div className="form-group">
              <label className="form-label">Share with Groups</label>
              <div className="form-help mb-2">Select groups to give write access to this board</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {userGroups.map(group => (
                  <label key={group.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedGroups.includes(group.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedGroups([...selectedGroups, group.id]);
                        } else {
                          setSelectedGroups(selectedGroups.filter(id => id !== group.id));
                        }
                      }}
                    />
                    {group.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </form>
      </Modal>

      <style jsx>{`
        .board-link {
          text-decoration: none;
          color: inherit;
        }
        .board-link:hover h3 {
          color: var(--primary-color);
        }
        .board-key {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          font-weight: 600;
          font-family: monospace;
          color: var(--primary-color);
          margin-bottom: 0.5rem;
        }
        .dropdown {
          position: relative;
        }
        .dropdown-menu {
          display: none;
          position: absolute;
          right: 0;
          top: 100%;
          background: rgba(20, 20, 40, 0.98);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-md);
          min-width: 150px;
          z-index: 100;
          padding: 0.5rem 0;
        }
        .dropdown:hover .dropdown-menu,
        .dropdown:focus-within .dropdown-menu {
          display: block;
        }
        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          color: var(--text-primary);
          text-decoration: none;
          cursor: pointer;
          background: none;
          border: none;
          width: 100%;
          text-align: left;
          font-size: 0.875rem;
        }
        .dropdown-item:hover {
          background: var(--glass-bg-hover);
        }
        .text-danger {
          color: var(--danger-color) !important;
        }
      `}</style>
    </>
  );
}
