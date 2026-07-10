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

function getAuthModeFromSearch(search) {
  return new URLSearchParams(search).get('mode') === 'sign-up' ? 'sign-up' : 'sign-in';
}

export default function AuthPage() {
  usePageTitle('Đăng nhập');
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [mode, setMode] = useState(() => getAuthModeFromSearch(location.search));
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const redirectTo = location.state?.from || '/dashboard';

  const isSignUp = mode === 'sign-up';
  const cardTitle = useMemo(() => (isSignUp ? 'Tạo tài khoản' : 'Chào mừng bạn trở lại'), [isSignUp]);
  const cardSubtitle = useMemo(
    () =>
      isSignUp
        ? 'Thiết lập hồ sơ học viên nhanh chóng và bắt đầu lộ trình học đầy đủ.'
        : 'Tiếp tục học tập với email, mật khẩu hoặc tài khoản Google.',
    [isSignUp]
  );

  useEffect(() => {
    if (auth.session) {
      navigate(redirectTo, { replace: true });
    }
  }, [auth.session, navigate, redirectTo]);

  useEffect(() => {
    setMode(getAuthModeFromSearch(location.search));
  }, [location.search]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!auth.supabase) {
      setMessage('Hệ thống đăng nhập chưa sẵn sàng. Vui lòng thử lại sau.');
      return;
    }

    if (!email || !password) {
      setMessage('Vui lòng nhập email và mật khẩu.');
      return;
    }

    if (isSignUp && !fullName.trim()) {
      setMessage('Vui lòng nhập họ tên trước khi tạo tài khoản.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      if (isSignUp) {
        const result = await auth.signUpWithEmail(email, password, {
          full_name: fullName,
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
    if (!auth.supabase) {
      setMessage('Đăng nhập bằng Google chưa sẵn sàng. Vui lòng thử lại sau.');
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

  async function handleResetPassword() {
    if (!auth.supabase) {
      setMessage('Chưa thể gửi email đặt lại mật khẩu. Vui lòng thử lại sau.');
      return;
    }

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

          <button type="submit" className="button auth-submit" disabled={busy || !auth.supabase}>
            {busy ? 'Vui lòng chờ...' : isSignUp ? 'Tạo tài khoản' : 'Đăng nhập'}
          </button>

          <div className="auth-divider">
            <span />
            <span>Hoặc tiếp tục với</span>
            <span />
          </div>

          <button type="button" className="button button-ghost auth-google" onClick={handleGoogleLogin} disabled={busy || !auth.supabase}>
            Tiếp tục với Google
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
