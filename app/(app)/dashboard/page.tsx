'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Folder, Users, FileText, Plus, Building2 } from 'lucide-react';
import type { Project, Group } from '@/lib/types';

interface Organization {
  id: string;
  name: string;
  slug: string;
  myRole: string;
}

export default function DashboardPage() {
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    loadUser();
    loadOrganizations();
  }, []);

  useEffect(() => {
    if (currentOrg) {
      loadData();
    }
  }, [currentOrg]);

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

  const loadUser = async () => {
    try {
      const userRes = await fetch('/api/auth/me');
      const userData = await userRes.json();
      setUser(userData.user);
    } catch (error) {
      console.error('Error loading user:', error);
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
      setGroups(groupsData.groups || []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Show welcome screen for new users without organizations
  if (!loading && organizations.length === 0) {
    return (
      <>
        <div className="page-header">
          <h1>Welcome to CollabHub!</h1>
        </div>
        <div className="page-content">
          <div className="empty-state">
            <div className="empty-state-icon" style={{ background: 'linear-gradient(135deg, var(--primary-color), #ec4899)' }}>
              <Building2 size={32} />
            </div>
            <h2>Create Your First Organization</h2>
            <p>Organizations are workspaces where you and your team can collaborate on projects, boards, groups, and more. Get started by creating your first organization.</p>
            <Link href="/organizations/new" className="btn btn-primary btn-lg">
              <Plus size={18} />
              Create Organization
            </Link>
          </div>
        </div>
      </>
    );
  }

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
            <Link href="/projects?new=true" className="btn btn-primary btn-sm">
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
                <Link href="/projects?new=true" className="btn btn-primary">
                  <Plus size={16} />
                  Create Project
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2">
                {projects.slice(0, 4).map(project => (
                  <Link 
                    key={project.id} 
                    href={`/projects/${project.id}`}
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
            <Link href="/groups?new=true" className="btn btn-secondary btn-sm">
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
                <Link href="/groups?new=true" className="btn btn-primary">
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
                          <Link href={`/groups/${group.id}`}>{group.name}</Link>
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
    </>
  );
}
