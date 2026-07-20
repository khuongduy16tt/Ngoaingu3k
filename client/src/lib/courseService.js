import { supabase, isSupabaseReady } from './supabase';
import { apiFetch } from './api';
import { logActivity } from '../lib/activityService';
import { featuredCourses as mockCourses, courseDetail as mockCourseDetail } from '../data/mock';
import { formatVnd, normalizeVndAmount } from './money';
import {
  createManualPaymentOrder,
  confirmManualPaymentTransfer,
  findPaymentOrderForCourse,
  upsertPaymentOrder
} from './paymentService';
import {
  PURCHASED_COURSES_STORAGE_KEY,
  getPurchasedCourseIds,
  grantPurchasedCourseId,
  setPurchasedCourseIds
} from './purchaseStorage';

const TEACHER_MANAGED_COURSES_KEY = 'teacher-managed-courses-v1';
const LESSON_CONTENT_VERSION = 'ngoaingu3k.lesson.v1';

export { PURCHASED_COURSES_STORAGE_KEY };

export function readTeacherManagedCourses(teacherId = 'local') {
  try {
    const rawValue = localStorage.getItem(`${TEACHER_MANAGED_COURSES_KEY}:${teacherId}`);
    const courses = rawValue ? JSON.parse(rawValue) : [];
    return Array.isArray(courses) ? courses : [];
  } catch {
    return [];
  }
}

export function writeTeacherManagedCourses(teacherId = 'local', courses = []) {
  try {
    localStorage.setItem(`${TEACHER_MANAGED_COURSES_KEY}:${teacherId}`, JSON.stringify(courses));
  } catch {
    // ignore storage failures
  }
  return courses;
}

export function readAllTeacherManagedCourses() {
  try {
    const managedCourses = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (typeof key !== 'string' || !key.startsWith(`${TEACHER_MANAGED_COURSES_KEY}:`)) {
        continue;
      }

      const rawValue = localStorage.getItem(key);
      if (!rawValue) {
        continue;
      }

      try {
        const courses = JSON.parse(rawValue);
        if (Array.isArray(courses)) {
          managedCourses.push(...courses);
        }
      } catch {
        // ignore invalid JSON values
      }
    }
    return dedupeCourseList(managedCourses);
  } catch {
    return [];
  }
}

function normalizeManagedCourse(course, fallbackIndex = 0) {
  const priceValue = normalizeVndAmount(course.priceValue ?? course.price);
  const slug = course.slug || course.id || createCourseSlug(course.title || `khoa-hoc-${fallbackIndex + 1}`);
  const sections = Array.isArray(course.sections) ? course.sections : [];
  const lessonCount = sections.reduce((total, section) => total + ((Array.isArray(section.lessons) ? section.lessons.length : 0) || 0), 0) || Number(course.lessonsCount || 1);

  return {
    id: course.id || slug,
    databaseId: course.databaseId || course.id || slug,
    slug,
    title: course.title || 'Khóa học chưa đặt tên',
    level: course.level || 'Nền tảng',
    priceValue,
    price: formatPrice(priceValue),
    progress: course.progress ?? 0,
    instructor: course.instructor || 'Giảng viên trung tâm',
    summary: course.description || course.summary || 'Khóa học được giảng viên tạo.',
    category: course.category || 'Kỹ năng cốt lõi',
    bannerUrl: course.bannerUrl || course.banner_url || null,
    duration: course.duration || `${Math.max(1, Number(course.duration || 6))} tuần`,
    lessonsCount: lessonCount,
    rating: typeof course.rating === 'number' ? course.rating : 4.7,
    studentsCount: course.studentsCount ?? 0,
    badge: course.badge || 'Tự tạo',
    hero: course.hero || course.summary || 'Lộ trình học do giảng viên nhập liệu trực tiếp.',
    language: course.language || 'Tiếng Anh',
    certificate: course.certificate ?? false,
    whatYouGet: Array.isArray(course.whatYouGet) ? course.whatYouGet : [],
    sections
  };
}

