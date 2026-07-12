import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { getDashboardPathForRole, getEffectiveRole } from '../lib/permissions';
import { usePageTitle } from '../hooks/usePageTitle';

const gallery = [
  {
    src: '/images/imported/12.5_KH-TT-scaled.webp',
    title: 'Học trực tuyến',
    meta: 'Lớp học live · theo dõi tiến độ'
  },
  {
    src: '/images/imported/11.4_KH-TA-scaled.webp',
    title: 'Luyện thi',
    meta: 'IELTS · HSK · kiểm tra đầu vào'
  },
  {
    src: '/images/imported/8.4_Trang-chu_GT-TT.webp',
    title: 'Được học viên tin chọn',
    meta: 'Sẵn sàng cho tư vấn và vận hành'
  }
];

function GoogleLogo() {
  return (
    <svg className="google-logo" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.78-.07-1.53-.2-2.23H12v4.22h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.52Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.25l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.05v2.59A9.99 9.99 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 14.08A6 6 0 0 1 6.08 12c0-.72.12-1.42.32-2.08V7.33H3.05A9.99 9.99 0 0 0 2 12c0 1.61.38 3.13 1.05 4.67l3.35-2.59Z" />
      <path fill="#EA4335" d="M12 5.8c1.47 0 2.8.51 3.84 1.5l2.86-2.86C16.96 2.82 14.7 2 12 2a9.99 9.99 0 0 0-8.95 5.33L6.4 9.92C7.19 7.56 9.4 5.8 12 5.8Z" />
    </svg>
  );
}

function getAuthModeFromSearch(search) {
  return new URLSearchParams(search).get('mode') === 'sign-up' ? 'sign-up' : 'sign-in';
}

function normalizePhone(value) {
  return String(value || '').replace(/[^\d+]/g, '');
}

function isValidPhone(value) {
  const normalizedPhone = normalizePhone(value);
  const digitCount = normalizedPhone.replace(/\D/g, '').length;
  return digitCount >= 9 && digitCount <= 15;
}

