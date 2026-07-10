import { Router } from 'express';
import { supabaseAdmin, isSupabaseAdminReady } from '../config/supabase.js';
import { mockProgress } from '../data/mock.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/students/:userId/progress
 * Returns learning progress for a user. Requires authentication.
 */
router.get('/:userId/progress', requireAuth, async (req, res) => {
  const { userId } = req.params;

  // Security: non-admins can only see their own progress
  if (req.user.role !== 'admin' && req.user.id !== userId) {
    return res.status(403).json({ message: 'Không đủ quyền truy cập.' });
  }

  if (!isSupabaseAdminReady()) {
    const userProgress = mockProgress.filter((p) => String(p.userId) === String(userId));
    return res.json({ data: userProgress, mode: 'mock' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('progress')
      .select('user_id, lesson_id, completed, last_position_seconds, updated_at')
      .eq('user_id', userId);

    if (error) {
      return res.status(500).json({ message: 'Lỗi truy vấn tiến độ.' });
    }

    return res.json({ data: data || [], mode: 'supabase' });
  } catch (err) {
    console.error('[GET /api/students/:userId/progress]', err.message);
    return res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
});

export default router;
