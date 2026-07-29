import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { navLinks } from '../data/mock';
import { useAuth } from '../providers/AuthProvider';
import { contact } from '../config/contact';
import { ui } from '../config/i18n';
import { getAvatarGradient, getInitials } from '../lib/avatar';
import { ConsultationFab } from '../components/ConsultationFab';
import { ConsultationPopup } from '../components/ConsultationPopup';
import { getCourseCatalog, isHskCourse } from '../lib/courseService';

export function AppLayout({ children }) {
  const [theme, setTheme] = useState(() => readStoredTheme());
  const location = useLocation();
  // The exam room needs full focus: hide the topbar/footer/floating widgets
  // while a student is inside /exam/:examId.
  const immersive = location.pathname.startsWith('/exam/');
  // Popup tư vấn lặp 10s chỉ chạy ở trang chủ — các trang còn lại là nơi
  // người dùng đang học/thi/thao tác, bị cắt ngang mỗi 10s là hỏng việc.
  // ('/' chỉ tồn tại 1 nhịp trước khi redirect sang /home.)
  const onHomePage = location.pathname === '/home' || location.pathname === '/';

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('theme', theme);
    } catch {
      // ignore storage failures
    }
  }, [theme]);

  const themeLabel = useMemo(() => (theme === 'dark' ? ui.darkMode : ui.lightMode), [theme]);

  if (immersive) {
    return (
      <div className="app-shell app-shell--immersive">
        <main className="site-frame site-main">{children}</main>
        <div className="background-accent background-accent--blue" aria-hidden="true" />
        <div className="background-accent background-accent--violet" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <TopBar theme={theme} setTheme={setTheme} themeLabel={themeLabel} />
      <main className="site-frame site-main">{children}</main>
      <Footer />
      <FloatingTestButton />
      <ConsultationFab />
      {onHomePage ? <ConsultationPopup /> : null}
      <FloatingContactButtons />
      <div className="background-accent background-accent--blue" aria-hidden="true" />
      <div className="background-accent background-accent--violet" aria-hidden="true" />
    </div>
  );
}

// ─── Floating Test Button ─────────────────────────────────────────────────────
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

// ─── Floating Contact Buttons ─────────────────────────────────────────────────
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

// ─── Theme ────────────────────────────────────────────────────────────────────
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

