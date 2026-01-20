import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Folder, Users, FileText, Plus } from 'lucide-react';
import { projectsApi, groupsApi } from '../services/api';
import { Project, Group } from '../types';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';

export function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

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
      setGroups(groupsRes.data.groups);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

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
        <h1>Welcome back, {user?.displayName || user?.username}!</h1>
      </div>

      <div className="page-content">
        {/* Stats */}
        <div className="grid grid-cols-3 mb-4">
          <div className="card">
            <div className="card-body">
              <div className="flex items-center gap-4">
                <div style={{ 
                  padding: '0.75rem', 
                  background: '#eef2ff', 
                  borderRadius: 'var(--radius-md)' 
                }}>
                  <Folder size={24} color="var(--primary-color)" />
                </div>
                <div>
                  <div className="text-muted text-sm">Projects</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{projects.length}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="flex items-center gap-4">
                <div style={{ 
                  padding: '0.75rem', 
                  background: '#dcfce7', 
                  borderRadius: 'var(--radius-md)' 
                }}>
                  <Users size={24} color="#166534" />
                </div>
                <div>
                  <div className="text-muted text-sm">Groups</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{groups.length}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="flex items-center gap-4">
                <div style={{ 
                  padding: '0.75rem', 
                  background: '#fef3c7', 
                  borderRadius: 'var(--radius-md)' 
                }}>
                  <FileText size={24} color="#92400e" />
                </div>
                <div>
                  <div className="text-muted text-sm">Active Status</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                    {projects.filter(p => p.status === 'active').length}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Projects */}
        <div className="card mb-4">
          <div className="card-header">
            <h3 className="card-title">Recent Projects</h3>
            <Link to="/projects/new" className="btn btn-primary btn-sm">
              <Plus size={16} />
              New Project
            </Link>
          </div>
          <div className="card-body">
            {projects.length === 0 ? (
              <div className="empty-state">
                <Folder className="empty-state-icon" />
                <h3 className="empty-state-title">No projects yet</h3>
                <p className="empty-state-description">
                  Create your first project to start collaborating with your team.
                </p>
                <Link to="/projects/new" className="btn btn-primary">
                  <Plus size={16} />
                  Create Project
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2">
                {projects.slice(0, 4).map(project => (
                  <Link 
                    key={project.id} 
                    to={`/projects/${project.id}`}
                    className="card project-card"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div className="card-body">
                      <div className="project-card-header">
                        <h4 className="project-card-title">{project.name}</h4>
                        <span className={`badge badge-${project.status === 'active' ? 'success' : 'secondary'}`}>
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
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Groups */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Your Groups</h3>
            <Link to="/groups/new" className="btn btn-secondary btn-sm">
              <Plus size={16} />
              New Group
            </Link>
          </div>
          <div className="card-body">
            {groups.length === 0 ? (
              <div className="empty-state">
                <Users className="empty-state-icon" />
                <h3 className="empty-state-title">No groups yet</h3>
                <p className="empty-state-description">
                  Create a group to collaborate with others on projects.
                </p>
                <Link to="/groups/new" className="btn btn-primary">
                  <Plus size={16} />
                  Create Group
                </Link>
              </div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Your Role</th>
                      <th>Members</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.slice(0, 5).map(group => (
                      <tr key={group.id}>
                        <td>
                          <Link to={`/groups/${group.id}`}>{group.name}</Link>
                        </td>
                        <td>
                          <span className={`badge badge-${group.myRole === 'admin' ? 'primary' : 'secondary'}`}>
                            {group.myRole}
                          </span>
                        </td>
                        <td>{group.memberCount || group.members?.length || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default Dashboard;
