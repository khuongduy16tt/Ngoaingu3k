import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { mockCourses, mockProgress, mockUsers } from './data/mock.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '..');
const clientRoot = path.resolve(serverRoot, '..', 'client');
const clientIndexHtml = path.resolve(clientRoot, 'index.html');
const clientDistDir = path.resolve(clientRoot, 'dist');

const port = Number(process.env.PORT || 4000);

function registerApiRoutes(app) {
  app.get('/api/health', (_request, response) => {
    response.json({
      ok: true,
      service: 'ngoaingu3k-api',
      timestamp: new Date().toISOString()
    });
  });

  app.get('/api/courses', (_request, response) => {
    response.json({ data: mockCourses });
  });

  app.get('/api/courses/:courseId', (request, response) => {
    const course = mockCourses.find((item) => item.id === request.params.courseId);
    if (!course) {
      return response.status(404).json({ message: 'Course not found' });
    }

    return response.json({ data: course });
  });

  app.post('/api/auth/register', (request, response) => {
    response.status(201).json({
      message: 'Register endpoint scaffolded',
      input: request.body
    });
  });

  app.post('/api/auth/login', (request, response) => {
    response.json({
      message: 'Login endpoint scaffolded',
      token: 'dev-token',
      user: mockUsers[0],
      input: request.body
    });
  });

  app.post('/api/auth/google', (_request, response) => {
    response.json({
      message: 'Google OAuth callback scaffolded',
      token: 'google-oauth-token',
      user: mockUsers[0]
    });
  });

  app.post('/api/payments/checkout', (request, response) => {
    response.json({
      message: 'Checkout scaffolded',
      provider: request.body?.provider || 'stripe',
      paymentUrl: 'https://payment-gateway.example/checkout'
    });
  });

  app.get('/api/students/:userId/progress', (request, response) => {
    const userProgress = mockProgress.filter(
      (item) => String(item.userId) === String(request.params.userId)
    );
    response.json({ data: userProgress });
  });

  app.get('/api/admin/stats', (_request, response) => {
    response.json({
      students: mockUsers.filter((user) => user.role === 'student').length,
      teachers: mockUsers.filter((user) => user.role === 'teacher').length,
      admins: mockUsers.filter((user) => user.role === 'admin').length,
      courses: mockCourses.length
    });
  });

  app.use('/api', (_request, response) => {
    response.status(404).json({ message: 'Route not found' });
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
    return app;
  }

  const vite = await createViteServer({
    root: clientRoot,
    appType: 'spa',
    server: {
      middlewareMode: true
    }
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

  return app;
}

async function start() {
  const app = await createApp();
  app.listen(port, () => {
    console.log(`Ngoaingu3k full stack running on http://localhost:${port}`);
  });
}

start();
