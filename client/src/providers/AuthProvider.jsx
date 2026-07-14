import React from 'react';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityService';

const AuthContext = createContext(null);
const MOCK_AUTH_STORAGE_KEY = 'ngoaingu3k-mock-auth';
const MOCK_DEFAULT_ROLE = 'student';
const validRoles = ['student', 'teacher', 'admin'];

function normalizeRole(role) {
  return validRoles.includes(role) ? role : 'student';
}

function writeStoredRole(role) {
  try {
    localStorage.setItem('role', role);
  } catch {
    // Ignore storage errors in restricted browser contexts.
  }
}

function readStoredMockAuth(fallbackRole) {
  try {
    const rawValue = localStorage.getItem(MOCK_AUTH_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue);
    if (!parsed?.session?.user?.email) {
      return null;
    }

    return createMockAuthState({
      email: parsed.session.user.email,
      fullName: parsed.profile?.full_name || parsed.session.user.user_metadata?.full_name,
      phone: parsed.profile?.phone || parsed.session.user.user_metadata?.phone,
      role: fallbackRole
    });
  } catch {
    return null;
  }
}

function writeStoredMockAuth(authState) {
  try {
    localStorage.setItem(MOCK_AUTH_STORAGE_KEY, JSON.stringify(authState));
  } catch {
    // Ignore storage errors in restricted browser contexts.
  }
}

function clearStoredMockAuth() {
  try {
    localStorage.removeItem(MOCK_AUTH_STORAGE_KEY);
  } catch {
    // Ignore storage errors in restricted browser contexts.
  }
}

function createMockAuthState({ email, fullName, phone, role }) {
  const normalizedRole = normalizeRole(role);
  const normalizedEmail = email || `${normalizedRole}.demo@ngoaingu3k.local`;
  const normalizedName = fullName || normalizedEmail;
  const normalizedPhone = phone || '';
  const user = {
    id: `local-${normalizedRole}`,
    email: normalizedEmail,
    app_metadata: { provider: 'mock' },
    user_metadata: {
      full_name: normalizedName,
      phone: normalizedPhone,
      role: normalizedRole
    }
  };
  const profile = {
    id: user.id,
    full_name: normalizedName,
    phone: normalizedPhone,
    role: normalizedRole,
    avatar_url: '',
    source: 'local'
  };

  return {
    session: {
      access_token: 'dev-token',
      token_type: 'bearer',
      user
    },
    profile
  };
}