export default function AuthPage() {
  usePageTitle('Đăng nhập');
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [mode, setMode] = useState(() => getAuthModeFromSearch(location.search));
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const redirectTo = location.state?.from || '/dashboard';

  const isSignUp = mode === 'sign-up';
  const requiresProfileCompletion = Boolean(
    auth.session &&
      !auth.isMockMode &&
      auth.ready &&
      (!auth.profile?.full_name || !auth.profile?.phone)
  );
  const cardTitle = useMemo(() => (isSignUp ? 'Tạo tài khoản' : 'Chào mừng bạn trở lại'), [isSignUp]);
  const cardSubtitle = useMemo(
    () =>
      isSignUp
        ? 'Thiết lập hồ sơ học viên nhanh chóng và bắt đầu lộ trình học đầy đủ.'
        : 'Tiếp tục học tập với email, mật khẩu hoặc tài khoản Google.',
    [isSignUp]
  );

  useEffect(() => {
    if (auth.session && !requiresProfileCompletion) {
      navigate(redirectTo, { replace: true });
    }
  }, [auth.session, navigate, redirectTo, requiresProfileCompletion]);

  useEffect(() => {
    setMode(getAuthModeFromSearch(location.search));
  }, [location.search]);

  useEffect(() => {
    if (!auth.session) {
      return;
    }

    if (!fullName && auth.profile?.full_name) {
      setFullName(auth.profile.full_name);
    }

    if (!phone && auth.profile?.phone) {
      setPhone(auth.profile.phone);
    }
  }, [auth.session, auth.profile?.full_name, auth.profile?.phone, fullName, phone]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!email || !password) {
      setMessage('Vui lòng nhập email và mật khẩu.');
      return;
    }

    if (isSignUp && !fullName.trim()) {
      setMessage('Vui lòng nhập họ tên trước khi tạo tài khoản.');
      return;
    }

    if (isSignUp && !isValidPhone(phone)) {
      setMessage('Vui lòng nhập số điện thoại hợp lệ từ 9 đến 15 chữ số.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      if (isSignUp) {
        const result = await auth.signUpWithEmail(email, password, {
          full_name: fullName,
          phone: normalizePhone(phone),
          role: 'student'
        });

        if (result?.error) {
          throw result.error;
        }

        if (result?.data?.session) {
          navigate(getDashboardPathForRole(getEffectiveRole(auth)), { replace: true });
          return;
        }

        setMessage('Tài khoản đã được tạo. Vui lòng kiểm tra email nếu hệ thống yêu cầu xác nhận.');
      } else {
        const result = await auth.signInWithEmail(email, password);

        if (result?.error) {
          throw result.error;
        }

        if (result?.data?.session) {
          navigate(redirectTo, { replace: true });
        }
      }
    } catch (error) {
      setMessage(error.message || 'Đăng nhập chưa thành công.');
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleLogin() {
    if (isSignUp) {
      setMessage('Vui lòng dùng form đăng ký để nhập đủ họ tên, email và số điện thoại.');
      return;
    }

    setBusy(true);
    setMessage('');

    const result = await auth.signInWithGoogle();
    if (result?.error) {
      setMessage(result.error.message);
      setBusy(false);
      return;
    }

    setMessage('Đang chuyển đến Google...');
  }

  async function handleCompleteProfile(event) {
    event.preventDefault();

    if (!fullName.trim()) {
      setMessage('Vui lòng nhập họ tên để hoàn thiện hồ sơ.');
      return;
    }

    if (!isValidPhone(phone)) {
      setMessage('Vui lòng nhập số điện thoại hợp lệ từ 9 đến 15 chữ số.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const normalizedPhone = normalizePhone(phone);
      const { error: profileError } = await auth.supabase.rpc('update_own_contact_profile', {
        profile_full_name: fullName.trim(),
        profile_phone: normalizedPhone
      });

      if (profileError) {
        throw profileError;
      }

      const result = await auth.supabase.auth.updateUser({
        data: {
          full_name: fullName.trim(),
          phone: normalizedPhone
        }
      });

      if (result?.error) {
        throw result.error;
      }

      navigate(redirectTo, { replace: true });
    } catch (error) {
      setMessage(error.message || 'Chưa thể cập nhật hồ sơ. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword() {
    if (!email) {
      setMessage('Vui lòng nhập email trước khi yêu cầu đặt lại mật khẩu.');
      return;
    }

    setBusy(true);
    setMessage('');

    const result = await auth.sendPasswordReset(email);
    if (result?.error) {
      setMessage(result.error.message);
    } else {
      setMessage('Email đặt lại mật khẩu đã được gửi.');
    }

    setBusy(false);
  }

  if (requiresProfileCompletion) {
    return (
      <div className="page auth-page auth-page--enterprise">
        <section className="auth-shell">
          <form className="auth-card auth-card--enterprise" onSubmit={handleCompleteProfile}>
            <div className="auth-card__head">
              <span className="eyebrow">Hoàn thiện hồ sơ</span>
              <h2>Bổ sung thông tin liên hệ</h2>
              <p>Tài khoản cần có họ tên, email và số điện thoại trước khi vào khu học tập.</p>
            </div>

            {message ? <div className="auth-message">{message}</div> : null}

            <div className="auth-fields">
              <label className="auth-field">
                <span>Họ và tên</span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoComplete="name"
                />
              </label>

              <label className="auth-field">
                <span>Email</span>
                <input type="email" value={auth.user?.email || ''} readOnly />
              </label>

              <label className="auth-field">
                <span>Số điện thoại</span>
                <input
                  type="tel"
                  placeholder="0912345678"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  autoComplete="tel"
                />
              </label>
            </div>

            <button type="submit" className="button auth-submit" disabled={busy}>
              {busy ? 'Đang lưu...' : 'Lưu hồ sơ'}
            </button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="page auth-page auth-page--enterprise">
      <section className="auth-shell">
        <aside className="auth-hero">
          <div className="auth-hero__copy">
            <span className="eyebrow auth-hero__badge">Ngoaingu3k Academy</span>
            <h1>Nền tảng học tập chuyên nghiệp cho học viên, giảng viên và quản trị.</h1>
            <p>
              Trải nghiệm đăng nhập rõ ràng, hiện đại, giúp truy cập nhanh vào
              khóa học, tiến độ và bảng điều khiển theo vai trò.
            </p>

            <div className="auth-stat-grid">
              <div className="auth-stat">
                <strong>15k+</strong>
                <span>học viên đang học</span>
              </div>
              <div className="auth-stat">
                <strong>98%</strong>
                <span>hài lòng</span>
              </div>
            </div>

            <div className="auth-points">
              <div>• Đăng nhập bằng email, mật khẩu hoặc Google</div>
              <div>• Phân quyền học viên, giảng viên và quản trị</div>
              <div>• Theo dõi tiến độ học tập theo từng tài khoản</div>
            </div>
          </div>

          <div className="auth-gallery" aria-hidden="true">
            <div className="auth-gallery__main">
              <img src={gallery[0].src} alt="" />
              <div className="auth-gallery__label">
                <span>{gallery[0].title}</span>
                <strong>{gallery[0].meta}</strong>
              </div>
            </div>

            <div className="auth-gallery__stack">
              {gallery.slice(1).map((item) => (
                <article key={item.title} className="auth-gallery__card">
                  <img src={item.src} alt="" />
                  <div>
                    <span>{item.title}</span>
                    <strong>{item.meta}</strong>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </aside>

        <form className="auth-card auth-card--enterprise" onSubmit={handleSubmit}>
          <div className="auth-card__head">
            <span className="eyebrow">Đăng nhập Ngoaingu3k</span>
            <h2>{cardTitle}</h2>
            <p>{cardSubtitle}</p>
          </div>

          <div className="auth-tabs" role="tablist" aria-label="Chế độ đăng nhập">
            <button
              type="button"
              className={mode === 'sign-in' ? 'auth-tab is-active' : 'auth-tab'}
              onClick={() => setMode('sign-in')}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              className={mode === 'sign-up' ? 'auth-tab is-active' : 'auth-tab'}
              onClick={() => setMode('sign-up')}
            >
              Đăng ký
            </button>
          </div>

          {message ? <div className="auth-message">{message}</div> : null}

          <div className="auth-fields">
            {isSignUp ? (
              <label className="auth-field">
                <span>Họ và tên</span>
                <input
                  type="text"
                  placeholder="Alex Johnson"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                />
              </label>
            ) : null}

            {isSignUp ? (
              <label className="auth-field">
                <span>Số điện thoại</span>
                <input
                  type="tel"
                  placeholder="0912345678"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  autoComplete="tel"
                />
              </label>
            ) : null}

            <label className="auth-field">
              <span>Email</span>
              <input
                type="email"
                placeholder="student@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            <label className="auth-field">
              <span className="auth-field__row">
                <span>Mật khẩu</span>
                <button type="button" className="auth-link" onClick={handleResetPassword} disabled={busy}>
                  Quên?
                </button>
              </span>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          </div>

          <button type="submit" className="button auth-submit" disabled={busy}>
            {busy ? 'Vui lòng chờ...' : isSignUp ? 'Tạo tài khoản' : 'Đăng nhập'}
          </button>

          <div className="auth-divider">
            <span />
            <span>Hoặc tiếp tục với</span>
            <span />
          </div>

          <button type="button" className="button button-ghost auth-google" onClick={handleGoogleLogin} disabled={busy}>
            <GoogleLogo />
            <span>{isSignUp ? 'Google dùng sau khi có hồ sơ' : 'Tiếp tục với Google'}</span>
          </button>

          <p className="auth-footnote">
            {isSignUp ? 'Đã có tài khoản?' : 'Mới đến Ngoaingu3k?'}{' '}
            <button type="button" className="auth-link auth-link--inline" onClick={() => setMode(isSignUp ? 'sign-in' : 'sign-up')}>
              {isSignUp ? 'Đăng nhập ngay' : 'Tạo tài khoản'}
            </button>
          </p>
        </form>
      </section>
    </div>
  );
}
