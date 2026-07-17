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

const supabaseUrl = envVars['VITE_SUPABASE_URL'] || envVars['SUPABASE_URL'];
const supabaseServiceRoleKey = envVars['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.log('Missing Supabase credentials');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function run() {
  console.log('Checking orders schema...');
  // check if type enum exists
  const { data: enumData, error: enumError } = await supabaseAdmin.rpc('get_enum_values', { enum_type_name: 'order_status' });
  if (enumError) {
    console.log('Error fetching enum or function does not exist', enumError.message);
  } else {
    console.log('Enum values:', enumData);
  }
  
  const { data: user } = await supabaseAdmin.from('profiles').select('id').limit(1).single();
  const { data: course } = await supabaseAdmin.from('courses').select('id').limit(1).single();
  
  if (!user || !course) {
    console.log('User or course missing');
    return;
  }
  
  const { data: order, error: insertError } = await supabaseAdmin.from('orders').insert({
    user_id: user.id,
    course_id: course.id,
    status: 'paid',
    amount: 1000
  }).select('id, status').single();
  
  if (insertError) {
    console.log('Insert error:', insertError);
    return;
  }
  console.log('Inserted order:', order);
  
  const { data: updatedOrder, error: updateError } = await supabaseAdmin.from('orders').update({
    status: 'cancelled'
  }).eq('id', order.id).select('id, status').single();
  
  if (updateError) {
    console.log('Update error:', updateError);
  } else {
    console.log('Updated order:', updatedOrder);
  }
  
  // cleanup
  await supabaseAdmin.from('orders').delete().eq('id', order.id);
}

run();
