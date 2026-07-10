import { createApp } from './app.js';

const port = Number(process.env.PORT || 4000);

async function start() {
  const app = await createApp();
  app.listen(port, () => {
    console.log(`✅ Ngoaingu3k API running → http://localhost:${port}`);
    console.log(`   Supabase: ${process.env.SUPABASE_URL ? '✓ configured' : '✗ mock mode'}`);
  });
}

start();
