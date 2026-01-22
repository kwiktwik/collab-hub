'use client';

import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Home, 
  Folder, 
  Users, 
  Settings, 
  LogOut,
  Plus,
  Building2,
  LayoutGrid,
  ChevronDown
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import type { User } from '@/lib/types';

interface LayoutProps {
  children: ReactNode;
  user: User;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  myRole: string;
}

export function Layout({ children, user }: LayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [showOrgMenu, setShowOrgMenu] = useState(false);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      const res = await fetch('/api/organizations');
      const data = await res.json();
      const orgs = data.organizations || [];
      setOrganizations(orgs);
      
      if (orgs.length > 0) {
        const savedOrgId = localStorage.getItem('currentOrgId');
        const org = orgs.find((o: Organization) => o.id === savedOrgId) || orgs[0];
        setCurrentOrg(org);
        localStorage.setItem('currentOrgId', org.id);
      }
    } catch (error) {
      console.error('Error loading organizations:', error);
    }
  };

  const switchOrg = (org: Organization) => {
    setCurrentOrg(org);
    localStorage.setItem('currentOrgId', org.id);
    setShowOrgMenu(false);
    router.refresh();
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: Home },
    { path: '/boards', label: 'Boards', icon: LayoutGrid },
    { path: '/projects', label: 'Projects', icon: Folder },
    { path: '/groups', label: 'Groups', icon: Users },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const isOrgAdmin = currentOrg?.myRole === 'owner' || currentOrg?.myRole === 'admin';

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <Link href="/dashboard" className="sidebar-logo">
            CollabHub
          </Link>
        </div>

        {/* Organization Selector */}
        <div className="org-selector">
          {organizations.length > 0 ? (
            <div className="org-dropdown">
              <button 
                className="org-current"
                onClick={() => setShowOrgMenu(!showOrgMenu)}
              >
                <div className="org-avatar">
                  {currentOrg?.name?.[0]?.toUpperCase() || 'O'}
                </div>
                <div className="org-info">
                  <div className="org-name">{currentOrg?.name || 'Select Organization'}</div>
                  <div className="org-role">{currentOrg?.myRole}</div>
                </div>
                <ChevronDown size={16} />
              </button>
              
              {showOrgMenu && (
                <div className="org-menu">
                  {organizations.map(org => (
                    <button
                      key={org.id}
                      className={`org-menu-item ${org.id === currentOrg?.id ? 'active' : ''}`}
                      onClick={() => switchOrg(org)}
                    >
                      <div className="org-avatar-sm">
                        {org.name[0].toUpperCase()}
                      </div>
                      <span>{org.name}</span>
                    </button>
                  ))}
                  <div className="org-menu-divider" />
                  <Link href="/organizations/new" className="org-menu-item" onClick={() => setShowOrgMenu(false)}>
                    <Plus size={16} />
                    <span>Create Organization</span>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <Link href="/organizations/new" className="btn btn-primary" style={{ width: '100%' }}>
              <Building2 size={18} />
              Create Organization
            </Link>
          )}
        </div>
        
        <nav className="sidebar-nav">
          <div className="sidebar-section">
            <div className="sidebar-section-title">Menu</div>
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`sidebar-nav-item ${pathname.startsWith(item.path) ? 'active' : ''}`}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          {currentOrg && (
            <div className="sidebar-section">
              <div className="sidebar-section-title">Quick Actions</div>
              <Link href="/boards?new=true" className="sidebar-nav-item">
                <Plus size={20} />
                <span>New Board</span>
              </Link>
              <Link href="/projects?new=true" className="sidebar-nav-item">
                <Plus size={20} />
                <span>New Project</span>
              </Link>
              <Link href="/groups?new=true" className="sidebar-nav-item">
                <Plus size={20} />
                <span>New Group</span>
              </Link>
            </div>
          )}

          {isOrgAdmin && currentOrg && (
            <div className="sidebar-section">
              <div className="sidebar-section-title">Organization</div>
              <Link
                href={`/org/${currentOrg.slug}/members`}
                className={`sidebar-nav-item ${pathname.includes('/members') ? 'active' : ''}`}
              >
                <Users size={20} />
                <span>Members</span>
              </Link>
              <Link
                href={`/org/${currentOrg.slug}/settings`}
                className={`sidebar-nav-item ${pathname.includes('/org/') && pathname.includes('/settings') ? 'active' : ''}`}
              >
                <Settings size={20} />
                <span>Org Settings</span>
              </Link>
            </div>
          )}
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            {user?.displayName?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">
              {user?.displayName || user?.username}
            </div>
            <div className="sidebar-user-email">{user?.email}</div>
          </div>
          <NotificationBell />
          <button className="btn btn-ghost btn-icon" onClick={handleLogout} title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

export default Layout;
