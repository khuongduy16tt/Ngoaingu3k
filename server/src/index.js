import { createApp } from './app.js';

const port = Number(process.env.PORT || 4000);
const supabaseAdminReady = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

async function start() {
  const app = await createApp();
  app.listen(port, () => {
    console.log(`✅ Ngoaingu3k API running → http://localhost:${port}`);
    console.log(`   Supabase admin: ${supabaseAdminReady ? '✓ configured' : '✗ missing server env'}`);
  });
}

start();
