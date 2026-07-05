import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { getDashboardPathForRole, getEffectiveRole } from '../lib/permissions';

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

    if (mode === 'sign-up' && !fullName) {
      setMessage('Please enter your full name before creating an account.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      if (mode === 'sign-up') {
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

        setMessage('Account created. Please check your inbox if Supabase requires email confirmation.');
      } else {
        const result = await auth.signInWithEmail(email, password);

        if (result?.error) {
          throw result.error;
        }

        if (result?.data?.session) {
          setMessage('Signed in successfully.');
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
    <div className="page">
      <section className="auth-layout">
        <div className="auth-copy pastel-card">
          <span className="eyebrow">Authentication</span>
          <h1>Sign up, sign in, and Google OAuth via Supabase.</h1>
          <p>
            New users are created with profiles in the database, while the current role controls navigation and
            interface permissions.
          </p>
          <div className="home-benefits">
            <div className="home-benefit">
              <span aria-hidden="true" />
              <p>Email / password</p>
            </div>
            <div className="home-benefit">
              <span aria-hidden="true" />
              <p>Google OAuth</p>
            </div>
            <div className="home-benefit">
              <span aria-hidden="true" />
              <p>Password reset</p>
            </div>
          </div>
        </div>

        <form className="auth-card pastel-card" onSubmit={handleSubmit}>
          {message ? <div className="auth-message">{message}</div> : null}

          {mode === 'sign-up' ? (
            <label>
              Full name
              <input
                type="text"
                placeholder="Alex Johnson"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </label>
          ) : null}

          <label>
            Email
            <input
              type="email"
              placeholder="student@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label>
            Password
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <div className="auth-actions">
            <button type="submit" className="button" disabled={busy || !auth.supabase}>
              {mode === 'sign-in' ? 'Sign in' : 'Sign up'}
            </button>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
              disabled={busy}
            >
              {mode === 'sign-in' ? 'Switch to sign up' : 'Switch to sign in'}
            </button>
          </div>

          <button
            type="button"
            className="google-button"
            onClick={handleGoogleLogin}
            disabled={busy || !auth.supabase}
          >
            Continue with Google
          </button>

          <button
            type="button"
            className="button button-ghost"
            onClick={handleResetPassword}
            disabled={busy || !auth.supabase}
          >
            Forgot password
          </button>
        </form>
      </section>
    </div>
  );
}
