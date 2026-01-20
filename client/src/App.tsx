import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Groups from './pages/Groups';
import GroupDetail from './pages/GroupDetail';
import Settings from './pages/Settings';



function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <Routes>
      {/* Landing page - always accessible, redirects if logged in */}
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Landing />} />
      
      {/* Public routes */}
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <Register />} />

      {/* Private routes */}
      <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" replace />} />
      <Route path="/projects" element={user ? <Projects /> : <Navigate to="/login" replace />} />
      <Route path="/projects/new" element={user ? <Projects /> : <Navigate to="/login" replace />} />
      <Route path="/projects/:projectId" element={user ? <ProjectDetail /> : <Navigate to="/login" replace />} />
      <Route path="/groups" element={user ? <Groups /> : <Navigate to="/login" replace />} />
      <Route path="/groups/new" element={user ? <Groups /> : <Navigate to="/login" replace />} />
      <Route path="/groups/:groupId" element={user ? <GroupDetail /> : <Navigate to="/login" replace />} />
      <Route path="/settings" element={user ? <Settings /> : <Navigate to="/login" replace />} />

      {/* Catch all - redirect to landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