function createCourseSlug(title) {
  return String(title || 'khoa-hoc')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'khoa-hoc';
}

function getCourseIdentityKey(course) {
  const databaseId = String(course?.databaseId || '').trim().toLowerCase();
  const slug = String(course?.slug || course?.id || '').trim().toLowerCase();

  if (databaseId) {
    return `db:${databaseId}`;
  }

  if (slug) {
    return `slug:${slug}`;
  }

  const title = String(course?.title || '').trim().toLowerCase();
  const teacherId = String(course?.teacherId || course?.teacher_id || '').trim().toLowerCase();
  return title ? `title:${title}|teacher:${teacherId}` : '';
}

function dedupeCourseList(courses = []) {
  const seenKeys = new Set();

  return (Array.isArray(courses) ? courses : []).filter((course) => {
    const identityKey = getCourseIdentityKey(course);
    if (!identityKey) {
      return true;
    }

    if (seenKeys.has(identityKey)) {
      return false;
    }

    seenKeys.add(identityKey);
    return true;
  });
}

function formatPrice(value) {
  return formatVnd(value);
}

function defaultLevel(index) {
  return ['Nền tảng', 'Trung cấp', 'Nâng cao'][index % 3];
}

function defaultCategory(index) {
  return ['Kỹ năng cốt lõi', 'Công sở', 'Luyện thi', 'Giao tiếp'][index % 4];
}

function defaultBadge(index) {
  return ['Phổ biến', 'Đề xuất', 'Sẵn sàng công việc', 'Tăng tốc'][index % 4];
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}

function getLessonExercises(lesson) {
  return Array.isArray(lesson?.exercises)
    ? lesson.exercises
    : Array.isArray(lesson?.questions)
      ? lesson.questions
      : [];
}

function parseLessonContent(content) {
  if (!content) {
    return {};
  }

  if (typeof content === 'object') {
    return content?.version === LESSON_CONTENT_VERSION ? content : { ...content };
  }

  if (typeof content !== 'string') {
    return {};
  }

  try {
    const parsed = JSON.parse(content);
    if (typeof parsed === 'string') {
      return parseLessonContent(parsed);
    }
    return parsed?.version === LESSON_CONTENT_VERSION ? parsed : { content };
  } catch {
    return { content };
  }
}

function normalizeRemoteLesson(lesson) {
  const metadata = parseLessonContent(lesson.content);
  const metadataExercises = getLessonExercises(metadata);
  const directExercises = getLessonExercises(lesson);
  const exercises = metadataExercises.length ? metadataExercises : directExercises;
  const questionCount = Number(
    metadata.questionCount ?? lesson.questionCount ?? exercises.length ?? 0
  );

  return {
    id: lesson.id,
    databaseId: lesson.databaseId || lesson.id,
    title: lesson.title,
    position: lesson.position,
    status: lesson.is_preview ? 'active' : lesson.status,
    videoUrl: lesson.video_url || lesson.videoUrl || metadata.videoUrl || metadata.videoEmbedUrl || '',
    videoTitle: metadata.videoTitle || lesson.title,
    lessonNumber: metadata.lessonNumber || String(lesson.position || ''),
    exerciseType: metadata.exerciseType || metadata.type || 'Bài học',
    questionCount: Number.isFinite(questionCount) ? questionCount : 0,
    note: metadata.note || metadata.content || '',
    sourceSheet: metadata.sourceSheet || '',
    audioName: metadata.audioName || '',
    audioUrl: metadata.audioUrl || '',
    imageName: metadata.imageName || '',
    imageUrl: metadata.imageUrl || '',
    exercises
  };
}

function normalizeRemoteSections(sections = []) {
  return (Array.isArray(sections) ? sections : []).map((section) => ({
    title: section.title || 'Nội dung khóa học',
    lessons: (Array.isArray(section.lessons) ? section.lessons : []).map(normalizeRemoteLesson)
  }));
}

