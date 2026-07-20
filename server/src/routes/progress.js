import { Router } from 'express';
import { supabaseAdmin, isSupabaseAdminReady } from '../config/supabase.js';
import { mockProgress } from '../data/mock.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

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

// Cộng thêm N tháng vào một mốc thời gian ISO — dùng số học Date thuần
// (không có date-fns/dayjs trong repo), chấp nhận lệch vài ngày ở các
// tháng ngắn hơn (VD 31/1 + 1 tháng → 3/3) vì đây chỉ là hạn dùng ước lượng
// cho gói học, không phải tính toán tài chính cần chính xác tuyệt đối.
function addMonthsIso(dateIso, months) {
  if (!dateIso || !months) {
    return null;
  }
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
}

/**
 * GET /api/students/roster
 * Danh sách học sinh (đã có ít nhất 1 đơn hàng "paid") kèm tiến độ buổi học
 * và hạn gói — dùng cho trang Tiến độ học sinh. Teacher chỉ thấy học sinh
 * của khóa mình dạy; admin thấy toàn hệ thống.
 */
router.get('/roster', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  if (!isSupabaseAdminReady()) {
    return res.json({ data: [], mode: 'mock' });
  }

  try {
    let courseQuery = supabaseAdmin
      .from('courses')
      .select('id, title, teacher_id, package_total_sessions, package_duration_months');

    if (req.user.role !== 'admin') {
      courseQuery = courseQuery.eq('teacher_id', req.user.id);
    }

    const { data: courses, error: coursesError } = await courseQuery;
    if (coursesError) throw coursesError;

    const courseIds = (courses || []).map((course) => course.id);
    if (!courseIds.length) {
      return res.json({ data: [], mode: 'supabase' });
    }

    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('user_id, course_id, created_at')
      .eq('status', 'paid')
      .in('course_id', courseIds);
    if (ordersError) throw ordersError;

    if (!orders?.length) {
      return res.json({ data: [], mode: 'supabase' });
    }

    const userIds = [...new Set(orders.map((order) => order.user_id))];

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, phone, created_at')
      .in('id', userIds);
    if (profilesError) throw profilesError;

    const { data: chapters, error: chaptersError } = await supabaseAdmin
      .from('chapters')
      .select('id, course_id')
      .in('course_id', courseIds);
    if (chaptersError) throw chaptersError;

    const chapterIds = (chapters || []).map((chapter) => chapter.id);
    const courseIdByChapterId = new Map((chapters || []).map((chapter) => [chapter.id, chapter.course_id]));

    let lessons = [];
    if (chapterIds.length) {
      const { data, error } = await supabaseAdmin.from('lessons').select('id, chapter_id').in('chapter_id', chapterIds);
      if (error) throw error;
      lessons = data || [];
    }

    const courseIdByLessonId = new Map(
      lessons.map((lesson) => [lesson.id, courseIdByChapterId.get(lesson.chapter_id)])
    );
    const lessonIds = lessons.map((lesson) => lesson.id);

    // sessionsUsed[`${userId}:${courseId}`] = số bài học đã hoàn thành.
    const sessionsUsed = new Map();
    if (lessonIds.length) {
      const { data: completedProgress, error: progressError } = await supabaseAdmin
        .from('progress')
        .select('user_id, lesson_id')
        .eq('completed', true)
        .in('lesson_id', lessonIds)
        .in('user_id', userIds);
      if (progressError) throw progressError;

      (completedProgress || []).forEach((row) => {
        const courseId = courseIdByLessonId.get(row.lesson_id);
        if (!courseId) return;
        const key = `${row.user_id}:${courseId}`;
        sessionsUsed.set(key, (sessionsUsed.get(key) || 0) + 1);
      });
    }

    // Gộp order theo (user, course): lấy order paid gần nhất làm mốc "vào học"
    // hiện tại (renewal-aware — mua lại/gia hạn tạo order mới thay thế hạn cũ).
    const enrollmentByKey = new Map();
    // firstEnrolledAt: mốc paid order đầu tiên của user trong phạm vi (dùng
    // cho thống kê "học sinh mới" — không phân biệt theo khóa).
    const firstEnrolledAtByUser = new Map();

    orders.forEach((order) => {
      const key = `${order.user_id}:${order.course_id}`;
      const existing = enrollmentByKey.get(key);
      if (!existing || new Date(order.created_at) > new Date(existing)) {
        enrollmentByKey.set(key, order.created_at);
      }

      const firstSoFar = firstEnrolledAtByUser.get(order.user_id);
      if (!firstSoFar || new Date(order.created_at) < new Date(firstSoFar)) {
        firstEnrolledAtByUser.set(order.user_id, order.created_at);
      }
    });

    const courseById = new Map((courses || []).map((course) => [course.id, course]));
    const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));

    const roster = Array.from(enrollmentByKey.entries()).map(([key, enrolledAt]) => {
      const [userId, courseId] = key.split(':');
      const course = courseById.get(courseId);
      const profile = profileById.get(userId);
      const used = sessionsUsed.get(key) || 0;
      const total = course?.package_total_sessions ?? null;

      return {
        studentId: userId,
        fullName: profile?.full_name || '',
        email: profile?.email || '',
        phone: profile?.phone || '',
        courseId,
        courseTitle: course?.title || 'Khóa học',
        enrolledAt,
        firstEnrolledAt: firstEnrolledAtByUser.get(userId) || enrolledAt,
        sessionsTotal: total,
        sessionsUsed: used,
        sessionsRemaining: total === null ? null : Math.max(0, total - used),
        expiresAt: addMonthsIso(enrolledAt, course?.package_duration_months || null)
      };
    });

    return res.json({ data: roster, mode: 'supabase' });
  } catch (err) {
    console.error('[GET /api/students/roster]', err.message);
    return res.status(500).json({ message: 'Không thể tải danh sách học sinh.' });
  }
});

export default router;
