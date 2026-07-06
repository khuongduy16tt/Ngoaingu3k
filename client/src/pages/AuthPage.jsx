import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { getDashboardPathForRole, getEffectiveRole } from '../lib/permissions';

const gallery = [
  {
    src: '/images/imported/12.5_KH-TT-scaled.webp',
    title: 'Online learning',
    meta: 'Live classes · progress tracking'
  },
  {
    src: '/images/imported/11.4_KH-TA-scaled.webp',
    title: 'Exam prep',
    meta: 'IELTS · HSK · placement tests'
  },
  {
    src: '/images/imported/8.4_Trang-chu_GT-TT.webp',
    title: 'Trusted by learners',
    meta: 'Sales-ready demo for clients'
  }
];

export default function AuthPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [mode, setMode] = useState('sign-in');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const redirectTo = location.state?.from || '/dashboard';

  const isSignUp = mode === 'sign-up';
  const cardTitle = useMemo(() => (isSignUp ? 'Create your account' : 'Welcome back'), [isSignUp]);
  const cardSubtitle = useMemo(
    () =>
      isSignUp
        ? 'Set up a student profile in seconds and unlock the full learning path.'
        : 'Continue your linguistic journey with email, password, or Google sign-in.',
    [isSignUp]
  );

  useEffect(() => {
    if (auth.session) {
      navigate(redirectTo, { replace: true });
    }
  }, [auth.session, navigate, redirectTo]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!auth.supabase) {
      setMessage('Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return;
    }

    if (!email || !password) {
      setMessage('Please enter both email and password.');
      return;
    }

    if (isSignUp && !fullName.trim()) {
      setMessage('Please enter your full name before creating an account.');
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

        setMessage('Account created. Please check your inbox if email confirmation is required.');
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
      setMessage(error.message || 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleLogin() {
    if (!auth.supabase) {
      setMessage('Supabase is not configured yet. Google OAuth will work after the env is connected.');
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

    setMessage('Redirecting to Google...');
  }

  async function handleResetPassword() {
    if (!auth.supabase) {
      setMessage('Supabase is not configured yet, so the reset email cannot be sent.');
      return;
    }

    if (!email) {
      setMessage('Enter your email before requesting a reset.');
      return;
    }

    setBusy(true);
    setMessage('');

    const result = await auth.sendPasswordReset(email);
    if (result?.error) {
      setMessage(result.error.message);
    } else {
      setMessage('Password reset email sent.');
    }

    setBusy(false);
  }

  return (
    <div className="page auth-page auth-page--enterprise">
      <section className="auth-shell">
        <aside className="auth-hero">
          <div className="auth-hero__copy">
            <span className="eyebrow auth-hero__badge">Ngoaingu3k Academy</span>
            <h1>Enterprise learning, ready for demo and real operations.</h1>
            <p>
              A clean, business-ready login experience for students, teachers, and admins — with fast access to
              courses, progress, and role-based dashboards.
            </p>

            <div className="auth-stat-grid">
              <div className="auth-stat">
                <strong>15k+</strong>
                <span>active learners</span>
              </div>
              <div className="auth-stat">
                <strong>98%</strong>
                <span>satisfaction</span>
              </div>
            </div>

            <div className="auth-points">
              <div>• Email / password / Google OAuth</div>
              <div>• Student, teacher, and admin roles</div>
              <div>• Progress saved through Supabase</div>
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
            <span className="eyebrow">Ngoaingu3k Login</span>
            <h2>{cardTitle}</h2>
            <p>{cardSubtitle}</p>
          </div>

          <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              className={mode === 'sign-in' ? 'auth-tab is-active' : 'auth-tab'}
              onClick={() => setMode('sign-in')}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === 'sign-up' ? 'auth-tab is-active' : 'auth-tab'}
              onClick={() => setMode('sign-up')}
            >
              Sign up
            </button>
          </div>

          {message ? <div className="auth-message">{message}</div> : null}

          <div className="auth-fields">
            {isSignUp ? (
              <label className="auth-field">
                <span>Full name</span>
                <input
                  type="text"
                  placeholder="Alex Johnson"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                />
              </label>
            ) : null}

            <label className="auth-field">
              <span>Email address</span>
              <input
                type="email"
                placeholder="student@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            <label className="auth-field">
              <span className="auth-field__row">
                <span>Password</span>
                <button type="button" className="auth-link" onClick={handleResetPassword} disabled={busy}>
                  Forgot?
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
            {busy ? 'Please wait...' : isSignUp ? 'Create account' : 'Sign in'}
          </button>

          <div className="auth-divider">
            <span />
            <span>Or continue with</span>
            <span />
          </div>

          <button type="button" className="button button-ghost auth-google" onClick={handleGoogleLogin} disabled={busy || !auth.supabase}>
            Continue with Google
          </button>

          <p className="auth-footnote">
            {isSignUp ? 'Already have an account?' : 'New to Ngoaingu3k?'}{' '}
            <button type="button" className="auth-link auth-link--inline" onClick={() => setMode(isSignUp ? 'sign-in' : 'sign-up')}>
              {isSignUp ? 'Sign in now' : 'Create an account'}
            </button>
          </p>
        </form>
      </section>
    </div>
  );
}