async function getCourseBySlugFromApi(courseSlug) {
  try {
    const response = await apiFetch(`/api/courses/${encodeURIComponent(courseSlug)}`);
    const remoteCourse = response?.data;

    if (!remoteCourse || typeof remoteCourse !== 'object') {
      return null;
    }

    const normalizedCourse = normalizeCourse(remoteCourse);

    return {
      ...normalizedCourse,
      hero: normalizedCourse.hero || defaultHero(normalizedCourse),
      sections: normalizeRemoteSections(remoteCourse.sections)
    };
  } catch (error) {
    console.warn('[getCourseBySlugFromApi]', error.message);
    return null;
  }
}

function getTeacherIdForCourseStorage(teacherId) {
  return isUuid(teacherId) ? teacherId : null;
}

function defaultWhatYouGet(course) {
  return [
    `${course.lessonsCount} bài học có cấu trúc`,
    `Lộ trình học ${course.duration}`,
    'Kích hoạt quyền học ngay sau khi mua'
  ];
}

function defaultHero(course) {
  return course.summary || 'Lộ trình học có cấu trúc với bài học thực hành, nhiệm vụ và theo dõi tiến độ rõ ràng.';
}

function normalizeCourse(course, fallbackIndex = 0) {
  const priceValue = normalizeVndAmount(course.priceValue ?? course.price);
  const slug = course.slug || course.id || `course-${fallbackIndex + 1}`;
  const sections = Array.isArray(course.sections) ? course.sections : [];
  const lessonsCount = sections.length
    ? sections.reduce((total, section) => total + ((Array.isArray(section.lessons) ? section.lessons.length : 0) || 0), 0)
    : course.lessonsCount ?? 12 + fallbackIndex * 4;

  const normalized = {
    id: slug,
    databaseId: course.databaseId || course.id || slug,
    slug,
    title: course.title || 'Khóa học chưa đặt tên',
    level: course.level || defaultLevel(fallbackIndex),
    priceValue,
    price: formatPrice(priceValue),
    progress: course.progress ?? 0,
    instructor: course.instructor || 'Giảng viên trung tâm',
    summary: course.description || course.summary || 'Khóa học được đồng bộ từ hệ thống.',
    category: course.category || defaultCategory(fallbackIndex),
    bannerUrl: course.banner_url || course.bannerUrl || null,
    duration: course.duration || `${6 + fallbackIndex} tuần`,
    lessonsCount,
    rating: typeof course.rating === 'number' ? course.rating : 4.5 + ((fallbackIndex % 4) * 0.1),
    studentsCount: course.studentsCount ?? 320 + fallbackIndex * 110,
    badge: course.badge || defaultBadge(fallbackIndex),
    hero: course.hero || course.description || 'Hành trình học chuyên nghiệp với bài học, thực hành và quyền truy cập sau khi mua.',
    language: course.language || 'Tiếng Anh',
    certificate: course.certificate ?? true,
    whatYouGet: Array.isArray(course.whatYouGet) ? course.whatYouGet : [],
    packageTotalSessions: course.package_total_sessions ?? course.packageTotalSessions ?? null,
    packageDurationMonths: course.package_duration_months ?? course.packageDurationMonths ?? null,
    sections
  };

  if (!normalized.whatYouGet.length) {
    normalized.whatYouGet = defaultWhatYouGet(normalized);
  }

  return normalized;
}

function createFallbackSections() {
  return mockCourseDetail.sections.map((section) => ({
    ...section,
    lessons: section.lessons.map((lesson) => ({ ...lesson }))
  }));
}

