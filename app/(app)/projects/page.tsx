'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Folder, Users, Plus, Search, Building2 } from 'lucide-react';
import Modal from '@/components/Modal';
import type { Project, Group } from '@/lib/types';

interface Organization {
  id: string;
  name: string;
  slug: string;
  myRole: string;
}

export default function ProjectsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [search, setSearch] = useState('');

  // Form state
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    groupId: ''
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadOrganizations();
  }, []);

  useEffect(() => {
    if (currentOrg) {
      loadData();
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

  const loadData = async () => {
    if (!currentOrg) return;
    try {
      const [projectsRes, groupsRes] = await Promise.all([
        fetch(`/api/projects?organizationId=${currentOrg.id}`),
        fetch(`/api/groups?organizationId=${currentOrg.id}`)
      ]);
      
      const projectsData = await projectsRes.json();
      const groupsData = await groupsRes.json();
      
      setProjects(projectsData.projects || []);
      setGroups((groupsData.groups || []).filter((g: Group) => g.myRole === 'admin'));
    } catch (error) {
      console.error('Error loading projects:', error);
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
        <p>Organizations are workspaces where you and your team collaborate. Create one to start using projects.</p>
        <Link href="/organizations/new" className="btn btn-primary btn-lg">
          <Plus size={18} />
          Create Organization
        </Link>
      </div>
    );
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!currentOrg) {
      setError('Please select an organization');
      return;
    }
    
    setCreating(true);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newProject,
          organizationId: currentOrg.id
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Failed to create project');
        return;
      }
      
      router.push(`/projects/${data.project.id}`);
    } catch (err: any) {
      setError('Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(search.toLowerCase()) ||
    project.description?.toLowerCase().includes(search.toLowerCase())
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
        <h1>Projects</h1>
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
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '40px' }}
            />
          </div>
          <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>
            <Plus size={18} />
            New Project
          </button>
        </div>
      </div>

      <div className="page-content">
        {filteredProjects.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <Folder className="empty-state-icon" />
              <h3 className="empty-state-title">
                {search ? 'No projects found' : 'No projects yet'}
              </h3>
              <p className="empty-state-description">
                {search 
                  ? 'Try adjusting your search criteria'
                  : 'Create your first project to start organizing your work'}
              </p>
              {!search && groups.length > 0 && (
                <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>
                  <Plus size={16} />
                  Create Project
                </button>
              )}
              {!search && groups.length === 0 && (
                <>
                  <p className="text-muted text-sm mt-2">
                    You need to be an admin of at least one group to create a project.
                  </p>
                  <Link href="/groups?new=true" className="btn btn-primary">
                    <Plus size={16} />
                    Create a Group First
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3">
            {filteredProjects.map(project => (
              <Link 
                key={project.id} 
                href={`/projects/${project.id}`}
                className="card project-card"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="card-body">
                  <div className="project-card-header">
                    <h4 className="project-card-title">{project.name}</h4>
                    <span className={`badge badge-${project.status === 'active' ? 'success' : project.status === 'completed' ? 'primary' : 'secondary'}`}>
                      {project.status}
                    </span>
                  </div>
                  {project.description && (
                    <p className="project-card-description">{project.description}</p>
                  )}
                  <div className="project-card-footer">
                    <span>
                      <Users size={14} style={{ marginRight: '0.25rem' }} />
                      {project.accessGroups?.length || 0} groups
                    </span>
                    {project.creator && (
                      <span>by {project.creator.displayName || project.creator.username}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* New Project Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => {
          setShowNewModal(false);
          setNewProject({ name: '', description: '', groupId: '' });
          setError('');
        }}
        title="Create New Project"
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
              onClick={handleCreateProject}
              disabled={creating || !newProject.name || !newProject.groupId}
            >
              {creating ? <span className="spinner" /> : 'Create Project'}
            </button>
          </>
        }
      >
        {error && <div className="alert alert-error">{error}</div>}
        
        <form onSubmit={handleCreateProject}>
          <div className="form-group">
            <label className="form-label" htmlFor="projectName">Project Name</label>
            <input
              id="projectName"
              type="text"
              className="form-input"
              value={newProject.name}
              onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
              placeholder="Enter project name"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="projectDescription">Description (optional)</label>
            <textarea
              id="projectDescription"
              className="form-input form-textarea"
              value={newProject.description}
              onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
              placeholder="Describe your project"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="projectGroup">Assign to Group</label>
            <select
              id="projectGroup"
              className="form-input form-select"
              value={newProject.groupId}
              onChange={(e) => setNewProject({ ...newProject, groupId: e.target.value })}
              required
            >
              <option value="">Select a group...</option>
              {groups.map(group => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            <div className="form-help">
              The project will be accessible to all members of this group.
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
