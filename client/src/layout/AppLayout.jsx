import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { navLinks } from '../data/mock';
import { useAuth } from '../providers/AuthProvider';

export function AppLayout({ children }) {
  const [theme, setTheme] = useState(() => readStoredTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('theme', theme);
    } catch {
      // ignore storage failures
    }
  }, [theme]);

  const themeLabel = useMemo(() => (theme === 'dark' ? 'Dark mode' : 'Light mode'), [theme]);

  return (
    <div className="app-shell">
      <TopBar theme={theme} setTheme={setTheme} themeLabel={themeLabel} />
      <main className="site-frame site-main">{children}</main>
      <Footer />
      <div className="background-accent background-accent--blue" aria-hidden="true" />
      <div className="background-accent background-accent--violet" aria-hidden="true" />
    </div>
  );
}

function readStoredTheme() {
  try {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme;
    }
  } catch {
    // ignore storage errors
  }

  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function ThemeIcon({ theme }) {
  if (theme === 'dark') {
    return (
      <svg className="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4.5V2.75" />
        <path d="M12 21.25V19.5" />
        <path d="M4.5 12H2.75" />
        <path d="M21.25 12H19.5" />
        <path d="M6.7 6.7 5.45 5.45" />
        <path d="m18.55 18.55-1.25-1.25" />
        <path d="m6.7 17.3-1.25 1.25" />
        <path d="m18.55 5.45-1.25 1.25" />
        <circle cx="12" cy="12" r="4.25" />
      </svg>
    );
  }

  return (
    <svg className="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.2 15.25A7.35 7.35 0 0 1 8.75 3.8a8.35 8.35 0 1 0 11.45 11.45Z" />
    </svg>
  );
}

function TopBar({ theme, setTheme, themeLabel }) {
  const auth = useAuth();
  const [activeHeaderLink, setActiveHeaderLink] = useState('');
  const signedIn = Boolean(auth.session);
  const currentRole = auth.role || auth.profile?.role || 'student';
  const visibleLinks = navLinks.filter((link) => !link.role || (signedIn && link.role === currentRole));

  return (
    <header className="topbar topbar--enterprise">
      <div className="topbar-inner">
        <Link className="brand-block" to="/home">
          <div className="brand-mark brand-mark--enterprise brand-mark--image">
            <img src="/images/imported/logo-ngoaingu3k-clean.png" alt="Ngoaingu3k logo" />
          </div>
          <div className="brand-copy">
            <div className="brand">Ngoaingu3k Academy</div>
            <div className="brand-subtitle">
              {signedIn ? auth.profile?.full_name || auth.user?.email || 'Member' : 'Enterprise English learning platform'}
            </div>
          </div>
        </Link>

        <nav className="nav">
          {visibleLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `nav-link ${isActive && activeHeaderLink !== 'contact' ? 'is-active' : ''}`}
              onClick={() => setActiveHeaderLink('')}
            >
              {link.label}
            </NavLink>
          ))}
          <a
            className={`nav-link ${activeHeaderLink === 'contact' ? 'is-active' : ''}`}
            href="#contact"
            onClick={() => setActiveHeaderLink('contact')}
          >
            Liên hệ
          </a>
        </nav>

        <div className="toolbar">
          <button
            className="text-control theme-toggle"
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={themeLabel}
          >
            <ThemeIcon theme={theme} />
          </button>
          {signedIn ? (
            <button className="text-control" type="button" onClick={() => auth.signOut()}>
              Sign out
            </button>
          ) : (
            <>
              <Link className="text-control auth-nav-link" to="/auth">
                Sign in
              </Link>
              <Link className="text-control auth-nav-link" to="/auth?mode=sign-up">
                Sign up
              </Link>
            </>
          )}
        </div>
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
    <footer id="contact" className="footer footer--enterprise">
      <div className="footer-inner">
        <div className="footer-main">
          <div className="footer-brand">
            <Link className="brand-block footer-brand-block" to="/home">
              <div className="brand-mark brand-mark--enterprise brand-mark--image">
                <img src="/images/imported/logo-ngoaingu3k-clean.png" alt="Ngoaingu3k logo" />
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
              <span>Dashboard workspace</span>
              <span>Course management</span>
              <span>Progress tracking</span>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>Copyright 2026 Ngoaingu3k Academy</span>
          <span>React / Supabase / Vercel</span>
        </div>
      </div>
    </footer>
  );
}
