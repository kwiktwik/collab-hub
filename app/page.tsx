import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Layers, ArrowRight, Folder, Key, Users } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';

export default async function Home() {
  // Redirect to dashboard if already logged in
  const user = await getCurrentUser();
  if (user) {
    redirect('/dashboard');
  }

  return (
    <div className="landing-modern">
      {/* Background */}
      <div className="landing-bg">
        <div className="landing-bg-gradient"></div>
      </div>

      {/* Navigation */}
      <nav className="landing-navbar">
        <div className="landing-navbar-inner">
          <Link href="/" className="landing-brand">
            <div className="landing-brand-icon">
              <Layers size={22} />
            </div>
            <span>CollabHub</span>
          </Link>
          
          <div className="landing-navbar-actions">
            <Link href="/login" className="landing-link-btn">Sign In</Link>
            <Link href="/register" className="landing-cta-btn">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="landing-main">
        <div className="landing-hero">
          {/* Badge */}
          <div className="landing-badge">
            <span>✨ Multi-group project sharing</span>
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
            <Link href="/register" className="landing-btn-hero">
              Start Free <ArrowRight size={18} />
            </Link>
            <Link href="/login" className="landing-btn-outline">
              Sign In
            </Link>
          </div>
        </div>

        {/* Feature Cards Stack */}
        <div className="landing-cards-stack">
          <div className="landing-float-card">
            <div className="landing-float-card-icon purple">
              <Folder size={20} />
            </div>
            <div>
              <strong>Projects</strong>
              <span>Unlimited workspaces</span>
            </div>
          </div>
          <div className="landing-float-card">
            <div className="landing-float-card-icon green">
              <Key size={20} />
            </div>
            <div>
              <strong>Credentials</strong>
              <span>AES-256 encrypted</span>
            </div>
          </div>
          <div className="landing-float-card">
            <div className="landing-float-card-icon orange">
              <Users size={20} />
            </div>
            <div>
              <strong>Teams</strong>
              <span>Multi-group access</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <Layers size={18} />
            <span>CollabHub</span>
          </div>
          <div className="landing-footer-links">
            <Link href="/login">Sign In</Link>
            <Link href="/register">Sign Up</Link>
          </div>
        </div>
        <p className="landing-copyright">© 2024 CollabHub</p>
      </footer>
    </div>
  );
}
