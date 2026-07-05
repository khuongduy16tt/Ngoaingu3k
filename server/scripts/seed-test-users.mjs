import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function loadEnvFile() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }

  const envPath = resolve(process.cwd(), '.env');

  try {
    const content = await readFile(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
        continue;
      }

      const separatorIndex = trimmed.indexOf('=');
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Ignore missing env file; fallback to process.env.
  }
}

await loadEnvFile();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const testAccounts = [
  {
    email: 'student.test@ngoaingu3k.local',
    password: 'Test@123456',
    full_name: 'Test Student',
    role: 'student'
  },
  {
    email: 'teacher.test@ngoaingu3k.local',
    password: 'Test@123456',
    full_name: 'Test Teacher',
    role: 'teacher'
  },
  {
    email: 'admin.test@ngoaingu3k.local',
    password: 'Test@123456',
    full_name: 'Test Admin',
    role: 'admin'
  }
];

async function fetchJson(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const errorMessage = typeof data === 'string' ? data : data?.msg || data?.message || response.statusText;
    throw new Error(`${path} failed (${response.status}): ${errorMessage}`);
  }

  return data;
}

async function findUserByEmail(email) {
  let page = 1;

  while (page <= 10) {
    const result = await fetchJson(`/auth/v1/admin/users?page=${page}&per_page=100`, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    });

    const users = result?.users ?? [];
    const match = users.find((user) => user.email === email);
    if (match) {
      return match;
    }

    if (users.length < 100) {
      return null;
    }

    page += 1;
  }

  return null;
}

async function createOrReuseUser(account) {
  const existing = await findUserByEmail(account.email);
  if (existing) {
    return existing;
  }

  const created = await fetchJson('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: {
        full_name: account.full_name,
        role: account.role
      }
    })
  });

  return created.user ?? created;
}

async function upsertProfile(user, account) {
  await fetchJson('/rest/v1/profiles?on_conflict=id', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify([
      {
        id: user.id,
        full_name: account.full_name,
        role: account.role,
        avatar_url: null
      }
    ])
  });
}

async function main() {
  console.log('Seeding test accounts...');

  for (const account of testAccounts) {
    const user = await createOrReuseUser(account);
    await upsertProfile(user, account);
    console.log(`OK: ${account.role} -> ${account.email} / ${account.password}`);
  }

  console.log('Done.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
