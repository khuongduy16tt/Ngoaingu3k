import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { navLinks } from '../data/mock';
import { useAuth } from '../providers/AuthProvider';
import { contact } from '../config/contact';
import { ui } from '../config/i18n';

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

  const themeLabel = useMemo(() => (theme === 'dark' ? ui.darkMode : ui.lightMode), [theme]);

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
    <Link className="floating-test-button" to="/test" aria-label={ui.testButtonAria}>
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
    label: ui.zaloLabel,
    description: ui.zaloDesc,
    href: contact.zaloUrl,
    className: 'floating-contact__item--zalo',
    external: true,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5.5 5.75h13a2.75 2.75 0 0 1 2.75 2.75v5.75A2.75 2.75 0 0 1 18.5 17h-6.65l-4.8 3.25V17H5.5a2.75 2.75 0 0 1-2.75-2.75V8.5A2.75 2.75 0 0 1 5.5 5.75Z" />
      </svg>
    )
  },
  {
    label: ui.messengerLabel,
    description: ui.messengerDesc,
    href: contact.messengerUrl,
    className: 'floating-contact__item--messenger',
    external: true,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.25c-5.05 0-9 3.62-9 8.25 0 2.63 1.3 4.94 3.32 6.46v3.04l3.04-1.67c.84.25 1.72.38 2.64.38 5.05 0 9-3.62 9-8.25S17.05 3.25 12 3.25Z" />
      </svg>
    )
  },
  {
    label: ui.phoneLabel,
    description: ui.phoneDesc,
    href: `tel:${contact.phone}`,
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
    <div className={`floating-contact ${isOpen ? 'is-open' : ''}`} aria-label={ui.contactChannelsAria}>
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
        aria-label={isOpen ? ui.closeContactChannels : ui.openContactChannels}
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
  const currentRole = auth.profile?.role || auth.role || 'student';
  const visibleLinks = navLinks.filter((link) => !link.role || (signedIn && link.role === currentRole));

  return (
    <header className="topbar topbar--enterprise">
      <div className="topbar-inner">
        <Link className="brand-block" to="/home">
          <div className="brand-mark brand-mark--enterprise brand-mark--image">
            <img src="/images/imported/logo-ngoaingu3k-clean.png" alt="Ngoaingu3k logo" />
          </div>
          <div className="brand-copy">
            <div className="brand">{contact.companyName}</div>
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
            {ui.contact}
          </a>
        </nav>

        <div className="toolbar">
          <button
            className="text-control theme-toggle"
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? ui.switchToLight : ui.switchToDark}
            title={themeLabel}
          >
            <ThemeIcon theme={theme} />
          </button>
          {signedIn ? (
            <button className="text-control" type="button" onClick={() => auth.signOut()}>
              {ui.signOut}
            </button>
          ) : (
            <>
              <Link className="text-control auth-nav-link" to="/auth">
                {ui.signIn}
              </Link>
              <Link className="text-control auth-nav-link" to="/auth?mode=sign-up">
                {ui.signUp}
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
    { label: ui.home, to: '/home' },
    { label: ui.courses, to: '/courses' },
    { label: ui.learningRoom, to: '/learn' },
    { label: ui.signIn, to: '/auth' }
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
                <div className="footer-title">{contact.companyName}</div>
                <p className="footer-text">
                  {contact.companyDescription}
                </p>
              </div>
            </Link>

            <div className="footer-contact">
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
              <a href={`tel:${contact.phone}`}>{contact.phoneDisplay}</a>
            </div>
          </div>

          <div className="footer-links">
            <div>
              <h3>{ui.quickLinks}</h3>
              {quickLinks.map((link) => (
                <Link key={link.to} to={link.to}>
                  {link.label}
                </Link>
              ))}
            </div>
            <div>
              <h3>{ui.platform}</h3>
              <span>{ui.accountLogin}</span>
              <span>{ui.onlinePayment}</span>
              <span>{ui.digitalMaterials}</span>
              <span>{ui.progressTracking}</span>
            </div>
            <div>
              <h3>{ui.support}</h3>
              <span>{ui.exercisesAndQuizzes}</span>
              <span>{ui.dashboardWorkspace}</span>
              <span>{ui.courseManagement}</span>
              <span>{ui.progressTracking}</span>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>{contact.copyright}</span>
          <span>{ui.onlinePlatform}</span>
        </div>
      </div>
    </footer>
  );
}
