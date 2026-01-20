import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  Folder, 
  FileText, 
  Key, 
  Shield, 
  Zap,
  CheckCircle,
  ArrowRight,
  Lock,
  Cloud,
  Sparkles,
  ChevronUp,
  Layers,
  X,
  Menu,
  ChevronDown
} from 'lucide-react';

type SheetContent = 'features' | 'security' | 'menu' | null;

export function Landing() {
  const [activeSheet, setActiveSheet] = useState<SheetContent>(null);
  const [isClosing, setIsClosing] = useState(false);

  const openSheet = (content: SheetContent) => {
    setActiveSheet(content);
    setIsClosing(false);
    // Prevent body scroll when sheet is open
    document.body.style.overflow = 'hidden';
  };

  const closeSheet = () => {
    setIsClosing(true);
    setTimeout(() => {
      setActiveSheet(null);
      setIsClosing(false);
      document.body.style.overflow = '';
    }, 300);
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeSheet) closeSheet();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [activeSheet]);

  return (
    <div className="landing-modern">
      {/* Animated Background */}
      <div className="landing-bg">
        <div className="landing-bg-gradient"></div>
        <div className="landing-bg-orbs">
          <div className="landing-orb landing-orb-1"></div>
          <div className="landing-orb landing-orb-2"></div>
          <div className="landing-orb landing-orb-3"></div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="landing-navbar">
        <div className="landing-navbar-inner">
          <Link to="/" className="landing-brand">
            <div className="landing-brand-icon">
              <Layers size={22} />
            </div>
            <span>CollabHub</span>
          </Link>
          
          {/* Desktop Nav */}
          <div className="landing-navbar-center">
            <button onClick={() => openSheet('features')} className="landing-nav-btn">
              Features <ChevronDown size={14} />
            </button>
            <button onClick={() => openSheet('security')} className="landing-nav-btn">
              Security <ChevronDown size={14} />
            </button>
          </div>
          
          <div className="landing-navbar-actions">
            <Link to="/login" className="landing-link-btn">Sign In</Link>
            <Link to="/register" className="landing-cta-btn">
              Get Started
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button className="landing-mobile-menu" onClick={() => openSheet('menu')}>
            <Menu size={24} />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="landing-main">
        <div className="landing-hero">
          {/* Badge */}
          <div className="landing-badge">
            <Sparkles size={14} />
            <span>Multi-group project sharing</span>
          </div>
          
          {/* Heading */}
          <h1 className="landing-heading">
            Collaborate on
            <br />
            <span className="landing-heading-gradient">Projects Securely</span>
          </h1>
          
          {/* Subtext */}
          <p className="landing-subtext">
            Manage docs, credentials & files in one place.
            Share with teams using flexible permissions.
          </p>

          {/* CTA Buttons */}
          <div className="landing-cta-group">
            <Link to="/register" className="landing-btn-hero">
              Start Free <ArrowRight size={18} />
            </Link>
            <button onClick={() => openSheet('features')} className="landing-btn-outline">
              See Features <ChevronUp size={18} />
            </button>
          </div>
        </div>

        {/* Feature Cards Stack */}
        <div className="landing-cards-stack">
          <div className="landing-float-card" style={{ '--delay': '0s' } as React.CSSProperties}>
            <div className="landing-float-card-icon purple">
              <Folder size={20} />
            </div>
            <div>
              <strong>Projects</strong>
              <span>Unlimited workspaces</span>
            </div>
          </div>
          <div className="landing-float-card" style={{ '--delay': '0.1s' } as React.CSSProperties}>
            <div className="landing-float-card-icon green">
              <Key size={20} />
            </div>
            <div>
              <strong>Credentials</strong>
              <span>AES-256 encrypted</span>
            </div>
          </div>
          <div className="landing-float-card" style={{ '--delay': '0.2s' } as React.CSSProperties}>
            <div className="landing-float-card-icon orange">
              <Users size={20} />
            </div>
            <div>
              <strong>Teams</strong>
              <span>Multi-group access</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="landing-quick-actions">
          <button className="landing-action-chip" onClick={() => openSheet('features')}>
            <FileText size={16} /> Documentation
          </button>
          <button className="landing-action-chip" onClick={() => openSheet('features')}>
            <Cloud size={16} /> S3 Storage
          </button>
          <button className="landing-action-chip" onClick={() => openSheet('security')}>
            <Shield size={16} /> Security
          </button>
        </div>
      </main>

      {/* Bottom Sheet */}
      {activeSheet && (
        <div 
          className={`sheet-overlay ${isClosing ? 'closing' : ''}`} 
          onClick={closeSheet}
        >
          <div 
            className={`sheet ${isClosing ? 'closing' : ''}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Sheet Handle */}
            <div className="sheet-handle-area" onClick={closeSheet}>
              <div className="sheet-handle"></div>
            </div>
            
            {/* Close Button */}
            <button className="sheet-close" onClick={closeSheet}>
              <X size={20} />
            </button>

            {/* Mobile Menu Sheet */}
            {activeSheet === 'menu' && (
              <div className="sheet-body">
                <div className="sheet-menu">
                  <button 
                    className="sheet-menu-item"
                    onClick={() => { closeSheet(); setTimeout(() => openSheet('features'), 350); }}
                  >
                    <Sparkles size={20} />
                    <span>Features</span>
                    <ChevronDown size={16} />
                  </button>
                  <button 
                    className="sheet-menu-item"
                    onClick={() => { closeSheet(); setTimeout(() => openSheet('security'), 350); }}
                  >
                    <Shield size={20} />
                    <span>Security</span>
                    <ChevronDown size={16} />
                  </button>
                  <div className="sheet-menu-divider"></div>
                  <Link to="/login" className="sheet-menu-item" onClick={closeSheet}>
                    <Users size={20} />
                    <span>Sign In</span>
                  </Link>
                  <Link to="/register" className="sheet-menu-cta" onClick={closeSheet}>
                    Get Started Free <ArrowRight size={18} />
                  </Link>
                </div>
              </div>
            )}

            {/* Features Sheet */}
            {activeSheet === 'features' && (
              <div className="sheet-body">
                <div className="sheet-header">
                  <div className="sheet-icon purple">
                    <Sparkles size={24} />
                  </div>
                  <h2>Powerful Features</h2>
                  <p>Everything you need for secure collaboration</p>
                </div>

                <div className="sheet-features">
                  <div className="sheet-feature-card">
                    <div className="sheet-feature-icon purple">
                      <Users size={22} />
                    </div>
                    <div className="sheet-feature-text">
                      <h4>Group-Based Access</h4>
                      <p>Share projects with multiple teams. Assign different permission levels per group.</p>
                    </div>
                  </div>

                  <div className="sheet-feature-card">
                    <div className="sheet-feature-icon green">
                      <FileText size={22} />
                    </div>
                    <div className="sheet-feature-text">
                      <h4>Documentation</h4>
                      <p>Create and organize documents within your projects. Rich text editing included.</p>
                    </div>
                  </div>

                  <div className="sheet-feature-card">
                    <div className="sheet-feature-icon orange">
                      <Key size={22} />
                    </div>
                    <div className="sheet-feature-text">
                      <h4>Secure Credentials</h4>
                      <p>Store API keys, passwords, tokens with AES-256 encryption.</p>
                    </div>
                  </div>

                  <div className="sheet-feature-card">
                    <div className="sheet-feature-icon red">
                      <Cloud size={22} />
                    </div>
                    <div className="sheet-feature-text">
                      <h4>File Storage</h4>
                      <p>Upload and share files with S3-compatible cloud storage.</p>
                    </div>
                  </div>

                  <div className="sheet-feature-card">
                    <div className="sheet-feature-icon blue">
                      <Shield size={22} />
                    </div>
                    <div className="sheet-feature-text">
                      <h4>Permission Control</h4>
                      <p>Read, write, and admin levels. Fine-grained access control.</p>
                    </div>
                  </div>

                  <div className="sheet-feature-card">
                    <div className="sheet-feature-icon cyan">
                      <Zap size={22} />
                    </div>
                    <div className="sheet-feature-text">
                      <h4>Fast & Modern</h4>
                      <p>Built with React & TypeScript. Lightning fast performance.</p>
                    </div>
                  </div>
                </div>

                <div className="sheet-cta">
                  <Link to="/register" className="landing-btn-hero" onClick={closeSheet}>
                    Get Started Free <ArrowRight size={18} />
                  </Link>
                </div>
              </div>
            )}

            {/* Security Sheet */}
            {activeSheet === 'security' && (
              <div className="sheet-body">
                <div className="sheet-header">
                  <div className="sheet-icon green">
                    <Lock size={24} />
                  </div>
                  <h2>Enterprise Security</h2>
                  <p>Your data is protected with industry-leading measures</p>
                </div>

                <div className="sheet-security-badge">
                  <div className="sheet-badge-inner">
                    <Shield size={40} />
                    <span>Protected</span>
                  </div>
                </div>

                <div className="sheet-security-list">
                  <div className="sheet-security-item">
                    <CheckCircle size={20} className="check-icon" />
                    <div>
                      <strong>AES-256 Encryption</strong>
                      <span>All credentials encrypted at rest</span>
                    </div>
                  </div>
                  <div className="sheet-security-item">
                    <CheckCircle size={20} className="check-icon" />
                    <div>
                      <strong>Bcrypt Hashing</strong>
                      <span>12 rounds password protection</span>
                    </div>
                  </div>
                  <div className="sheet-security-item">
                    <CheckCircle size={20} className="check-icon" />
                    <div>
                      <strong>Secure Sessions</strong>
                      <span>HTTP-only cookies, XSS protection</span>
                    </div>
                  </div>
                  <div className="sheet-security-item">
                    <CheckCircle size={20} className="check-icon" />
                    <div>
                      <strong>Role-Based Access</strong>
                      <span>Granular permission control</span>
                    </div>
                  </div>
                  <div className="sheet-security-item">
                    <CheckCircle size={20} className="check-icon" />
                    <div>
                      <strong>S3-Compatible Storage</strong>
                      <span>Encrypted file transfers</span>
                    </div>
                  </div>
                </div>

                <div className="sheet-cta">
                  <Link to="/register" className="landing-btn-hero" onClick={closeSheet}>
                    Start Secure Collaboration <ArrowRight size={18} />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <Layers size={18} />
            <span>CollabHub</span>
          </div>
          <div className="landing-footer-links">
            <Link to="/login">Sign In</Link>
            <Link to="/register">Sign Up</Link>
          </div>
        </div>
        <p className="landing-copyright">© 2024 CollabHub</p>
      </footer>
    </div>
  );
}

export default Landing;
