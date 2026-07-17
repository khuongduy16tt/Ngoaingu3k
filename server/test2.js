import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value.length > 0) {
    envVars[key.trim()] = value.join('=').trim().replace(/^['"]|['"]$/g, '');
  }
});

const supabaseAdmin = createClient(
  envVars['VITE_SUPABASE_URL'] || envVars['SUPABASE_URL'],
  envVars['SUPABASE_SERVICE_ROLE_KEY']
);

async function run() {
  const { data, error } = await supabaseAdmin.from('orders').insert({
    user_id: '48cc9aa4-998b-415d-abfe-31d0d7af6cbf', // dummy uuid
    course_id: '48cc9aa4-998b-415d-abfe-31d0d7af6cbf', // dummy uuid
    status: 'failed',
    amount: 1000
  });
  console.log('Failed:', error);
  
  const { data: data2, error: error2 } = await supabaseAdmin.from('orders').insert({
    user_id: '48cc9aa4-998b-415d-abfe-31d0d7af6cbf', // dummy uuid
    course_id: '48cc9aa4-998b-415d-abfe-31d0d7af6cbf', // dummy uuid
    status: 'canceled',
    amount: 1000
  });
  console.log('Canceled:', error2);
}

run();
