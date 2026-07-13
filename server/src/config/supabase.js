import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function stripEnvQuotes(value) {
  const trimmedValue = String(value || '').trim();
  const quote = trimmedValue[0];

  if ((quote === '"' || quote === "'") && trimmedValue.endsWith(quote)) {
    return trimmedValue.slice(1, -1);
  }

  return trimmedValue;
}

function loadLocalEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const envText = readFileSync(filePath, 'utf8');
  envText.split(/\r?\n/).forEach((line) => {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      return;
    }

    const separatorIndex = trimmedLine.indexOf('=');
    if (separatorIndex <= 0) {
      return;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = stripEnvQuotes(trimmedLine.slice(separatorIndex + 1));

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

function loadLocalEnv() {
  const serverRoot = path.resolve(__dirname, '../..');
  const repoRoot = path.resolve(serverRoot, '..');

  loadLocalEnvFile(path.resolve(repoRoot, '.env'));
  loadLocalEnvFile(path.resolve(serverRoot, '.env'));
}

loadLocalEnv();

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