export function AuthProvider({ children }) {
  const initialRole = supabase ? 'student' : MOCK_DEFAULT_ROLE;
  const initialMockAuth = supabase ? null : readStoredMockAuth(initialRole);
  const [session, setSession] = useState(initialMockAuth?.session ?? null);
  const [profile, setProfile] = useState(initialMockAuth?.profile ?? null);
  const [role, setRoleState] = useState(() =>
    normalizeRole(initialMockAuth?.profile?.role || initialRole)
  );
  const [ready, setReady] = useState(!supabase);
  const [loading, setLoading] = useState(Boolean(supabase));
  const skipNextLoginLogRef = useRef(false);

  useEffect(() => {
    if (!supabase) {
      writeStoredRole(role);
    }
  }, [role]);

  async function loadProfile(userId) {
    if (!supabase || !userId) {
      setProfile(null);
      setRoleState('student');
      return null;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone, role, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data) {
      setProfile(data);
      if (data.role) {
        setRoleState(normalizeRole(data.role));
      }
      return data;
    } else {
      setProfile(null);
      setRoleState('student');
      return null;
    }
  }

  function setRole(nextRole) {
    const normalizedRole = normalizeRole(nextRole);
    setRoleState(normalizedRole);

    if (!supabase) {
      setProfile((previousProfile) =>
        previousProfile ? { ...previousProfile, role: normalizedRole } : previousProfile
      );
      setSession((previousSession) => {
        if (!previousSession?.user) {
          return previousSession;
        }

        const nextAuthState = createMockAuthState({
          email: previousSession.user.email,
          fullName: previousSession.user.user_metadata?.full_name,
          phone: previousSession.user.user_metadata?.phone,
          role: normalizedRole
        });
        writeStoredMockAuth(nextAuthState);
        return nextAuthState.session;
      });
    }
  }

  async function signInMock(email, options = {}) {
    const nextAuthState = createMockAuthState({
      email,
      fullName: options.full_name || options.fullName,
      phone: options.phone,
      role: options.role || role
    });

    setSession(nextAuthState.session);
    setProfile(nextAuthState.profile);
    setRoleState(nextAuthState.profile.role);
    writeStoredRole(nextAuthState.profile.role);
    writeStoredMockAuth(nextAuthState);
    void logActivity(nextAuthState.session.user.id, 'login');

    return {
      data: {
        session: nextAuthState.session,
        user: nextAuthState.session.user
      },
      error: null
    };
  }

  async function updateProfile(updates) {
    if (!supabase) {
      // Mock mode: update local state only
      setProfile((prev) => prev ? { ...prev, ...updates } : prev);
      return { error: null };
    }

    const userId = session?.user?.id;
    if (!userId) return { error: new Error('Không có user') };

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (!error) {
      setProfile((prev) => prev ? { ...prev, ...updates } : prev);
    }
    return { error };
  }

  async function signOut() {
    const userId = session?.user?.id;
    if (userId) {
      void logActivity(userId, 'logout');
    }

    if (!supabase) {
      clearStoredMockAuth();
      setSession(null);
      setProfile(null);
      return { error: null };
    }

    return supabase.auth.signOut();
  }

  async function signInWithEmail(email, password) {
    if (!supabase) {
      return signInMock(email);
    }

    return supabase.auth.signInWithPassword({ email, password });
  }

  async function signUpWithEmail(email, password, options = {}) {
    if (!supabase) {
      const result = await signInMock(email, options);
      if (result?.data?.user?.id) {
        void logActivity(result.data.user.id, 'signup');
      }
      return result;
    }

    skipNextLoginLogRef.current = true;
    const result = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: options
      }
    });
    if (result?.data?.user?.id) {
      void logActivity(result.data.user.id, 'signup');
      await loadProfile(result.data.user.id);
    }
    return result;
  }

  function signInWithGoogle() {
    if (!supabase) {
      return signInMock('google.demo@ngoaingu3k.local', {
        full_name: 'Google Demo User',
        phone: ''
      });
    }

    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth`
      }
    });
  }

  function sendPasswordReset(email) {
    if (!supabase) {
      return Promise.resolve({ data: { email }, error: null });
    }

    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`
    });
  }

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let active = true;
    setLoading(true);

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!active) {
          return;
        }

        const nextSession = data.session ?? null;
        setSession(nextSession);
        if (nextSession?.user?.id) {
          await loadProfile(nextSession.user.id);
        } else {
          setProfile(null);
          setRoleState('student');
        }

        if (active) {
          setReady(true);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setSession(null);
          setProfile(null);
          setReady(true);
          setLoading(false);
        }
      });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!active) {
        return;
      }

      if (event === 'SIGNED_IN' && nextSession?.user?.id) {
        if (skipNextLoginLogRef.current) {
          skipNextLoginLogRef.current = false;
        } else {
          void logActivity(nextSession.user.id, 'login');
        }
      }

      setLoading(true);
      setReady(false);
      setSession(nextSession);
      if (nextSession?.user?.id) {
        await loadProfile(nextSession.user.id);
      } else {
        setProfile(null);
        setRoleState('student');
      }
      if (!active) {
        return;
      }
      setReady(true);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      ready,
      loading,
      session,
      profile,
      role,
      setRole,
      supabase,
      isMockMode: !supabase,
      user: session?.user ?? null,
      isAuthenticated: Boolean(session),
      signOut,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      sendPasswordReset,
      updateProfile
    }),
    [loading, profile, ready, role, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('AuthProvider is missing');
  }
  return context;
}
