import type { Role } from './database';

export interface AuthUser {
  id: string;
  email?: string;
}

export interface AuthSession {
  user: AuthUser;
  access_token: string;
}

export interface AuthProfile {
  id: string;
  full_name: string;
  phone?: string;
  role: Role;
  avatar_url?: string;
}

export interface AuthContextValue {
  ready: boolean;
  loading: boolean;
  session: AuthSession | null;
  profile: AuthProfile | null;
  role: Role;
  setRole: (role: Role) => void;
  supabase: unknown;
  isMockMode: boolean;
  user: AuthUser | null;
  isAuthenticated: boolean;
  signOut: () => Promise<unknown> | undefined;
  signInWithEmail: (email: string, password: string) => Promise<unknown> | undefined;
  signUpWithEmail: (email: string, password: string, options?: Record<string, string>) => Promise<unknown>;
  signInWithGoogle: () => Promise<unknown> | undefined;
  sendPasswordReset: (email: string) => Promise<unknown> | undefined;
}
