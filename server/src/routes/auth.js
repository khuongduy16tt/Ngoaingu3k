import { Router } from 'express';
import { supabaseAdmin, isSupabaseAdminReady } from '../config/supabase.js';
import { mockUsers } from '../data/mock.js';
import { validate } from '../middleware/validate.js';

const router = Router();

/**
 * POST /api/auth/register
 * Creates a new user account via Supabase.
 */
router.post('/register', validate(['email', 'password']), async (req, res) => {
  const { email, password, full_name, role = 'student' } = req.body;

  if (!isSupabaseAdminReady()) {
    // Scaffolded response in mock mode
    return res.status(201).json({
      message: 'Đăng ký thành công (mock mode).',
      user: { id: `mock-${Date.now()}`, email, role },
      mode: 'mock',
    });
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    return res.status(201).json({ message: 'Đăng ký thành công.', user: data.user });
  } catch (err) {
    console.error('[POST /api/auth/register]', err.message);
    return res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
});

/**
 * POST /api/auth/login
 * Authenticates with Supabase email + password.
 */
router.post('/login', validate(['email', 'password']), async (req, res) => {
  const { email, password } = req.body;

  if (!isSupabaseAdminReady()) {
    return res.json({
      message: 'Đăng nhập thành công (mock mode).',
      token: 'dev-token',
      user: mockUsers[0],
      mode: 'mock',
    });
  }

  try {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });

    if (error) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng.' });
    }

    return res.json({
      message: 'Đăng nhập thành công.',
      token: data.session.access_token,
      user: data.user,
    });
  } catch (err) {
    console.error('[POST /api/auth/login]', err.message);
    return res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
});

/**
 * POST /api/auth/google
 * Google OAuth — returns the redirect URL for the client to follow.
 * Actual token exchange is handled client-side via Supabase JS SDK.
 */
router.post('/google', (_req, res) => {
  res.json({
    message: 'Sử dụng Supabase JS SDK phía client để đăng nhập Google.',
    provider: 'google',
    mode: 'client-side',
  });
});

export default router;
