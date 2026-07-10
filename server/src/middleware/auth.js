import { supabaseAdmin, isSupabaseAdminReady } from '../config/supabase.js';

/**
 * Auth middleware — verifies the Supabase JWT from the Authorization header.
 * Attaches `req.user` with { id, email, role } on success.
 *
 * If Supabase is not configured, falls back to allowing the request
 * with a mock user (dev mode only).
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    if (!isSupabaseAdminReady()) {
      // Dev fallback: attach mock user
      req.user = { id: 'dev-user', email: 'dev@ngoaingu3k.com', role: 'admin' };
      return next();
    }
    return res.status(401).json({ message: 'Thiếu token xác thực.' });
  }

  if (!isSupabaseAdminReady()) {
    req.user = { id: 'dev-user', email: 'dev@ngoaingu3k.com', role: 'admin' };
    return next();
  }

  const token = header.slice(7);

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
    }

    // Fetch profile role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle();

    req.user = {
      id: data.user.id,
      email: data.user.email,
      role: profile?.role || 'student',
    };

    return next();
  } catch (err) {
    console.error('[Auth middleware]', err.message);
    return res.status(500).json({ message: 'Lỗi xác thực.' });
  }
}

/**
 * Role check middleware — requires the user to have a specific role.
 * Must be used AFTER requireAuth.
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Chưa xác thực.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Không đủ quyền truy cập.' });
    }

    return next();
  };
}
