import compression from 'compression';
import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import coursesRouter from './routes/courses.js';
import authRouter from './routes/auth.js';
import progressRouter from './routes/progress.js';
import paymentsRouter from './routes/payments.js';
import adminRouter from './routes/admin.js';
import assignmentsRouter from './routes/assignments.js';
import leadsRouter from './routes/leads.js';
import examsRouter from './routes/exams.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '..');
const clientRoot = path.resolve(serverRoot, '..', 'client');
const clientIndexHtml = path.resolve(clientRoot, 'index.html');
const clientDistDir = path.resolve(clientRoot, 'dist');

function registerApiRoutes(app) {
  app.get('/api/health', (_request, response) => {
    response.json({
      ok: true,
      service: 'ngoaingu3k-api',
      timestamp: new Date().toISOString(),
      supabaseReady: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    });
  });

  app.use('/api/courses', coursesRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/students', progressRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/assignments', assignmentsRouter);
  app.use('/api/leads', leadsRouter);
  app.use('/api/exams', examsRouter);

  app.use('/api', (_request, response) => {
    response.status(404).json({ message: 'API route không tồn tại.' });
  });
}

function registerErrorHandler(app) {
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error('[Server Error]', err.message);
    res.status(err.status || 500).json({
      message: err.message || 'Lỗi máy chủ không xác định.',
    });
  });
}

export async function createApp() {
  const app = express();

  // Nén gzip trước mọi route: bundle JS/CSS build ra là text thuần, không nén
  // thì index.js đi nguyên 446KB thay vì ~133KB. Ngưỡng 1KB để khỏi tốn CPU
  // nén những response bé xíu (health, ack) mà chẳng lợi được bao nhiêu byte.
  //
  // Trên Vercel thì bỏ qua: file tĩnh do CDN phục vụ chứ không qua Express, và
  // response của serverless function đã được hạ tầng nén sẵn — bật thêm ở đây
  // chỉ tốn CPU function và có nguy cơ nén chồng.
  if (!process.env.VERCEL) {
    app.use(compression({ threshold: 1024 }));
  }

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(morgan('dev'));

  app.get('/', (_request, response) => {
    response.redirect('/home');
  });

  registerApiRoutes(app);

  const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

  if (isProduction) {
    // Vite đặt hash nội dung vào tên file trong /assets, nên nội dung đổi là
    // tên đổi theo — cache vĩnh viễn được. Mặc định express.static trả
    // max-age=0 khiến trình duyệt phải hỏi lại server từng file mỗi lần vào
    // trang. Ảnh/font trong public/ không có hash nên để 1 ngày rồi
    // revalidate, còn index.html phải luôn tươi để trỏ đúng bundle mới.
    app.use(
      express.static(clientDistDir, {
        index: false,
        setHeaders: (response, filePath) => {
          const relative = path.relative(clientDistDir, filePath).replace(/\\/g, '/');

          if (relative.startsWith('assets/')) {
            response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            return;
          }

          if (relative === 'index.html') {
            response.setHeader('Cache-Control', 'no-cache');
            return;
          }

          response.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate');
        },
      })
    );

    app.get('*', (_request, response) => {
      response.setHeader('Cache-Control', 'no-cache');
      response.sendFile(path.join(clientDistDir, 'index.html'));
    });
    registerErrorHandler(app);
    return app;
  }

  const { createServer: createViteServer } = await import('vite');
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