function dedupeStrings(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

export function buildCourseRecordPayload(course, options = {}) {
  const title = course?.title || 'Khóa học chưa đặt tên';
  const slug = createCourseSlug(title);
  const normalizedPrice = Number(course?.priceValue ?? course?.price ?? 0);

  return {
    slug,
    title,
    description: course?.summary || course?.description || '',
    price: Number.isFinite(normalizedPrice) ? normalizedPrice : 0,
    status: course?.status || 'draft',
    teacher_id: getTeacherIdForCourseStorage(options.teacherId || course?.teacherId || null),
    banner_url: course?.bannerUrl || course?.banner_url || null,
    package_total_sessions: course?.packageTotalSessions || null,
    package_duration_months: course?.packageDurationMonths || null
  };
}

export async function saveCourseToSupabase(course, options = {}) {
  const hasCourseLessons = Array.isArray(course?.sections) && course.sections.some(
    (section) => Array.isArray(section?.lessons) && section.lessons.length > 0
  );

  if (!isSupabaseReady()) {
    if (hasCourseLessons) {
      throw new Error('Supabase chưa được cấu hình nên chưa thể đăng khóa học có bài/video.');
    }

    return null;
  }

  if (options.accessToken) {
    const response = await apiFetch('/api/courses/publish', {
      method: 'POST',
      token: options.accessToken,
      body: { course }
    });

    return response?.data || null;
  }

  if (hasCourseLessons) {
    throw new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để đồng bộ khóa học, video và câu hỏi lên Supabase.');
  }

  const payload = buildCourseRecordPayload(course, options);
  const existingCourseId = isUuid(course?.databaseId) ? course.databaseId : '';
  const upsertPayload = existingCourseId ? { id: existingCourseId, ...payload } : payload;
  const onConflict = existingCourseId ? 'id' : 'slug';

  const { data, error } = await supabase
    .from('courses')
    .upsert(upsertPayload, { onConflict })
    .select(
      'id, slug, title, description, price, status, teacher_id, banner_url, created_at, updated_at, package_total_sessions, package_duration_months'
    )
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function saveLessonQuestionsToSupabase({ lessonId, questions = [], accessToken } = {}) {
  if (!isSupabaseReady()) {
    throw new Error('Supabase chưa được cấu hình nên chưa thể lưu câu hỏi video.');
  }

  if (!isUuid(lessonId)) {
    throw new Error('Bài học cần được đồng bộ Supabase trước khi lưu câu hỏi video.');
  }

  if (!accessToken) {
    throw new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để lưu câu hỏi video.');
  }

  const response = await apiFetch(`/api/courses/lessons/${lessonId}/questions`, {
    method: 'PATCH',
    token: accessToken,
    body: {
      questions: Array.isArray(questions) ? questions : []
    }
  });

  return response?.data || { lessonId, questions, questionCount: questions.length };
}

export function getStoredPurchasedCourseIds(userId = 'local') {
  return getPurchasedCourseIds(userId);
}

export function setStoredPurchasedCourseIds(courseIds, userId = 'local') {
  return setPurchasedCourseIds(userId, courseIds);
}

export function addStoredPurchasedCourseId(courseId, userId = 'local') {
  return grantPurchasedCourseId(userId, courseId);
}

export async function getCourseCatalog() {
  if (!isSupabaseReady()) {
    const localTeacherCourses = readAllTeacherManagedCourses();
    const normalizedLocalCourses = localTeacherCourses.map((course, index) => normalizeCourse(course, index));

    return dedupeCourseList([
      ...mockCourses.map((course, index) => normalizeCourse(course, index)),
      ...normalizedLocalCourses
    ]);
  }

  const [remoteCoursesResult, localTeacherCourses] = await Promise.all([
    supabase
    .from('courses')
    .select('id, slug, title, description, price, status, banner_url')
    .eq('status', 'published')
    .order('updated_at', { ascending: false }),
    Promise.resolve(readAllTeacherManagedCourses())
  ]);

  const { data, error } = remoteCoursesResult;

  if (error) {
    console.warn('[getCourseCatalog] Supabase error:', error.message);
    const normalizedLocalCourses = localTeacherCourses.map((course, index) => normalizeCourse(course, index));
    return dedupeCourseList(normalizedLocalCourses);
  }

  const normalizedRemoteCourses = (data || []).map((course, index) => normalizeCourse(course, index));
  const normalizedLocalCourses = localTeacherCourses.map((course, index) => normalizeCourse(course, index));

  return dedupeCourseList([...normalizedRemoteCourses, ...normalizedLocalCourses]);
}

export async function getFeaturedCourses() {
  const courses = await getCourseCatalog();
  return courses.slice(0, 6);
}

export async function getOwnedCourseIds(userId, courses = []) {
  const storedIds = getStoredPurchasedCourseIds(userId || 'local');

  if (!isSupabaseReady() || !userId) {
    return storedIds;
  }

  const { data, error } = await supabase
    .from('orders')
    .select('course_id, status')
    .eq('user_id', userId)
    .eq('status', 'paid');

  if (error || !data?.length) {
    return storedIds;
  }

  const courseLookup = new Map(
    courses.map((course) => [course.databaseId || course.id, course.id])
  );

  const remoteIds = [];
  data.forEach((order) => {
    const courseId = order.course_id;
    if (courseId) {
      remoteIds.push(courseId);
      const resolvedSlug = courseLookup.get(courseId);
      if (resolvedSlug) {
        remoteIds.push(resolvedSlug);
      }
    }
  });

  const mergedIds = dedupeStrings([...storedIds, ...remoteIds]);

  if (mergedIds.length !== storedIds.length) {
    setStoredPurchasedCourseIds(mergedIds, userId);
  }

  return mergedIds;
}

export async function purchaseCourse({ course, userId, accessToken, user }) {
  if (!course?.id) {
    throw new Error('Thiếu dữ liệu khóa học.');
  }

  const currentIds = getStoredPurchasedCourseIds(userId || 'local');
  if (currentIds.includes(course.id)) {
    return { ownedCourseIds: currentIds, mode: 'existing' };
  }

  const existingOrder = findPaymentOrderForCourse(userId || 'local', course.id);
  if (existingOrder) {
    return {
      ownedCourseIds: currentIds,
      mode: 'manual-payment',
      order: existingOrder,
      requiresPayment: true
    };
  }

  if (!isSupabaseReady() || !userId) {
    const order = createManualPaymentOrder({
      course,
      user: user || { id: userId || 'local' }
    });
    if (userId) {
      void logActivity(userId, 'purchase', course.id, course.title, { orderId: order.id, status: order.status });
    }
    return { ownedCourseIds: currentIds, mode: 'manual-payment', order, requiresPayment: true };
  }

  if (!accessToken) {
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại trước khi mua khóa học.');
  }

  const remoteCourseId = course.databaseId || course.id;
  if (!isUuid(remoteCourseId)) {
    const order = createManualPaymentOrder({
      course,
      user: user || { id: userId }
    });
    void logActivity(userId, 'purchase', course.id, course.title, { orderId: order.id, status: order.status });
    return { ownedCourseIds: currentIds, mode: 'manual-payment', order, requiresPayment: true };
  }

  const response = await apiFetch('/api/payments/checkout', {
    method: 'POST',
    token: accessToken,
    body: {
      courseId: remoteCourseId,
      amount: course.priceValue ?? 0,
      provider: 'manual-bank-transfer'
    }
  });

  const order = createManualPaymentOrder({
    course,
    user: user || { id: userId },
    remoteOrder: {
      orderId: response.orderId,
      amount: response.amount ?? course.priceValue ?? 0,
      status: response.status || 'pending',
      transferCode: response.transferCode,
      qrImageUrl: response.qrImageUrl
    }
  });

  void logActivity(userId, 'purchase', remoteCourseId, course.title, {
    orderId: response.orderId,
    mode: response.mode,
    status: response.status || order.status
  });

  return {
    ownedCourseIds: currentIds,
    mode: response.mode || 'manual-payment',
    order,
    orderId: response.orderId,
    requiresPayment: true,
    status: response.status
  };
}

export function getPendingCoursePaymentOrder(userId, courseId) {
  return findPaymentOrderForCourse(userId || 'local', courseId);
}

export async function confirmCoursePayment({ order, accessToken }) {
  if (!order?.id) {
    throw new Error('Thiếu thông tin đơn thanh toán.');
  }

  if (!isSupabaseReady() || !accessToken || String(order.id).startsWith('local-payment-')) {
    return confirmManualPaymentTransfer(order.id);
  }

  const response = await apiFetch('/api/payments/confirm-transfer', {
    method: 'POST',
    token: accessToken,
    body: {
      orderId: order.id
    }
  });

  return confirmManualPaymentTransfer(order.id, {
    ...order,
    status: response.status || 'awaiting_admin',
    adminEmailSent: Boolean(response.adminEmailSent)
  }) || upsertPaymentOrder({
    ...order,
    status: response.status || 'awaiting_admin',
    adminEmailSent: Boolean(response.adminEmailSent)
  });
}

export async function getCourseBySlug(courseSlug) {
  if (!courseSlug) {
    return null;
  }

  const localTeacherCourses = readAllTeacherManagedCourses();
  const localCourse = localTeacherCourses.find((course) => course.id === courseSlug || course.slug === courseSlug || course.databaseId === courseSlug);
  const normalizedLocalCourse = localCourse
    ? {
        ...(() => {
          const baseLocalCourse = normalizeCourse(localCourse);
          return {
            ...baseLocalCourse,
            hero: defaultHero(baseLocalCourse)
          };
        })(),
        sections: Array.isArray(localCourse.sections) ? localCourse.sections : []
      }
    : null;

  if (!isSupabaseReady()) {
    if (normalizedLocalCourse) {
      return {
        ...normalizedLocalCourse,
        sections: Array.isArray(normalizedLocalCourse.sections) ? normalizedLocalCourse.sections : []
      };
    }

    const fallbackCourse =
      mockCourses.find((course) => course.id === courseSlug || course.slug === courseSlug) || mockCourses[0];
    const normalizedFallback = normalizeCourse(fallbackCourse);

    return {
      ...normalizedFallback,
      hero: normalizedFallback.hero || defaultHero(normalizedFallback),
      sections: createFallbackSections()
    };
  }

  const apiCourse = await getCourseBySlugFromApi(courseSlug);
  if (apiCourse) {
    return apiCourse;
  }

  let courseQuery = supabase
    .from('courses')
    .select(
      'id, slug, title, description, price, status, banner_url, updated_at, package_total_sessions, package_duration_months'
    );

  courseQuery = isUuid(courseSlug)
    ? courseQuery.or(`id.eq.${courseSlug},slug.eq.${courseSlug}`)
    : courseQuery.eq('slug', courseSlug);

  const { data: course, error } = await courseQuery.maybeSingle();

  if (error || !course) {
    if (normalizedLocalCourse) {
      return {
        ...normalizedLocalCourse,
        sections: Array.isArray(normalizedLocalCourse.sections) ? normalizedLocalCourse.sections : []
      };
    }

    return null;
  }

  const normalizedCourse = normalizeCourse(course);

  const { data: chapters, error: chaptersError } = await supabase
    .from('chapters')
    .select('id, title, position')
    .eq('course_id', course.id)
    .order('position', { ascending: true });

  let normalizedChapters = [];

  if (!chaptersError && chapters?.length) {
    const chapterIds = chapters.map((chapter) => chapter.id);
    const { data: lessonRows, error: lessonsError } = await supabase
      .from('lessons')
      .select('id, chapter_id, title, video_url, content, position, is_preview')
      .in('chapter_id', chapterIds)
      .order('position', { ascending: true });

    const lessonsByChapter = new Map();

    if (!lessonsError && lessonRows?.length) {
      lessonRows.forEach((lesson) => {
        const chapterLessons = lessonsByChapter.get(lesson.chapter_id) || [];
        chapterLessons.push(normalizeRemoteLesson(lesson));
        lessonsByChapter.set(lesson.chapter_id, chapterLessons);
      });
    }

    normalizedChapters = normalizeRemoteSections(chapters.map((chapter) => ({
      title: chapter.title,
      lessons: lessonsByChapter.get(chapter.id) || []
    })));
  }

  return {
    ...normalizedCourse,
    hero: normalizedCourse.hero || defaultHero(normalizedCourse),
    sections: normalizedChapters
  };
}
