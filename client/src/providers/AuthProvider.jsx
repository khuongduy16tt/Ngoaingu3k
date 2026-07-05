import React from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

function readStoredRole() {
  try {
    return localStorage.getItem('role') || 'student';
  } catch {
    return 'student';
  }
}

function writeStoredRole(role) {
  try {
    localStorage.setItem('role', role);
  } catch {
    // Ignore storage errors in restricted browser contexts.
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(() => readStoredRole());
  const [ready, setReady] = useState(!supabase);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    writeStoredRole(role);
  }, [role]);

  async function loadProfile(userId) {
    if (!supabase || !userId) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data) {
      setProfile(data);
      if (data.role) {
        setRole(data.role);
      }
    } else {
      setProfile(null);
    }
  }

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let active = true;
    setLoading(true);

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) {
          setSession(data.session ?? null);
          if (data.session?.user?.id) {
            void loadProfile(data.session.user.id);
          }
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
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user?.id) {
        void loadProfile(nextSession.user.id);
      } else {
        setProfile(null);
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
      user: session?.user ?? null,
      isAuthenticated: Boolean(session),
      signOut: () => supabase?.auth.signOut(),
      signInWithEmail: (email, password) =>
        supabase?.auth.signInWithPassword({ email, password }),
      signUpWithEmail: async (email, password, options = {}) => {
        const result = await supabase?.auth.signUp({
          email,
          password,
          options: {
            data: options
          }
        });
        if (result?.data?.user?.id) {
          await loadProfile(result.data.user.id);
        }
        return result;
      },
      signInWithGoogle: () =>
        supabase?.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth`
          }
        }),
      sendPasswordReset: (email) =>
        supabase?.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`
        })
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
