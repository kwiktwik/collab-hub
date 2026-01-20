import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  Folder, 
  Users, 
  Settings, 
  LogOut,
  Plus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: Home },
    { path: '/projects', label: 'Projects', icon: Folder },
    { path: '/groups', label: 'Groups', icon: Users },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <Link to="/dashboard" className="sidebar-logo">
            CollabHub
          </Link>
        </div>
        
        <nav className="sidebar-nav">
          <div className="sidebar-section">
            <div className="sidebar-section-title">Menu</div>
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`sidebar-nav-item ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">Quick Actions</div>
            <Link to="/projects/new" className="sidebar-nav-item">
              <Plus size={20} />
              <span>New Project</span>
            </Link>
            <Link to="/groups/new" className="sidebar-nav-item">
              <Plus size={20} />
              <span>New Group</span>
            </Link>
          </div>
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            {user?.displayName?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.displayName || user?.username}</div>
            <div className="sidebar-user-email">{user?.email}</div>
          </div>
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
