import { supabase, isSupabaseReady } from './supabase';
import { apiFetch } from './api';
import { logActivity } from '../lib/activityService';
import { featuredCourses as mockCourses, courseDetail as mockCourseDetail } from '../data/mock';
import { formatVnd, normalizeVndAmount } from './money';
import {
  createSepayPaymentOrder,
  findPaymentOrderForCourse,
  markPaymentOrderPaid,
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

/* Phân loại khóa theo hệ ngôn ngữ. Dữ liệu không có cột "language" đáng tin
   (khóa nhập từ file thường bỏ trống) nên dò từ khóa trên title/category —
   dùng chung cho cả trang danh mục lẫn menu header để 2 chỗ không lệch nhau. */
export function isHskCourse(course) {
  const haystack = `${course.title || ''} ${course.category || ''} ${course.language || ''}`.toLowerCase();
  return haystack.includes('hsk') || haystack.includes('tiếng trung');
}

// Trích cấp độ HSK từ tiêu đề khóa học (ví dụ "HSK 3 – Từ Vựng" → 3).
// Trả về Infinity nếu không tìm thấy số để khóa không có cấp xếp cuối cùng.
export function getHskLevel(course) {
  const haystack = `${course.title || ''} ${course.category || ''}`;
  const match = haystack.match(/HSK\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : Infinity;
}

// Gộp danh sách khóa HSK theo cấp độ để hiển thị nested flyout trong header.
// Mỗi phần tử kết quả là một trong hai dạng:
//   • { type: 'single', course }         — cấp chỉ có 1 khóa, hiển thị thẳng
//   • { type: 'group', level, label, courses[] } — cấp có ≥2 khóa, có flyout
export function groupHskCourses(courses) {
  const map = new Map(); // level (number) → courses[]
  for (const course of courses) {
    const level = getHskLevel(course);
    if (!map.has(level)) map.set(level, []);
    map.get(level).push(course);
  }

  const result = [];
  for (const [level, group] of [...map.entries()].sort(([a], [b]) => a - b)) {
    if (group.length === 1) {
      result.push({ type: 'single', course: group[0] });
    } else {
      const label = level === Infinity ? 'Tiếng Trung' : `HSK ${level}`;
      result.push({ type: 'group', level, label, courses: group });
    }
  }
  return result;
}

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
  invalidateCourseCatalogCache();
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

// Chuẩn hoá hiển thị tên khoá HSK: luôn tách "HSK" và cấp độ thành "HSK 3" thay
// vì "HSK3" (theo brief "tách HSK và cấp độ, VD: HSK 3"). Chỉ format ở tầng hiển
// thị khi đọc dữ liệu — KHÔNG áp dụng cho payload ghi lên database.
export function formatCourseTitle(title) {
  return String(title || '')
    .replace(/HSK\s*(\d+)/gi, 'HSK $1')
    .replace(/\s{2,}/g, ' ')
    .trim();
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
    // Giữ chủ sở hữu cho Phòng học: chỉ giảng viên phụ trách mới thấy công cụ sửa.
    teacherId: course.teacherId || course.teacher_id || '',
    title: formatCourseTitle(course.title || 'Khóa học chưa đặt tên'),
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
    hero: course.hero || course.summary || '',
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

export function dedupeCourseList(courses = []) {
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
    // Chương chứa bài — trình sửa trong phòng học cần để biết bài đang nằm ở đâu.
    chapterId: lesson.chapter_id || lesson.chapterId || '',
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
    // Bài luyện đọc / bảng phiên âm (import HSK) — không có video hay câu hỏi chấm điểm.
    readingItems: Array.isArray(metadata.readingItems) ? metadata.readingItems : [],
    pinyinTable: metadata.pinyinTable || '',
    // Cấu trúc tab của chủ đề (1 tab video + N tab bài tập). Bài học cũ không có
    // trường này — LearningPage tự dựng tab từ videoUrl + exercises.
    tabs: Array.isArray(metadata.tabs) ? metadata.tabs : [],
    exercises
  };
}

function sortByPosition(rows) {
  return (Array.isArray(rows) ? [...rows] : []).sort(
    (a, b) => Number(a?.position ?? 0) - Number(b?.position ?? 0)
  );
}

function normalizeRemoteSections(sections = []) {
  return (Array.isArray(sections) ? sections : []).map((section) => ({
    // id chương giữ nguyên để kéo bài sang chương khác biết chương đích.
    id: section.id || section.databaseId || '',
    title: section.title || 'Nội dung khóa học',
    position: section.position,
    lessons: (Array.isArray(section.lessons) ? section.lessons : []).map(normalizeRemoteLesson)
  }));
}

async function getCourseBySlugFromApi(courseSlug, { summaryOnly = false } = {}) {
  try {
    const response = await apiFetch(
      `/api/courses/${encodeURIComponent(courseSlug)}${summaryOnly ? '?view=summary' : ''}`
    );
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
    course.lessonsCount
      ? `${course.lessonsCount} bài học có video bài giảng và bài tập`
      : course.topicsCount
        ? `${course.topicsCount} chủ đề học có video bài giảng và bài tập`
        : 'Video bài giảng kèm bài tập sau mỗi bài',
    course.duration ? `Lộ trình học ${course.duration}` : 'Học theo tốc độ của bạn, xem lại không giới hạn',
    'Kích hoạt quyền học ngay sau khi mua'
  ];
}

// Khóa trên server không lưu trình độ/nhóm riêng: suy từ tên khóa thay vì gán
// theo thứ tự (trước đây "IELTS 3.5 Mất gốc" bị dán nhãn "Nâng cao · Luyện thi").
export function inferCourseLevel(title = '') {
  const text = String(title).toLowerCase();
  if (/nền tảng|mất gốc|vỡ lòng|hsk\s*1\b/.test(text)) return 'Nền tảng';
  if (/cơ bản|hsk\s*2\b/.test(text)) return 'Cơ bản';
  if (/trung cấp|hsk\s*[34]\b/.test(text)) return 'Trung cấp';
  if (/nâng cao|chuyên sâu|hsk\s*[56]\b/.test(text)) return 'Nâng cao';
  return '';
}

export function inferCourseCategory(title = '') {
  const text = String(title).toLowerCase();
  if (/ielts/.test(text)) return 'IELTS';
  if (/hsk|tiếng trung/.test(text)) return 'HSK';
  return '';
}

function defaultHero(course) {
  return course.summary || '';
}

function normalizeCourse(course, fallbackIndex = 0) {
  const priceValue = normalizeVndAmount(course.priceValue ?? course.price);
  const slug = course.slug || course.id || `course-${fallbackIndex + 1}`;
  const sections = Array.isArray(course.sections) ? course.sections : [];
  // Số liệu hiển thị cho học viên phải là số thật: không có thì để null và giao
  // diện ẩn đi, không tự bịa (trước đây 12+4i bài, 320+110i học viên, 4.5–4.8 sao).
  const declaredLessons = Number(course.lessonsCount);
  const lessonsCount = sections.length
    ? sections.reduce((total, section) => total + ((Array.isArray(section.lessons) ? section.lessons.length : 0) || 0), 0)
    : course.lessonsCount != null && course.lessonsCount !== '' && Number.isFinite(declaredLessons) && declaredLessons > 0
      ? declaredLessons
      : null;

  const normalized = {
    id: slug,
    databaseId: course.databaseId || course.id || slug,
    slug,
    title: formatCourseTitle(course.title || 'Khóa học chưa đặt tên'),
    level: course.level || inferCourseLevel(course.title),
    priceValue,
    price: formatPrice(priceValue),
    tutoringPriceValue: normalizeVndAmount(course.tutoring_price ?? course.tutoringPriceValue) || null,
    progress: course.progress ?? 0,
    instructor: course.instructor || 'Giảng viên trung tâm',
    summary: course.description || course.summary || '',
    category: course.category || inferCourseCategory(course.title),
    bannerUrl: course.banner_url || course.bannerUrl || null,
    duration: course.duration || null,
    lessonsCount,
    topicsCount: Number.isFinite(Number(course.topicsCount)) && Number(course.topicsCount) > 0 ? Number(course.topicsCount) : null,
    rating: typeof course.rating === 'number' ? course.rating : null,
    studentsCount: typeof course.studentsCount === 'number' ? course.studentsCount : null,
    badge: course.badge || null,
    hero: course.hero || course.description || '',
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

    invalidateCourseCatalogCache();
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

  invalidateCourseCatalogCache();
  return data;
}

// Nguồn dữ liệu THẬT cho "khóa học của tôi" ở dashboard giảng viên — trước
// đây dashboard chỉ đọc từ localStorage (ghi lúc đăng bài), nên khóa học đã
// đăng thành công lên Supabase vẫn "biến mất" nếu xem từ trình duyệt/thiết bị
// khác hoặc sau khi xóa dữ liệu trình duyệt. Hàm này lấy đúng khóa học của
// giáo viên (mọi trạng thái, kể cả draft) từ server.
/**
 * @returns {Promise<Array|null>} Mảng khóa học khi hỏi được server (mảng rỗng
 *   nghĩa là giáo viên thật sự chưa có khóa nào), `null` khi KHÔNG hỏi được
 *   (chưa cấu hình Supabase, hết phiên, lỗi mạng). Phía gọi cần phân biệt hai
 *   trường hợp này: chỉ khi có danh sách thật mới được phép dọn cache local.
 */
export async function getMyCourses({ accessToken, summaryOnly = false } = {}) {
  if (!isSupabaseReady() || !accessToken) {
    return null;
  }

  try {
    const response = await apiFetch(`/api/courses/mine${summaryOnly ? '?view=summary' : ''}`, {
      token: accessToken,
      // Bản đầy đủ kèm nội dung mọi bài (~500KB nén, 7s trên production):
      // 10s cắt ngang thì bảng giảng viên báo nhầm "chưa có khóa học nào".
      timeoutMs: summaryOnly ? 10000 : 30000
    });
    const rows = Array.isArray(response?.data) ? response.data : [];

    return rows.map((course) => {
      const normalized = normalizeManagedCourse({
        id: course.slug || course.id,
        databaseId: course.id,
        slug: course.slug,
        title: course.title,
        summary: course.description,
        price: course.price,
        bannerUrl: course.banner_url,
        packageTotalSessions: course.package_total_sessions,
        packageDurationMonths: course.package_duration_months,
        sections: normalizeRemoteSections(course.sections)
      });

      return {
        ...normalized,
        status: course.status || 'draft'
      };
    });
  } catch (error) {
    console.warn('[getMyCourses]', error.message);
    return null;
  }
}

/**
 * Xóa khóa học của chính giảng viên. RLS ("teachers manage own courses") chỉ
 * cho xóa khóa có teacher_id trùng người đang đăng nhập, nên không cần kiểm
 * tra quyền ở client.
 */
export async function deleteCourseFromSupabase(course) {
  const courseId = course?.databaseId || course?.id;

  // Khóa chưa từng đồng bộ (id không phải uuid) chỉ tồn tại trong cache local.
  if (!isSupabaseReady() || !isUuid(courseId)) {
    return { removedRemotely: false };
  }

  const { error } = await supabase.from('courses').delete().eq('id', courseId);
  if (error) {
    throw error;
  }

  invalidateCourseCatalogCache();
  return { removedRemotely: true };
}

/** Bật/tắt hiển thị khóa học cho học viên (published ↔ hidden). */
export async function setCourseStatusInSupabase(course, status) {
  const courseId = course?.databaseId || course?.id;

  if (!isSupabaseReady() || !isUuid(courseId)) {
    return { updatedRemotely: false };
  }

  const { error } = await supabase
    .from('courses')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', courseId);

  if (error) {
    throw error;
  }

  invalidateCourseCatalogCache();
  return { updatedRemotely: true };
}

/**
 * Bỏ khỏi cache local những khóa đã biến mất khỏi server.
 *
 * Khóa từng đồng bộ thì có `databaseId` là uuid; nếu server không còn trả về
 * nó nữa thì nó đã bị xóa (ở máy khác, hoặc bởi admin) và phải biến mất khỏi
 * danh sách, thay vì sống mãi trong localStorage. Khóa chưa từng đồng bộ
 * (không có uuid) được giữ lại — đó là bản nháp local, không phải khóa ma.
 */
export function reconcileManagedCourses(localCourses = [], remoteCourses = []) {
  const remoteIds = new Set(
    (Array.isArray(remoteCourses) ? remoteCourses : [])
      .map((course) => String(course?.databaseId || course?.id || '').toLowerCase())
      .filter(Boolean)
  );

  return (Array.isArray(localCourses) ? localCourses : []).filter((course) => {
    const databaseId = String(course?.databaseId || '').toLowerCase();
    if (!isUuid(databaseId)) {
      return true;
    }
    return remoteIds.has(databaseId);
  });
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

/**
 * Lưu cấu trúc tab của một chủ đề (1 tab video + N tab bài tập độc lập).
 * Gửi kèm `questions` phẳng để `content.exercises` và questionCount vẫn đúng cho
 * các phần đọc dữ liệu theo model cũ.
 */
export async function saveLessonTabsToSupabase({
  lessonId,
  tabs = [],
  questions = [],
  videoUrl = '',
  accessToken
} = {}) {
  if (!isSupabaseReady()) {
    throw new Error('Supabase chưa được cấu hình nên chưa thể lưu tab của chủ đề.');
  }

  if (!isUuid(lessonId)) {
    throw new Error('Chủ đề cần được đồng bộ Supabase trước khi lưu tab.');
  }

  if (!accessToken) {
    throw new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để lưu tab.');
  }

  const response = await apiFetch(`/api/courses/lessons/${lessonId}/questions`, {
    method: 'PATCH',
    token: accessToken,
    body: {
      questions: Array.isArray(questions) ? questions : [],
      tabs: Array.isArray(tabs) ? tabs : [],
      videoUrl
    }
  });

  return response?.data || { lessonId, tabs, questions, questionCount: questions.length };
}

/**
 * Đổi vị trí bài học của một khóa (kéo thả ngay trong phòng học).
 * `moves` là danh sách { lessonId, chapterId, position } của những bài bị ảnh
 * hưởng — server tự bỏ qua bài không đổi gì.
 *
 * Quyền do server quyết: giảng viên chỉ sắp xếp được khóa mình phụ trách,
 * admin sắp xếp được mọi khóa. Client chỉ ẩn nút cho gọn mắt.
 */
export async function reorderCourseLessons({ moves = [], accessToken } = {}) {
  if (!Array.isArray(moves) || !moves.length) {
    return { updated: 0 };
  }

  if (!accessToken) {
    throw new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để sắp xếp bài học.');
  }

  const response = await apiFetch('/api/courses/lessons/reorder', {
    method: 'PATCH',
    token: accessToken,
    body: { moves }
  });

  return response?.data || { updated: moves.length };
}

/**
 * Đổi thứ tự chương của một khóa (kéo thả ngay trong phòng học).
 * `moves` là danh sách { chapterId, position }; server bỏ qua chương không đổi.
 *
 * Mọi chương phải cùng một khóa — server từ chối nếu trộn hai khóa.
 */
export async function reorderCourseChapters({ moves = [], accessToken } = {}) {
  if (!Array.isArray(moves) || !moves.length) {
    return { updated: 0 };
  }

  if (!accessToken) {
    throw new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để sắp xếp chương.');
  }

  const response = await apiFetch('/api/courses/chapters/reorder', {
    method: 'PATCH',
    token: accessToken,
    body: { moves }
  });

  return response?.data || { updated: moves.length };
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

/*
 * Danh mục khoá học bị gọi lại nguyên vẹn ở MỖI lần đổi route: đo thực tế một
 * phiên đi qua home → courses → chi tiết → home rồi bấm qua lại vài nhịp là 12
 * lần cùng một truy vấn Supabase, trả về đúng một kết quả như nhau. Mỗi lần
 * như vậy tốn một vòng preflight + query trước khi trang vẽ được danh sách.
 *
 * Nên gói lại bằng hai lớp:
 *   - Gộp lời gọi đang bay: nhiều chỗ hỏi cùng lúc thì dùng chung một promise.
 *   - Giữ kết quả trong CATALOG_TTL_MS cho các lần hỏi liền sau.
 *
 * TTL để ngắn và quan trọng hơn: MỌI hàm ghi trong file này đều gọi
 * invalidateCourseCatalogCache(), nên giảng viên/admin lưu, xoá hay ẩn khoá
 * xong là lần đọc kế tiếp đi thẳng xuống server. Hành vi nhìn thấy được không
 * đổi, chỉ bớt số request lặp.
 */
const CATALOG_TTL_MS = 30000;
let catalogCache = null;
let catalogCachedAt = 0;
let catalogInFlight = null;

export function invalidateCourseCatalogCache() {
  catalogCache = null;
  catalogCachedAt = 0;
  catalogInFlight = null;
}

export async function getCourseCatalog() {
  if (catalogCache && Date.now() - catalogCachedAt < CATALOG_TTL_MS) {
    return catalogCache;
  }

  if (catalogInFlight) {
    return catalogInFlight;
  }

  catalogInFlight = fetchCourseCatalog()
    .then((courses) => {
      catalogCache = courses;
      catalogCachedAt = Date.now();
      return courses;
    })
    .finally(() => {
      catalogInFlight = null;
    });

  return catalogInFlight;
}

async function fetchCourseCatalog() {
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
    // '*' để có tutoring_price mà không vỡ danh mục khi chưa chạy migration dạy kèm.
    .select('*')
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

  // Truy vấn thành công → server là nguồn thật. Khóa đã có trên server rồi bị
  // xóa (hoặc bị ẩn) phải biến mất khỏi danh mục, không thì xóa trên Supabase
  // xong vào web vẫn thấy vì bản local không bao giờ tự hết hạn. Bản nháp CHƯA
  // từng đồng bộ cũng không vào danh mục: nó chỉ nằm trong trình duyệt của người
  // soạn, học viên không mở được — giảng viên vẫn thấy nó ở Phòng học/Bảng điều
  // khiển vì hai trang đó đọc thẳng readAllTeacherManagedCourses().
  const remoteRows = data || [];

  // Số chủ đề thật của từng khóa (bảng chapters đọc công khai được; đếm bài thì
  // không vì khách chỉ thấy bài xem thử). Truy vấn riêng, lỗi thì bỏ qua để
  // danh mục vẫn hiện.
  const topicCounts = new Map();
  if (remoteRows.length) {
    const { data: countRows, error: countError } = await supabase
      .from('courses')
      .select('id, chapters(count)')
      .in('id', remoteRows.map((course) => course.id));
    if (!countError) {
      (countRows || []).forEach((row) => topicCounts.set(row.id, row.chapters?.[0]?.count ?? null));
    }
  }

  const normalizedRemoteCourses = remoteRows.map((course, index) =>
    normalizeCourse({ ...course, topicsCount: topicCounts.get(course.id) ?? null }, index)
  );
  const normalizedLocalCourses = reconcileManagedCourses(localTeacherCourses, remoteRows)
    .filter((course) => isUuid(String(course?.databaseId || '')))
    .map((course, index) => normalizeCourse(course, index));

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

export async function purchaseCourse({ course, userId, accessToken, user, withTutoring = false }) {
  if (!course?.id) {
    throw new Error('Thiếu dữ liệu khóa học.');
  }

  const currentIds = getStoredPurchasedCourseIds(userId || 'local');
  if (currentIds.includes(course.id) && !withTutoring) {
    return { ownedCourseIds: currentIds, mode: 'existing' };
  }

  const existingOrder = findPaymentOrderForCourse(userId || 'local', course.id, withTutoring);
  if (existingOrder) {
    return {
      ownedCourseIds: currentIds,
      mode: 'sepay',
      order: existingOrder,
      requiresPayment: true
    };
  }

  if (!isSupabaseReady() || !userId) {
    const order = createSepayPaymentOrder({
      course,
      user: user || { id: userId || 'local' },
      withTutoring
    });
    if (userId) {
      void logActivity(userId, 'purchase', course.id, course.title, { orderId: order.id, status: order.status });
    }
    return { ownedCourseIds: currentIds, mode: 'sepay', order, requiresPayment: true };
  }

  if (!accessToken) {
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại trước khi mua khóa học.');
  }

  const remoteCourseId = course.databaseId || course.id;
  if (!isUuid(remoteCourseId)) {
    const order = createSepayPaymentOrder({
      course,
      user: user || { id: userId },
      withTutoring
    });
    void logActivity(userId, 'purchase', course.id, course.title, { orderId: order.id, status: order.status });
    return { ownedCourseIds: currentIds, mode: 'sepay', order, requiresPayment: true };
  }

  const response = await apiFetch('/api/payments/checkout', {
    method: 'POST',
    token: accessToken,
    body: {
      courseId: remoteCourseId,
      amount: course.priceValue ?? 0,
      provider: 'sepay',
      withTutoring
    }
  });

  // Server có thể trả về đơn cũ (mode 'existing') khi học viên đã trả tiền rồi.
  if (response.status === 'paid') {
    const ownedIds = dedupeStrings([...currentIds, course.id, remoteCourseId]);
    setStoredPurchasedCourseIds(ownedIds, userId);
    return { ownedCourseIds: ownedIds, mode: 'existing', requiresPayment: false, orderId: response.orderId };
  }

  const order = createSepayPaymentOrder({
    course,
    user: user || { id: userId },
    withTutoring,
    remoteOrder: {
      orderId: response.orderId,
      amount: response.amount ?? course.priceValue ?? 0,
      status: response.status || 'pending',
      transferCode: response.transferCode,
      qrImageUrl: response.qrImageUrl,
      bankCode: response.bankCode,
      accountNumber: response.accountNumber,
      accountName: response.accountName
    }
  });

  void logActivity(userId, 'purchase', remoteCourseId, course.title, {
    orderId: response.orderId,
    mode: response.mode,
    status: response.status || order.status
  });

  return {
    ownedCourseIds: currentIds,
    mode: response.mode || 'sepay',
    order,
    orderId: response.orderId,
    requiresPayment: true,
    status: response.status
  };
}

export function getPendingCoursePaymentOrder(userId, courseId, withTutoring) {
  return findPaymentOrderForCourse(userId || 'local', courseId, withTutoring);
}

export async function getTutoringCourseIds(userId) {
  if (!isSupabaseReady() || !userId) {
    return [];
  }

  const { data, error } = await supabase
    .from('orders')
    .select('course_id')
    .eq('user_id', userId)
    .eq('status', 'paid')
    .eq('with_tutoring', true);

  return error ? [] : (data || []).map((order) => order.course_id).filter(Boolean);
}

/**
 * Hỏi server xem SePay đã báo tiền về cho đơn này chưa. Màn thanh toán gọi lại
 * vài giây một lần; tiền về là mở khóa khóa học ngay, không cần admin duyệt.
 *
 * @returns {Promise<{ order: object|null, paid: boolean }>}
 */
export async function checkCoursePaymentStatus({ order, accessToken }) {
  if (!order?.id) {
    throw new Error('Thiếu thông tin đơn thanh toán.');
  }

  // Bản demo (không Supabase / đơn tạo offline) không có gì để hỏi.
  if (!isSupabaseReady() || !accessToken || String(order.id).startsWith('local-payment-')) {
    return { order, paid: order.status === 'paid' };
  }

  const response = await apiFetch(`/api/payments/${order.id}/status`, {
    method: 'GET',
    token: accessToken
  });

  if (response.status === 'paid') {
    const paidOrder =
      markPaymentOrderPaid(order.id, { paidAt: response.paidAt }) ||
      upsertPaymentOrder({ ...order, status: 'paid', paidAt: response.paidAt });

    void logActivity(order.userId, 'purchase', order.courseId, order.courseTitle, {
      orderId: order.id,
      status: 'paid',
      provider: 'sepay'
    });

    return { order: paidOrder, paid: true };
  }

  const nextOrder = upsertPaymentOrder({
    ...order,
    status: response.status || order.status,
    transferCode: response.transferCode || order.transferCode,
    qrImageUrl: response.qrImageUrl || order.qrImageUrl
  });

  return { order: nextOrder || order, paid: false };
}

/**
 * @param {string} courseSlug
 * @param {{ summaryOnly?: boolean }} [options] — `summaryOnly` bỏ ngân hàng câu
 *   hỏi khỏi payload. Dùng cho trang chỉ hiện danh sách bài (trang chi tiết
 *   khóa); phòng học vẫn cần bản đầy đủ để làm bài.
 */
export async function getCourseBySlug(courseSlug, { summaryOnly = false } = {}) {
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

  const apiCourse = await getCourseBySlugFromApi(courseSlug, { summaryOnly });
  if (apiCourse) {
    return apiCourse;
  }

  // Đường dự phòng khi API không trả lời. Lấy chương và bài lồng ngay trong
  // truy vấn khóa học — trước đây là ba lượt đi-về nối đuôi nhau (khóa →
  // chương → bài), mỗi lượt phải chờ lượt trước xong.
  let courseQuery = supabase
    .from('courses')
    .select(
      '*,' +
        'chapters(id, title, position, lessons(id, chapter_id, title, video_url, content, position, is_preview))'
    );

  courseQuery = isUuid(courseSlug)
    ? courseQuery.or(`id.eq.${courseSlug},slug.eq.${courseSlug}`)
    : courseQuery.eq('slug', courseSlug);

  const { data: course, error } = await courseQuery.maybeSingle();

  // Hỏi được server nhưng không có dòng nào → khóa đã bị xóa thật. Trả null để
  // trang báo "không tìm thấy", thay vì dựng lại bản cũ từ cache local.
  // Chỉ khi truy vấn LỖI (mất mạng, Supabase sập) mới dùng bản local.
  if (error) {
    if (normalizedLocalCourse) {
      return {
        ...normalizedLocalCourse,
        sections: Array.isArray(normalizedLocalCourse.sections) ? normalizedLocalCourse.sections : []
      };
    }

    return null;
  }

  if (!course) {
    return null;
  }

  const normalizedCourse = normalizeCourse(course);
  const normalizedChapters = normalizeRemoteSections(
    sortByPosition(course.chapters).map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      position: chapter.position,
      lessons: sortByPosition(chapter.lessons)
    }))
  );

  return {
    ...normalizedCourse,
    hero: normalizedCourse.hero || defaultHero(normalizedCourse),
    sections: normalizedChapters
  };
}
