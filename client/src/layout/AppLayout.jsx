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
      <FloatingTestButton />
      <FloatingContactButtons />
      <div className="background-accent background-accent--blue" aria-hidden="true" />
      <div className="background-accent background-accent--violet" aria-hidden="true" />
    </div>
  );
}

function FloatingTestButton() {
  return (
    <Link className="floating-test-button" to="/test" aria-label="Vào trang làm bài test">
      <span className="floating-test-button__badge">1</span>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m3 8.5 9-4 9 4-9 4-9-4Z" />
        <path d="M6.5 10.2v4.2c0 1.7 2.45 3.1 5.5 3.1s5.5-1.4 5.5-3.1v-4.2" />
        <path d="M21 8.5v5.25" />
      </svg>
    </Link>
  );
}

const floatingContactActions = [
  {
    label: 'Zalo',
    description: 'Nhắn tin tư vấn',
    href: 'https://zalo.me/84900000000',
    className: 'floating-contact__item--zalo',
    external: true,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5.5 5.75h13a2.75 2.75 0 0 1 2.75 2.75v5.75A2.75 2.75 0 0 1 18.5 17h-6.65l-4.8 3.25V17H5.5a2.75 2.75 0 0 1-2.75-2.75V8.5A2.75 2.75 0 0 1 5.5 5.75Z" />
      </svg>
    )
  },
  {
    label: 'Messenger',
    description: 'Chat qua Facebook',
    href: 'https://m.me/ngoaingu3k',
    className: 'floating-contact__item--messenger',
    external: true,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.25c-5.05 0-9 3.62-9 8.25 0 2.63 1.3 4.94 3.32 6.46v3.04l3.04-1.67c.84.25 1.72.38 2.64.38 5.05 0 9-3.62 9-8.25S17.05 3.25 12 3.25Z" />
      </svg>
    )
  },
  {
    label: 'Gọi điện',
    description: 'Liên hệ tư vấn ngay',
    href: 'tel:+84900000000',
    className: 'floating-contact__item--phone',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.62 10.8c1.44 2.83 3.75 5.14 6.58 6.58l2.2-2.2a1.2 1.2 0 0 1 1.22-.29c1.34.45 2.74.68 4.16.68.67 0 1.22.55 1.22 1.22v3.49c0 .67-.55 1.22-1.22 1.22C10.67 21.5 2.5 13.33 2.5 3.22 2.5 2.55 3.05 2 3.72 2h3.5c.67 0 1.22.55 1.22 1.22 0 1.42.23 2.82.68 4.16.14.43.04.9-.29 1.22l-2.21 2.2Z" />
      </svg>
    )
  }
];

function FloatingContactButtons() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`floating-contact ${isOpen ? 'is-open' : ''}`} aria-label="Kenh lien he nhanh">
      <div id="floating-contact-list" className="floating-contact__list" aria-hidden={!isOpen}>
        {floatingContactActions.map((action) => (
          <a
            key={action.label}
            className={`floating-contact__item ${action.className}`}
            href={action.href}
            aria-label={`${action.label}: ${action.description}`}
            target={action.external ? '_blank' : undefined}
            rel={action.external ? 'noreferrer' : undefined}
            tabIndex={isOpen ? undefined : -1}
          >
            <span className="floating-contact__icon">{action.icon}</span>
            <span className="floating-contact__copy">
              <strong>{action.label}</strong>
              <span>{action.description}</span>
            </span>
          </a>
        ))}
      </div>
      <button
        className="floating-contact__toggle"
        type="button"
        aria-label={isOpen ? 'An kenh lien he nhanh' : 'Mo kenh lien he nhanh'}
        aria-expanded={isOpen}
        aria-controls="floating-contact-list"
        onClick={() => setIsOpen((current) => !current)}
      >
        {isOpen ? null : <span className="floating-contact__toggle-badge">1</span>}
        {isOpen ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12" />
            <path d="M18 6 6 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
            <path d="M5.5 12.5h2.2v5H5.5a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2Z" />
            <path d="M16.3 12.5h2.2a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-2.2v-5Z" />
            <path d="M18.5 17.5c-.6 1.85-2.18 2.75-4.75 2.75H12" />
          </svg>
        )}
      </button>
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
                  Nền tảng học ngoại ngữ trực tuyến cho tư vấn tuyển sinh, vận hành lớp học và theo dõi tiến độ.
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
              <span>Đăng nhập tài khoản</span>
              <span>Thanh toán trực tuyến</span>
              <span>Học liệu số</span>
              <span>Theo dõi tiến độ</span>
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
          <span>Nền tảng học trực tuyến</span>
        </div>
      </div>
    </footer>
  );
}
