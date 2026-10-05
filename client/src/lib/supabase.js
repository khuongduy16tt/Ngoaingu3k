import { createClient } from '@supabase/supabase-js';
import { authStorage, ensureStorageHeadroom } from './storageGuard';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

let supabaseClient = null;

if (hasSupabaseConfig) {
  try {
    // Dọn bộ đệm nếu storage đã đầy, rồi dùng storage ưu tiên chỗ cho phiên đăng
    // nhập — hết chỗ mà không ghi được phiên mới thì F5 là bị đăng xuất.
    ensureStorageHeadroom();
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { storage: typeof window !== 'undefined' ? authStorage : undefined }
    });
  } catch (error) {
    console.warn('Supabase client initialization failed, falling back to mock mode.', error);
  }
}

export const supabase = supabaseClient;

export function isSupabaseReady() {
  return Boolean(supabase);
}
