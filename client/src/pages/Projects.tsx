import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Folder, Users, Plus, Search } from 'lucide-react';
import { projectsApi, groupsApi } from '../services/api';
import { Project, Group } from '../types';
import Layout from '../components/Layout';
import Modal from '../components/Modal';

export function Projects() {
  const navigate = useNavigate();
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
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [projectsRes, groupsRes] = await Promise.all([
        projectsApi.list(),
        groupsApi.list()
      ]);
      setProjects(projectsRes.data.projects);
      setGroups(groupsRes.data.groups.filter((g: Group) => g.myRole === 'admin'));
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      const response = await projectsApi.create(newProject);
      navigate(`/projects/${response.data.project.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create project');
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
                  <Link to="/groups/new" className="btn btn-primary">
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
                to={`/projects/${project.id}`}
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
    </Layout>
  );
}

export default Projects;
