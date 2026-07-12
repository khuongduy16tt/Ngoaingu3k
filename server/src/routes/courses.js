import { Router } from 'express';
import { supabaseAdmin, isSupabaseAdminReady } from '../config/supabase.js';
import { mockCourses } from '../data/mock.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
const LESSON_CONTENT_VERSION = 'ngoaingu3k.lesson.v1';

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}

function createCourseSlug(title) {
  return String(title || 'khoa-hoc')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'khoa-hoc';
}

function normalizeNumber(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function buildCoursePayload(course, teacherId) {
  const title = String(course?.title || '').trim();

  return {
    slug: createCourseSlug(course?.slug || title),
    title,
    description: course?.summary || course?.description || '',
    price: normalizeNumber(course?.priceValue ?? course?.price, 0),
    status: course?.status || 'draft',
    teacher_id: teacherId,
    banner_url: course?.bannerUrl || course?.banner_url || null
  };
}

function buildLessonContent(lesson, position) {
  const exercises = Array.isArray(lesson?.exercises)
    ? lesson.exercises
    : Array.isArray(lesson?.questions)
      ? lesson.questions
      : [];

  return JSON.stringify({
    version: LESSON_CONTENT_VERSION,
    note: lesson?.note || '',
    lessonNumber: lesson?.lessonNumber || String(position),
    exerciseType: lesson?.exerciseType || lesson?.type || 'Bài học',
    questionCount: normalizeNumber(lesson?.questionCount ?? exercises.length, exercises.length),
    sourceSheet: lesson?.sourceSheet || '',
    videoTitle: lesson?.videoTitle || lesson?.title || '',
    audioName: lesson?.audioName || '',
    audioUrl: lesson?.audioUrl || '',
    imageName: lesson?.imageName || '',
    imageUrl: lesson?.imageUrl || '',
    exercises
  });
}

function parseLessonContent(content) {
  if (!content) {
    return {};
  }

  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' ? parsed : { content };
  } catch {
    return { content };
  }
}

function getLessonExercises(lesson) {
  return Array.isArray(lesson?.exercises)
    ? lesson.exercises
    : Array.isArray(lesson?.questions)
      ? lesson.questions
      : [];
}

const OPTION_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function normalizeLessonQuestionOption(option, index) {
  if (option && typeof option === 'object') {
    return {
      label: String(option.label || OPTION_LABELS[index] || index + 1).trim().toUpperCase(),
      text: String(option.text || option.value || option.label || '').trim()
    };
  }

  return {
    label: OPTION_LABELS[index] || String(index + 1),
    text: String(option || '').trim()
  };
}

function normalizeCorrectAnswer(answer, options) {
  const rawAnswer = String(answer || '').trim();
  const normalizedAnswer = rawAnswer.toUpperCase();
  const byLabel = options.find((option) => option.label.toUpperCase() === normalizedAnswer);

  if (byLabel) {
    return byLabel.label;
  }

  const byText = options.find((option) => option.text.toLowerCase() === rawAnswer.toLowerCase());
  return byText?.label || rawAnswer;
}

function normalizeLessonQuestion(question, index) {
  const options = Array.isArray(question?.options)
    ? question.options.map(normalizeLessonQuestionOption).filter((option) => option.text)
    : [];
  const prompt = String(question?.prompt || question?.question || '').trim();
  const correctAnswer = normalizeCorrectAnswer(question?.correctAnswer || question?.answer || '', options);

  return {
    id: String(question?.id || `video-question-${index + 1}`).trim(),
    prompt,
    options,
    correctAnswer,
    explanation: String(question?.explanation || question?.note || '').trim()
  };
}

function normalizeLessonRecord(savedLesson, draftLesson, position) {
  const exercises = getLessonExercises(draftLesson);

  return {
    ...draftLesson,
    id: savedLesson.id,
    databaseId: savedLesson.id,
    title: savedLesson.title,
    position: savedLesson.position,
    lessonNumber: draftLesson?.lessonNumber || String(position),
    status: savedLesson.is_preview ? 'active' : draftLesson?.status || 'active',
    videoUrl: savedLesson.video_url || draftLesson?.videoUrl || '',
    videoTitle: draftLesson?.videoTitle || savedLesson.title,
    questionCount: normalizeNumber(draftLesson?.questionCount ?? exercises.length, exercises.length),
    exercises
  };
}

