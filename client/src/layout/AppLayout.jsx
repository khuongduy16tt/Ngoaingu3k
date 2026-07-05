import React from 'react';
import { Link } from 'react-router-dom';
import { navLinks, roles } from '../data/mock';
import { useAuth } from '../providers/AuthProvider';

export function AppLayout({ children }) {
  return (
    <div className="app-shell">
      <div className="site-frame">
        <TopBar />
        <main className="site-main">{children}</main>
        <Footer />
      </div>
      <div className="background-accent background-accent--blue" aria-hidden="true" />
      <div className="background-accent background-accent--violet" aria-hidden="true" />
    </div>
  );
}

function TopBar() {
  const auth = useAuth();
  const effectiveRole = auth.profile?.role ?? auth.role;
  const signedIn = Boolean(auth.session);
  const visibleLinks = navLinks.filter((link) => !link.role || (signedIn && link.role === effectiveRole));

  return (
    <header className="topbar topbar--enterprise">
      <Link className="brand-block" to="/home">
        <div className="brand-mark brand-mark--enterprise brand-mark--image">
          <img src="/images/imported/logo-ngoaingu3k.png" alt="Ngoaingu3k logo" />
        </div>
        <div className="brand-copy">
          <div className="brand">Ngoaingu3k Academy</div>
          <div className="brand-subtitle">
            {signedIn ? `${auth.profile?.full_name || auth.user?.email || 'Member'} · ${effectiveRole.toUpperCase()}` : 'Enterprise English learning platform'}
          </div>
        </div>
      </Link>

      <nav className="nav">
        {visibleLinks.map((link) => (
          <Link key={link.to} to={link.to} className="nav-link">
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="toolbar">
        <select
          value={auth.role}
          onChange={(event) => auth.setRole(event.target.value)}
          className="role-switch"
          aria-label="Select role"
        >
          {roles.map((role) => (
            <option key={role} value={role}>
              {role === 'student' ? 'Student' : role === 'teacher' ? 'Teacher' : 'Admin'}
            </option>
          ))}
        </select>
        {signedIn ? (
          <button className="button button-ghost" type="button" onClick={() => auth.signOut()}>
            Sign out
          </button>
        ) : (
          <Link className="button button-ghost" to="/auth">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

function Footer() {
  const quickLinks = [
    { label: 'Home', to: '/home' },
    { label: 'Courses', to: '/courses' },
    { label: 'Learning', to: '/learn' },
    { label: 'Sign in', to: '/auth' }
  ];

  return (
    <footer className="footer footer--enterprise">
      <div className="footer-main">
        <div className="footer-brand">
          <Link className="brand-block footer-brand-block" to="/home">
            <div className="brand-mark brand-mark--enterprise brand-mark--image">
              <img src="/images/imported/logo-ngoaingu3k.png" alt="Ngoaingu3k logo" />
            </div>
            <div className="brand-copy">
              <div className="footer-title">Ngoaingu3k Academy</div>
              <p className="footer-text">
                A polished English-learning platform built for sales demos, operations, and fast onboarding.
              </p>
            </div>
          </Link>

          <div className="footer-contact">
            <a href="mailto:support@ngoaingu3k.com">support@ngoaingu3k.com</a>
            <a href="tel:+84900000000">+84 900 000 000</a>
          </div>
        </div>

        <div className="footer-links">
          <div>
            <h3>Quick links</h3>
            {quickLinks.map((link) => (
              <Link key={link.to} to={link.to}>
                {link.label}
              </Link>
            ))}
          </div>
          <div>
            <h3>Platform</h3>
            <span>Google OAuth</span>
            <span>Online payments</span>
            <span>Google Drive video</span>
            <span>Realtime progress</span>
          </div>
          <div>
            <h3>Support</h3>
            <span>Exercises and quizzes</span>
            <span>Student dashboard</span>
            <span>Teacher dashboard</span>
            <span>Admin dashboard</span>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© 2026 Ngoaingu3k Academy</span>
        <span>Built with React · Supabase · Vercel</span>
      </div>
    </footer>
  );
}
