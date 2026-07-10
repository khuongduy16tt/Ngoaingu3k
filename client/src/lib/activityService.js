import { supabase, isSupabaseReady } from './supabase';

// Local storage fallback key
const LOCAL_LOG_KEY = 'user-activity-log-local';

// ─── Ghi log hoạt động ───────────────────────────────────────────────────────

/**
 * Ghi một hành động của user vào Supabase hoặc localStorage.
 * @param {string} userId
 * @param {string} action - 'login' | 'logout' | 'signup' | 'view_lesson' | 'complete_lesson' | 'complete_exercise' | 'purchase' | 'view_course'
 * @param {string} [targetId] - ID của bài học / khóa học / assignment
 * @param {string} [targetTitle] - Tên hiển thị
 * @param {object} [metadata] - Dữ liệu bổ sung
 */
export async function logActivity(userId, action, targetId = null, targetTitle = null, metadata = {}) {
  if (!userId) return;

  const entry = {
    user_id: userId,
    action,
    target_id: targetId,
    target_title: targetTitle,
    metadata,
    created_at: new Date().toISOString(),
  };

  if (isSupabaseReady()) {
    try {
      await supabase.from('user_activity_logs').insert(entry);
    } catch (err) {
      console.warn('[logActivity] Supabase insert failed:', err.message);
      _appendLocalLog(entry);
    }
  } else {
    _appendLocalLog(entry);
  }
}

// ─── Đọc log ─────────────────────────────────────────────────────────────────

/**
 * Lấy lịch sử hoạt động của một user (hoặc tất cả nếu là admin).
 * @param {string|null} userId - null = lấy tất cả (admin only)
 * @param {{ limit?: number, action?: string, from?: string, to?: string }} [opts]
 */
export async function getActivityLogs(userId = null, opts = {}) {
  const { limit = 100, action = null, from = null, to = null } = opts;

  if (!isSupabaseReady()) {
    return _getLocalLogs(userId);
  }

  try {
    let query = supabase
      .from('user_activity_logs')
      .select('id, user_id, action, target_id, target_title, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (userId) query = query.eq('user_id', userId);
    if (action) query = query.eq('action', action);
    if (from)   query = query.gte('created_at', from);
    if (to)     query = query.lte('created_at', to);

    const { data, error } = await query;
    if (error) {
      console.warn('[getActivityLogs]', error.message);
      return _getLocalLogs(userId);
    }
    return data || [];
  } catch {
    return _getLocalLogs(userId);
  }
}

// ─── Local storage fallback ───────────────────────────────────────────────────

function _appendLocalLog(entry) {
  try {
    const raw = localStorage.getItem(LOCAL_LOG_KEY);
    const logs = raw ? JSON.parse(raw) : [];
    logs.unshift(entry);
    // Giữ tối đa 500 entries
    localStorage.setItem(LOCAL_LOG_KEY, JSON.stringify(logs.slice(0, 500)));
  } catch {
    // ignore
  }
}

function _getLocalLogs(userId) {
  try {
    const raw = localStorage.getItem(LOCAL_LOG_KEY);
    const logs = raw ? JSON.parse(raw) : [];
    if (!userId) return logs;
    return logs.filter((l) => l.user_id === userId);
  } catch {
    return [];
  }
}