async function saveCourseRecord(course, user) {
  const teacherId = user.id;
  const localCourseId = course?.databaseId || course?.id;
  let existingCourseId = isUuid(localCourseId) ? localCourseId : '';
  const payload = buildCoursePayload(course, teacherId);

  if (existingCourseId) {
    const { data: existingCourse, error } = await supabaseAdmin
      .from('courses')
      .select('id, teacher_id')
      .eq('id', existingCourseId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (existingCourse?.teacher_id && existingCourse.teacher_id !== teacherId && user.role !== 'admin') {
      throw new Error('Bạn không có quyền cập nhật khóa học này.');
    }
  }

  if (!existingCourseId) {
    const { data: existingCourse, error } = await supabaseAdmin
      .from('courses')
      .select('id, teacher_id')
      .eq('slug', payload.slug)
      .maybeSingle();

    if (!error && existingCourse?.teacher_id === teacherId) {
      existingCourseId = existingCourse.id;
    } else if (!error && existingCourse) {
      payload.slug = `${payload.slug}-${Date.now().toString(36)}`;
    }
  }

  if (existingCourseId) {
    const { data, error } = await supabaseAdmin
      .from('courses')
      .upsert({ id: existingCourseId, ...payload }, { onConflict: 'id' })
      .select('id, slug, title, description, price, status, teacher_id, banner_url, created_at, updated_at')
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  const { data, error } = await supabaseAdmin
    .from('courses')
    .insert(payload)
    .select('id, slug, title, description, price, status, teacher_id, banner_url, created_at, updated_at')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function syncChapterLessons(chapterId, lessons = []) {
  const { data: existingLessons, error: existingError } = await supabaseAdmin
    .from('lessons')
    .select('id, position')
    .eq('chapter_id', chapterId)
    .order('position', { ascending: true });

  if (existingError) {
    throw existingError;
  }

  const existingByPosition = new Map((existingLessons || []).map((lesson) => [Number(lesson.position), lesson]));
  const touchedLessonIds = new Set();
  const syncedLessons = [];

  for (const [lessonIndex, lesson] of lessons.entries()) {
    const position = lessonIndex + 1;
    const draftLessonId = lesson?.databaseId || lesson?.id;
    const existingLessonId = isUuid(draftLessonId)
      ? draftLessonId
      : existingByPosition.get(position)?.id;
    const payload = {
      chapter_id: chapterId,
      title: String(lesson?.title || `Bài ${position}`).trim(),
      video_url: lesson?.videoUrl || lesson?.videoEmbedUrl || null,
      content: buildLessonContent(lesson, position),
      position,
      is_preview: Boolean(lesson?.isPreview ?? lesson?.is_preview ?? position === 1)
    };

    const query = existingLessonId
      ? supabaseAdmin.from('lessons').update(payload).eq('id', existingLessonId)
      : supabaseAdmin.from('lessons').insert(payload);

    const { data: savedLesson, error } = await query
      .select('id, chapter_id, title, video_url, content, position, is_preview, created_at')
      .single();

    if (error) {
      throw error;
    }

    touchedLessonIds.add(savedLesson.id);
    syncedLessons.push(normalizeLessonRecord(savedLesson, lesson, position));
  }

  const staleLessonIds = (existingLessons || [])
    .map((lesson) => lesson.id)
    .filter((lessonId) => !touchedLessonIds.has(lessonId));

  if (staleLessonIds.length) {
    const { error } = await supabaseAdmin.from('lessons').delete().in('id', staleLessonIds);
    if (error) {
      throw error;
    }
  }

  return syncedLessons;
}

async function syncCourseSections(courseId, sections = []) {
  const safeSections = Array.isArray(sections) ? sections : [];
  const { data: existingChapters, error: existingError } = await supabaseAdmin
    .from('chapters')
    .select('id, position')
    .eq('course_id', courseId)
    .order('position', { ascending: true });

  if (existingError) {
    throw existingError;
  }

  const existingByPosition = new Map((existingChapters || []).map((chapter) => [Number(chapter.position), chapter]));
  const touchedChapterIds = new Set();
  const syncedSections = [];

  for (const [sectionIndex, section] of safeSections.entries()) {
    const position = sectionIndex + 1;
    const draftChapterId = section?.databaseId || section?.id;
    const existingChapterId = isUuid(draftChapterId)
      ? draftChapterId
      : existingByPosition.get(position)?.id;
    const payload = {
      course_id: courseId,
      title: String(section?.title || `Module ${position}`).trim(),
      position
    };

    const query = existingChapterId
      ? supabaseAdmin.from('chapters').update(payload).eq('id', existingChapterId)
      : supabaseAdmin.from('chapters').insert(payload);

    const { data: savedChapter, error } = await query
      .select('id, course_id, title, position')
      .single();

    if (error) {
      throw error;
    }

    touchedChapterIds.add(savedChapter.id);
    const lessons = await syncChapterLessons(savedChapter.id, section?.lessons || []);
    syncedSections.push({
      ...section,
      id: savedChapter.id,
      databaseId: savedChapter.id,
      title: savedChapter.title,
      position: savedChapter.position,
      lessons
    });
  }

  const staleChapterIds = (existingChapters || [])
    .map((chapter) => chapter.id)
    .filter((chapterId) => !touchedChapterIds.has(chapterId));

  if (staleChapterIds.length) {
    const { error } = await supabaseAdmin.from('chapters').delete().in('id', staleChapterIds);
    if (error) {
      throw error;
    }
  }

  return syncedSections;
}

/**
 * GET /api/courses
 * Returns all published courses. Uses mock data only when Supabase is not configured.
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
      return res.status(500).json({ data: [], message: 'Lỗi truy vấn khóa học.', mode: 'supabase-error' });
    }

    return res.json({ data: data || [], mode: 'supabase' });
  } catch (err) {
    console.error('[GET /api/courses]', err.message);
    return res.status(500).json({ data: [], message: 'Lỗi máy chủ.', mode: 'supabase-error' });
  }
});

/**
 * POST /api/courses/publish
 * Publishes a teacher course and syncs its chapters/lessons with Supabase.
 */
router.post('/publish', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  const course = req.body?.course;

  if (!course?.title) {
    return res.status(400).json({ message: 'Thiếu tên khóa học.' });
  }

  if (!Array.isArray(course.sections) || course.sections.length === 0) {
    return res.status(400).json({ message: 'Khóa học cần có ít nhất một chương hoặc bài học.' });
  }

  if (!isSupabaseAdminReady()) {
    return res.status(503).json({
      message: 'Server chưa có SUPABASE_SERVICE_ROLE_KEY nên chưa thể đồng bộ bài học lên Supabase.'
    });
  }

  try {
    const savedCourse = await saveCourseRecord(course, req.user);
    const sections = await syncCourseSections(savedCourse.id, course.sections);

    return res.json({
      data: {
        ...savedCourse,
        sections
      },
      mode: 'supabase'
    });
  } catch (err) {
    console.error('[POST /api/courses/publish]', err.message);
    return res.status(500).json({
      message: err.message || 'Chưa thể đăng khóa học lên Supabase.'
    });
  }
});

/**
 * PATCH /api/courses/lessons/:lessonId/questions
 * Updates the practice questions that belong directly to a lesson video.
 */
router.patch('/lessons/:lessonId/questions', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  const { lessonId } = req.params;

  if (!isUuid(lessonId)) {
    return res.status(400).json({ message: 'Lesson không hợp lệ để lưu câu hỏi video.' });
  }

  if (!Array.isArray(req.body?.questions)) {
    return res.status(400).json({ message: 'Danh sách câu hỏi phải là một mảng.' });
  }

  if (!isSupabaseAdminReady()) {
    return res.status(503).json({
      message: 'Server chưa có SUPABASE_SERVICE_ROLE_KEY nên chưa thể lưu câu hỏi video lên Supabase.'
    });
  }

  try {
    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from('lessons')
      .select('id, chapter_id, title, video_url, content, position, is_preview')
      .eq('id', lessonId)
      .maybeSingle();

    if (lessonError) {
      throw lessonError;
    }

    if (!lesson) {
      return res.status(404).json({ message: 'Không tìm thấy bài học để lưu câu hỏi.' });
    }

    const { data: chapter, error: chapterError } = await supabaseAdmin
      .from('chapters')
      .select('id, course_id')
      .eq('id', lesson.chapter_id)
      .maybeSingle();

    if (chapterError) {
      throw chapterError;
    }

    if (!chapter) {
      return res.status(404).json({ message: 'Không tìm thấy chương của bài học.' });
    }

    const { data: course, error: courseError } = await supabaseAdmin
      .from('courses')
      .select('id, teacher_id')
      .eq('id', chapter.course_id)
      .maybeSingle();

    if (courseError) {
      throw courseError;
    }

    if (!course) {
      return res.status(404).json({ message: 'Không tìm thấy khóa học của bài học.' });
    }

    if (req.user.role !== 'admin' && course.teacher_id !== req.user.id) {
      return res.status(403).json({ message: 'Bạn không có quyền sửa câu hỏi của bài học này.' });
    }

    const questions = req.body.questions
      .map(normalizeLessonQuestion)
      .filter((question) => question.prompt);
    const metadata = parseLessonContent(lesson.content);
    const nextContent = JSON.stringify({
      ...metadata,
      version: LESSON_CONTENT_VERSION,
      questionCount: questions.length,
      exerciseType: metadata.exerciseType || 'Bài luyện video',
      exercises: questions
    });

    const { data: updatedLesson, error: updateError } = await supabaseAdmin
      .from('lessons')
      .update({ content: nextContent })
      .eq('id', lessonId)
      .select('id, title, content')
      .single();

    if (updateError) {
      throw updateError;
    }

    return res.json({
      data: {
        lessonId: updatedLesson.id,
        questions,
        questionCount: questions.length
      },
      mode: 'supabase'
    });
  } catch (err) {
    console.error('[PATCH /api/courses/lessons/:lessonId/questions]', err.message);
    return res.status(500).json({
      message: err.message || 'Chưa thể lưu câu hỏi video lên Supabase.'
    });
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
        .select('id, chapter_id, title, video_url, content, position, is_preview')
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
