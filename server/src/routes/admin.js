import { Router } from 'express';
import { supabaseAdmin, isSupabaseAdminReady } from '../config/supabase.js';
import { mockCourses, mockUsers } from '../data/mock.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// All admin routes require authentication + admin role
router.use(requireAuth, requireRole('admin'));

/**
 * GET /api/admin/stats
 * Returns aggregate platform statistics.
 */
router.get('/stats', async (_req, res) => {
  if (!isSupabaseAdminReady()) {
    return res.json({
      students: mockUsers.filter((u) => u.role === 'student').length,
      teachers: mockUsers.filter((u) => u.role === 'teacher').length,
      admins: mockUsers.filter((u) => u.role === 'admin').length,
      courses: mockCourses.length,
      mode: 'mock',
    });
  }

  try {
    const [profilesRes, coursesRes, ordersRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('role'),
      supabaseAdmin.from('courses').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('orders').select('status').eq('status', 'paid'),
    ]);

    const profiles = profilesRes.data || [];

    return res.json({
      students: profiles.filter((p) => p.role === 'student').length,
      teachers: profiles.filter((p) => p.role === 'teacher').length,
      admins: profiles.filter((p) => p.role === 'admin').length,
      courses: coursesRes.count || 0,
      paidOrders: (ordersRes.data || []).length,
      mode: 'supabase',
    });
  } catch (err) {
    console.error('[GET /api/admin/stats]', err.message);
    return res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
});

/**
 * GET /api/admin/users
 * Returns all user profiles.
 */
router.get('/users', async (_req, res) => {
  if (!isSupabaseAdminReady()) {
    return res.json({ data: mockUsers, mode: 'mock' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, phone, role, avatar_url, created_at')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ message: 'Lỗi truy vấn.' });
    return res.json({ data: data || [], mode: 'supabase' });
  } catch (err) {
    console.error('[GET /api/admin/users]', err.message);
    return res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
});

/**
 * PATCH /api/admin/users/:userId
 * Updates a user's role or profile info.
 */
router.patch('/users/:userId', async (req, res) => {
  const { userId } = req.params;
  const { role, full_name, phone } = req.body;

  if (!isSupabaseAdminReady()) {
    return res.json({ message: 'Cập nhật thành công (mock mode).', mode: 'mock' });
  }

  try {
    const updates = {};
    if (role) updates.role = role;
    if (full_name) updates.full_name = full_name;
    if (phone !== undefined) updates.phone = phone;
    updates.updated_at = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (error) return res.status(400).json({ message: error.message });
    return res.json({ message: 'Cập nhật thành công.', mode: 'supabase' });
  } catch (err) {
    console.error('[PATCH /api/admin/users/:userId]', err.message);
    return res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
});

export default router;
