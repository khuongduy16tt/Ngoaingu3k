import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { mockCourses, mockProgress, mockUsers } from './data/mock.js';

// Route modules
import coursesRouter from './routes/courses.js';
import authRouter from './routes/auth.js';
import progressRouter from './routes/progress.js';
import paymentsRouter from './routes/payments.js';
import adminRouter from './routes/admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '..');
const clientRoot = path.resolve(serverRoot, '..', 'client');
const clientIndexHtml = path.resolve(clientRoot, 'index.html');
const clientDistDir = path.resolve(clientRoot, 'dist');

const port = Number(process.env.PORT || 4000);

function registerApiRoutes(app) {
  // Health check
  app.get('/api/health', (_request, response) => {
    response.json({
      ok: true,
      service: 'ngoaingu3k-api',
      timestamp: new Date().toISOString(),
      supabaseReady: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    });
  });

  // Mount routers
  app.use('/api/courses', coursesRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/students', progressRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/admin', adminRouter);

  // 404 handler for unmatched /api routes
  app.use('/api', (_request, response) => {
    response.status(404).json({ message: 'API route không tồn tại.' });
  });
}

// Global error handler
function registerErrorHandler(app) {
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error('[Server Error]', err.message);
    res.status(err.status || 500).json({
      message: err.message || 'Lỗi máy chủ không xác định.',
    });
  });
}

async function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(morgan('dev'));

  app.get('/', (_request, response) => {
    response.redirect('/home');
  });

  registerApiRoutes(app);

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(clientDistDir));
    app.get('*', (_request, response) => {
      response.sendFile(path.join(clientDistDir, 'index.html'));
    });
    registerErrorHandler(app);
    return app;
  }

  const vite = await createViteServer({
    root: clientRoot,
    appType: 'spa',
    server: {
      middlewareMode: true,
    },
  });

  app.use(vite.middlewares);

  app.use('*', async (request, response, next) => {
    if (request.originalUrl.startsWith('/api')) {
      return next();
    }

    try {
      const url = request.originalUrl;
      let template = await readFile(clientIndexHtml, 'utf-8');
      template = await vite.transformIndexHtml(url, template);
      response.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    } catch (error) {
      vite.ssrFixStacktrace(error);
      next(error);
    }
  });

  registerErrorHandler(app);
  return app;
}

async function start() {
  const app = await createApp();
  app.listen(port, () => {
    console.log(`✅ Ngoaingu3k API running → http://localhost:${port}`);
    console.log(`   Supabase: ${process.env.SUPABASE_URL ? '✓ configured' : '✗ mock mode'}`);
  });
}

start();
