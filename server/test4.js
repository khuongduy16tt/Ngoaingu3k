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
  const { data: user } = await supabaseAdmin.from('profiles').select('id').limit(1).single();
  const { data: course } = await supabaseAdmin.from('courses').select('id').limit(1).single();
  
  if (!user || !course) return;

  const { data: order, error: insertError } = await supabaseAdmin.from('orders').insert({
    user_id: user.id,
    course_id: course.id,
    status: 'paid',
    amount: 1000
  }).select('id').single();
  
  if (insertError) {
    console.log('Insert error:', insertError);
    return;
  }
  
  const statusesToTest = ['failed', 'canceled', 'refunded', 'pending', 'pending_payment', 'awaiting_admin'];
  for (const st of statusesToTest) {
    const { error: updateError } = await supabaseAdmin.from('orders').update({
      status: st
    }).eq('id', order.id);
    console.log(`Update to ${st}:`, updateError ? 'FAILED' : 'SUCCESS');
  }
  
  await supabaseAdmin.from('orders').delete().eq('id', order.id);
}

run();
