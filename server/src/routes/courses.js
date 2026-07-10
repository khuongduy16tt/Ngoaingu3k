import { Router } from 'express';
import { supabaseAdmin, isSupabaseAdminReady } from '../config/supabase.js';
import { mockCourses } from '../data/mock.js';
import { validate } from '../middleware/validate.js';

const router = Router();

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}

/**
 * GET /api/courses
 * Returns all published courses. Falls back to mock data if Supabase is unavailable.
 */
router.get('/', async (_req, res) => {
  if (!isSupabaseAdminReady()) {
    return res.json({ data: mockCourses, mode: 'mock' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('courses')
      .select('id, slug, title, description, price, status, banner_url, teacher_id, updated_at')
      .eq('status', 'published')
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('[GET /api/courses] Supabase error:', error.message);
      return res.json({ data: mockCourses, mode: 'mock-fallback' });
    }

    return res.json({ data: data || [], mode: 'supabase' });
  } catch (err) {
    console.error('[GET /api/courses]', err.message);
    return res.json({ data: mockCourses, mode: 'mock-fallback' });
  }
});

/**
 * GET /api/courses/:courseId
 * Returns a single course with its chapters and lessons.
 */
router.get('/:courseId', async (req, res) => {
  const { courseId } = req.params;

  if (!isSupabaseAdminReady()) {
    const course = mockCourses.find((c) => c.id === courseId || c.slug === courseId);
    if (!course) return res.status(404).json({ message: 'Không tìm thấy khóa học.' });
    return res.json({ data: course, mode: 'mock' });
  }

  try {
    let courseQuery = supabaseAdmin
      .from('courses')
      .select('id, slug, title, description, price, status, banner_url, teacher_id, updated_at');

    courseQuery = isUuid(courseId)
      ? courseQuery.or(`id.eq.${courseId},slug.eq.${courseId}`)
      : courseQuery.eq('slug', courseId);

    const { data: course, error } = await courseQuery.maybeSingle();

    if (error || !course) {
      return res.status(404).json({ message: 'Không tìm thấy khóa học.' });
    }

    // Fetch chapters and lessons
    const { data: chapters } = await supabaseAdmin
      .from('chapters')
      .select('id, title, position')
      .eq('course_id', course.id)
      .order('position', { ascending: true });

    let sections = [];
    if (chapters?.length) {
      const chapterIds = chapters.map((c) => c.id);
      const { data: lessons } = await supabaseAdmin
        .from('lessons')
        .select('id, chapter_id, title, position, is_preview')
        .in('chapter_id', chapterIds)
        .order('position', { ascending: true });

      const lessonsByChapter = new Map();
      (lessons || []).forEach((lesson) => {
        const arr = lessonsByChapter.get(lesson.chapter_id) || [];
        arr.push(lesson);
        lessonsByChapter.set(lesson.chapter_id, arr);
      });

      sections = chapters.map((chapter) => ({
        title: chapter.title,
        lessons: lessonsByChapter.get(chapter.id) || [],
      }));
    }

    return res.json({ data: { ...course, sections }, mode: 'supabase' });
  } catch (err) {
    console.error('[GET /api/courses/:courseId]', err.message);
    return res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
});

export default router;