// Icon phản ánh theme ĐANG hiển thị, không phải hành động sẽ xảy ra: mặt
// trời khi đang ở light mode, mặt trăng khi đang ở dark mode.
function ThemeIcon({ theme }) {
  if (theme === 'light') {
    return (
      <svg className="theme-icon theme-icon--sun" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4.6" fill="currentColor" stroke="none" />
        <path
          d="M12 1.5v2.75M12 19.75v2.75M4.22 4.22l1.94 1.94M17.84 17.84l1.94 1.94M1.5 12h2.75M19.75 12h2.75M4.22 19.78l1.94-1.94M17.84 6.16l1.94-1.94"
          fill="none"
          stroke="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg className="theme-icon theme-icon--moon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" stroke="none">
      <path d="M20.2 15.25A7.35 7.35 0 0 1 8.75 3.8a8.35 8.35 0 1 0 11.45 11.45Z" />
    </svg>
  );
}

// ─── UserAvatar mini dropdown ─────────────────────────────────────────────────
function UserAvatar() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const name = auth.profile?.full_name || auth.user?.user_metadata?.full_name || '';
  const email = auth.user?.email || '';
  const avatarUrl = auth.profile?.avatar_url || '';
  const initials = getInitials(name, email);
  const gradient = getAvatarGradient(name || email);
  const role = auth.profile?.role || auth.role || 'student';
  const roleLabel = role === 'teacher' ? 'Giáo viên' : role === 'admin' ? 'Quản trị viên' : 'Học sinh';

  useEffect(() => {
    if (!open) return;
    function onOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="user-avatar-wrapper" ref={wrapperRef}>
      <button
        id="user-avatar-btn"
        className="user-avatar-btn"
        type="button"
        aria-label="Mở menu hồ sơ"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="user-avatar-ring">
          {avatarUrl ? (
            <img className="user-avatar-img" src={avatarUrl} alt={name || 'Avatar'} />
          ) : (
            <span className="user-avatar-initials" style={{ background: gradient }}>
              {initials}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div id="profile-dropdown" className="profile-dropdown" role="dialog" aria-label="Menu người dùng">
          {/* Mini profile header */}
          <div className="profile-dropdown__header">
            <div className="profile-dropdown__avatar-mini">
              {avatarUrl ? (
                <img src={avatarUrl} alt={name} />
              ) : (
                <span style={{ background: gradient }}>{initials}</span>
              )}
            </div>
            <div className="profile-dropdown__info">
              <div className="profile-dropdown__name">{name || 'Người dùng'}</div>
              <div className="profile-dropdown__email">{email}</div>
              <span className={`profile-dropdown__role-badge profile-dropdown__role-badge--${role}`}>
                {roleLabel}
              </span>
            </div>
          </div>

          <div className="profile-dropdown__divider" />

          {/* Actions */}
          <div className="profile-dropdown__actions">
            <Link
              to="/profile"
              className="profile-dropdown__action"
              onClick={() => setOpen(false)}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Xem hồ sơ
            </Link>

            <button
              className="profile-dropdown__action profile-dropdown__action--signout"
              type="button"
              onClick={() => { setOpen(false); auth.signOut(); }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Đăng xuất
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Courses nav dropdown ──────────────────────────────────────────────────────
// Submenu của mục "Khóa học" gộp (giáo viên/admin): trỏ tới 2 khu vực trên
// trang danh mục. Hai mục tách theo ngôn ngữ thì liệt kê thẳng khóa học của
// hệ đó thay cho 2 link này.
const coursesNavSubmenu = [
  {
    to: '/courses#khoa-hoc-ielts',
    title: 'Khóa học IELTS',
    subtitle: 'Tiếng Anh · nền tảng, giao tiếp, luyện thi'
  },
  {
    to: '/courses#khoa-hoc-hsk',
    title: 'Khóa học HSK',
    subtitle: 'Tiếng Trung · các cấp độ HSK'
  }
];

const NAV_DROPDOWN_MAX_COURSES = 6;
const NAV_DROPDOWN_CLOSE_DELAY_MS = 300;
// Phải khớp với breakpoint drawer trong site-header.css.
const MOBILE_NAV_QUERY = '(max-width: 1240px)';

// Chevron-down thay cho icon Font Awesome mà trang thật dùng (10×8px, cách
// chữ 3px — cùng kích thước với .caret::after bên đó).
function CaretIcon() {
  return (
    <svg className="site-menu__caret" viewBox="0 0 10 8" aria-hidden="true">
      <path d="M1 2.2 5 6l4-3.8" />
    </svg>
  );
}

// Dropdown đơn giản cho các mục có submenu tĩnh (Phòng học → Phòng học /
// Flashcard / Tạo flashcard). Dùng chung khung mở-đóng và CSS với dropdown khóa
// học, nhưng không có ô tìm kiếm vì danh sách cố định và rất ngắn.
function SubmenuNavItem({ label, to, items, muteActive, onNavigate }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const closeTimeoutRef = useRef(null);

  function clearCloseTimeout() {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }

  function openNow() {
    clearCloseTimeout();
    setOpen(true);
  }

  function closeWithDelay() {
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => setOpen(false), NAV_DROPDOWN_CLOSE_DELAY_MS);
  }

  useEffect(() => clearCloseTimeout, []);

  useEffect(() => {
    if (!open) return undefined;
    function onOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function handleSelect() {
    clearCloseTimeout();
    setOpen(false);
    onNavigate?.();
  }

  // Sáng khi đang ở bất kỳ trang nào trong submenu, không chỉ trang của link cha.
  const isActive =
    !muteActive &&
    items.some((item) => location.pathname.startsWith(item.to.split('?')[0]));

  return (
    <li
      className={`site-menu__item ${open ? 'is-open' : ''}`}
      ref={wrapperRef}
      onMouseEnter={openNow}
      onMouseLeave={closeWithDelay}
    >
      <Link
        to={to}
        className={`site-menu__link ${isActive ? 'is-active' : ''}`}
        aria-expanded={open}
        onClick={(event) => {
          // Trên mobile/touch không có hover: chạm lần đầu chỉ mở submenu.
          if (!open && window.matchMedia(MOBILE_NAV_QUERY).matches) {
            event.preventDefault();
            openNow();
            return;
          }
          handleSelect();
        }}
      >
        {label}
        <CaretIcon />
      </Link>

      <div className="site-menu__sub site-menu__sub--compact" role="menu">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="site-menu__sub-link"
            role="menuitem"
            onClick={handleSelect}
          >
            {item.title}
            <span>{item.subtitle}</span>
          </Link>
        ))}
      </div>
    </li>
  );
}

function CoursesNavItem({ label, to, group, muteActive, onNavigate }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  // null = chưa tải; danh mục chỉ ~10-20 khóa nên tải 1 lần khi mở dropdown
  // lần đầu là đủ, không cần fetch lại mỗi lần hover.
  const [courses, setCourses] = useState(null);
  const wrapperRef = useRef(null);
  const closeTimeoutRef = useRef(null);

  function clearCloseTimeout() {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }

  function openNow() {
    clearCloseTimeout();
    setOpen(true);
  }

  function closeWithDelay() {
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => setOpen(false), NAV_DROPDOWN_CLOSE_DELAY_MS);
  }

  useEffect(() => clearCloseTimeout, []);

  useEffect(() => {
    if (!open || courses !== null) {
      return undefined;
    }

    let alive = true;
    void getCourseCatalog().then((list) => {
      if (alive) setCourses(list);
    });
    return () => {
      alive = false;
    };
  }, [open, courses]);

  useEffect(() => {
    if (!open) return;
    function onOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function handleSelect() {
    clearCloseTimeout();
    setOpen(false);
    setSearch('');
    onNavigate?.();
  }

  // Mục gộp nhận cả danh mục; 2 mục tách chỉ nhận khóa của đúng hệ ngôn ngữ
  // của mình — áp cho cả ô tìm kiếm để không trả về khóa của hệ bên kia.
  const groupCourses = (courses || []).filter((course) => {
    if (group === 'ielts') return !isHskCourse(course);
    if (group === 'hsk') return isHskCourse(course);
    return true;
  });

  const normalizedSearch = search.trim().toLowerCase();
  const searchResults = normalizedSearch
    ? groupCourses
        .filter((course) => course.title.toLowerCase().includes(normalizedSearch))
        .slice(0, NAV_DROPDOWN_MAX_COURSES)
    : [];

  // Hash của link cha ('#khoa-hoc-ielts'). NavLink chỉ khớp theo pathname nên
  // 2 mục tách sẽ cùng sáng trên /courses — phải tự so cả hash.
  const targetHash = to.includes('#') ? `#${to.split('#')[1]}` : '';
  const isActive =
    !muteActive &&
    location.pathname.startsWith('/courses') &&
    (!targetHash || location.hash === targetHash);

  function renderDefaultItems() {
    if (group === 'all') {
      return coursesNavSubmenu.map((item) => (
        <Link key={item.to} to={item.to} className="site-menu__sub-link" role="menuitem" onClick={handleSelect}>
          {item.title}
          <span>{item.subtitle}</span>
        </Link>
      ));
    }

    if (courses === null) {
      return <p className="site-menu__empty">Đang tải khóa học...</p>;
    }

    if (!groupCourses.length) {
      return <p className="site-menu__empty">Chưa có khóa học nào trong mục này.</p>;
    }

    return (
      <>
        {groupCourses.slice(0, NAV_DROPDOWN_MAX_COURSES).map((course) => (
          <Link
            key={course.id}
            to={`/courses/${course.id}`}
            className="site-menu__sub-link"
            role="menuitem"
            onClick={handleSelect}
          >
            {course.title}
            <span>
              {course.category} · {course.level}
            </span>
          </Link>
        ))}
        {groupCourses.length > NAV_DROPDOWN_MAX_COURSES ? (
          <Link to={to} className="site-menu__sub-link" role="menuitem" onClick={handleSelect}>
            Xem tất cả {groupCourses.length} khóa
          </Link>
        ) : null}
      </>
    );
  }

  return (
    <li
      className={`site-menu__item ${open ? 'is-open' : ''}`}
      ref={wrapperRef}
      onMouseEnter={openNow}
      onMouseLeave={closeWithDelay}
    >
      <Link
        to={to}
        className={`site-menu__link ${isActive ? 'is-active' : ''}`}
        aria-expanded={open}
        onClick={(event) => {
          // Trên mobile/touch không có hover: lần chạm đầu chỉ mở submenu,
          // muốn vào trang danh mục thì chạm tiếp lần nữa.
          if (!open && window.matchMedia(MOBILE_NAV_QUERY).matches) {
            event.preventDefault();
            openNow();
            return;
          }
          handleSelect();
        }}
      >
        {label}
        <CaretIcon />
      </Link>

      {/* Luôn render để có hiệu ứng lật rotateX cả khi mở và khi đóng; lúc
          đóng panel ở visibility:hidden nên cũng tự rơi khỏi thứ tự tab. */}
      <div className="site-menu__sub" role="menu">
        <input
          type="search"
          className="site-menu__search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onFocus={openNow}
          placeholder="Tìm khóa học..."
          aria-label={`Tìm trong ${label}`}
        />

        {normalizedSearch ? (
          searchResults.length ? (
            searchResults.map((course) => (
              <Link
                key={course.id}
                to={`/courses/${course.id}`}
                className="site-menu__sub-link"
                role="menuitem"
                onClick={handleSelect}
              >
                {course.title}
                <span>
                  {course.category} · {course.level}
                </span>
              </Link>
            ))
          ) : (
            <p className="site-menu__empty">
              {courses === null ? 'Đang tải khóa học...' : 'Không tìm thấy khóa học phù hợp.'}
            </p>
          )
        ) : (
          renderDefaultItems()
        )}
      </div>
    </li>
  );
}

// ─── TopBar ───────────────────────────────────────────────────────────────────
// Bản -clean (336×242) đã crop sát: hình thật chiếm 312×218, gần kín khung.
// File logo-ngoaingu3k.png mà trang thật dùng là 678×369 nhưng hình thật cũng
// chỉ 312×218 nằm giữa — 54% chiều cao là nền trong suốt, nên cùng một chiều
// cao khung thì bản -clean hiện to hơn ~1.5×.
const LOGO_SRC = '/images/imported/logo-ngoaingu3k-clean.png';

function TopBar({ theme, setTheme, themeLabel }) {
  const auth = useAuth();
  const [activeHeaderLink, setActiveHeaderLink] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const topbarRef = useRef(null);
  const signedIn = Boolean(auth.session);
  const currentRole = auth.profile?.role || auth.role || 'student';
  const audience = signedIn ? currentRole : 'guest';
  const visibleLinks = navLinks.filter((link) => {
    if (link.audience) return link.audience.includes(audience);
    return !link.role || (signedIn && link.role === currentRole);
  });

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  useEffect(() => {
    if (!mobileOpen) return undefined;
    function onOutside(e) {
      if (topbarRef.current && !topbarRef.current.contains(e.target)) setMobileOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setMobileOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    // Drawer off-canvas phủ full màn: khoá cuộn nền để không bị "scroll xuyên".
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  return (
    <header className="site-header">
      <div className="site-header__inner" ref={topbarRef}>
        <Link className="site-header__logo" to="/home" onClick={closeMobileMenu}>
          <img src={LOGO_SRC} alt={contact.companyName} />
        </Link>

        <nav id="site-nav" className={`site-nav ${mobileOpen ? 'is-open' : ''}`} aria-label="Menu chính">
          {/* Đầu drawer, chỉ hiện ở ≤1024px */}
          <div className="site-nav__head">
            <img src={LOGO_SRC} alt="" />
            <button type="button" className="site-nav__close" aria-label="Đóng menu" onClick={closeMobileMenu}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12" />
                <path d="M18 6 6 18" />
              </svg>
            </button>
          </div>

          <ul className="site-menu">
            {visibleLinks.map((link) =>
              link.courseGroup ? (
                <CoursesNavItem
                  key={link.to}
                  label={link.label}
                  to={link.to}
                  group={link.courseGroup}
                  muteActive={activeHeaderLink === 'contact'}
                  onNavigate={() => {
                    setActiveHeaderLink('');
                    closeMobileMenu();
                  }}
                />
              ) : link.submenu ? (
                <SubmenuNavItem
                  key={link.to}
                  label={link.label}
                  to={link.to}
                  // Mục có `roles` chỉ hiện với đúng vai trò — "Tạo flashcard"
                  // chỉ dành cho giảng viên và admin.
                  items={link.submenu.filter(
                    (item) => !item.roles || (signedIn && item.roles.includes(currentRole))
                  )}
                  muteActive={activeHeaderLink === 'contact'}
                  onNavigate={() => {
                    setActiveHeaderLink('');
                    closeMobileMenu();
                  }}
                />
              ) : (
                <li key={link.to} className="site-menu__item">
                  <NavLink
                    to={link.to}
                    className={({ isActive }) =>
                      `site-menu__link ${isActive && activeHeaderLink !== 'contact' ? 'is-active' : ''}`
                    }
                    onClick={() => {
                      setActiveHeaderLink('');
                      closeMobileMenu();
                    }}
                  >
                    {link.label}
                  </NavLink>
                </li>
              )
            )}
            <li className="site-menu__item">
              <a
                className={`site-menu__link ${activeHeaderLink === 'contact' ? 'is-active' : ''}`}
                href="#contact"
                onClick={() => {
                  setActiveHeaderLink('contact');
                  closeMobileMenu();
                }}
              >
                {ui.contact}
              </a>
            </li>
          </ul>

          {!signedIn ? (
            <div className="site-nav__auth">
              <Link className="site-header__login" to="/auth" onClick={closeMobileMenu}>
                {ui.signIn}
              </Link>
              <Link className="site-header__signup" to="/auth?mode=sign-up" onClick={closeMobileMenu}>
                {ui.signUp}
              </Link>
            </div>
          ) : null}
        </nav>

        <div className="site-header__actions">
          <button
            className={`theme-toggle ${theme === 'dark' ? 'is-dark' : ''}`}
            type="button"
            role="switch"
            aria-checked={theme === 'dark'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? ui.switchToLight : ui.switchToDark}
            title={themeLabel}
          >
            <span className="theme-toggle__track">
              <span className="theme-toggle__thumb">
                <ThemeIcon theme={theme} />
              </span>
            </span>
          </button>

          {signedIn ? (
            <UserAvatar />
          ) : (
            <Link className="site-header__login" to="/auth">
              {ui.signIn}
            </Link>
          )}

          <button
            type="button"
            className="site-header__burger"
            aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={mobileOpen}
            aria-controls="site-nav"
            onClick={() => setMobileOpen((value) => !value)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </svg>
          </button>
        </div>
      </div>

      <div
        className={`site-nav__overlay ${mobileOpen ? 'is-open' : ''}`}
        onClick={closeMobileMenu}
        aria-hidden="true"
      />
    </header>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  const quickLinks = [
    { label: ui.home, to: '/home' },
    { label: ui.courses, to: '/courses' },
    { label: ui.learningRoom, to: '/learn' },
    { label: ui.signIn, to: '/auth' }
  ];

  return (
    <footer id="contact" className="footer footer--enterprise">
      <div className="footer-banner" aria-hidden="true">
        <img src="/images/imported/10_Trang-chu_footer.webp" alt="" loading="lazy" />
      </div>
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
