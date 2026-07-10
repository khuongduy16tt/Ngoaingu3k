import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient = null;

if (supabaseUrl && supabaseServiceKey) {
  try {
    adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });
  } catch (error) {
    console.warn('Supabase admin client init failed, using mock mode.', error.message);
  }
}

export const supabaseAdmin = adminClient;

export function isSupabaseAdminReady() {
  return Boolean(supabaseAdmin);
}
