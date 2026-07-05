import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

let supabaseClient = null;

if (hasSupabaseConfig) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.warn('Supabase client initialization failed, falling back to mock mode.', error);
  }
}

export const supabase = supabaseClient;

export function isSupabaseReady() {
  return Boolean(supabase);
}
