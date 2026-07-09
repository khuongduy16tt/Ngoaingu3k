import { supabase, isSupabaseReady } from './supabase';
import { featuredCourses as mockCourses, courseDetail as mockCourseDetail } from '../data/mock';

export const PURCHASED_COURSES_STORAGE_KEY = 'learning-purchased-courses';

function formatPrice(value) {
  const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(amount);
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
  const priceValue = Number.isFinite(Number(course.price)) ? Number(course.price) : 0;
  const slug = course.slug || course.id || `course-${fallbackIndex + 1}`;
  const lessonsCount = course.lessonsCount ?? 12 + fallbackIndex * 4;

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
    whatYouGet: Array.isArray(course.whatYouGet) ? course.whatYouGet : []
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

function readStoredJson(key, fallback) {
  try {
    const rawValue = localStorage.getItem(key);
    if (!rawValue) {
      return fallback;
    }

    const parsed = JSON.parse(rawValue);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function dedupeStrings(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function writeStoredJson(key, value) {
  const nextValue = dedupeStrings(value);

  try {
    localStorage.setItem(key, JSON.stringify(nextValue));
    window.dispatchEvent(new CustomEvent('course-purchases-updated', { detail: nextValue }));
  } catch {
    // ignore storage failures in restricted browser contexts
  }

  return nextValue;
}

export function getStoredPurchasedCourseIds() {
  const stored = readStoredJson(PURCHASED_COURSES_STORAGE_KEY, []);
  return Array.isArray(stored) ? dedupeStrings(stored) : [];
}

export function setStoredPurchasedCourseIds(courseIds) {
  return writeStoredJson(PURCHASED_COURSES_STORAGE_KEY, courseIds);
}

export function addStoredPurchasedCourseId(courseId) {
  return setStoredPurchasedCourseIds([...getStoredPurchasedCourseIds(), courseId]);
}

export async function getCourseCatalog() {
  if (!isSupabaseReady()) {
    return mockCourses.map((course, index) => normalizeCourse(course, index));
  }

  const { data, error } = await supabase
    .from('courses')
    .select('id, slug, title, description, price, status, banner_url')
    .eq('status', 'published')
    .order('updated_at', { ascending: false });

  if (error || !data?.length) {
    return mockCourses.map((course, index) => normalizeCourse(course, index));
  }

  return data.map((course, index) => normalizeCourse(course, index));
}

export async function getFeaturedCourses() {
  const courses = await getCourseCatalog();
  return courses.slice(0, 6);
}

export async function getOwnedCourseIds(userId, courses = []) {
  const storedIds = getStoredPurchasedCourseIds();

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

  const remoteIds = data
    .map((order) => courseLookup.get(order.course_id) || order.course_id)
    .filter(Boolean);

  const mergedIds = dedupeStrings([...storedIds, ...remoteIds]);

  if (mergedIds.length !== storedIds.length) {
    setStoredPurchasedCourseIds(mergedIds);
  }

  return mergedIds;
}

export async function purchaseCourse({ course, userId }) {
  if (!course?.id) {
    throw new Error('Thiếu dữ liệu khóa học.');
  }

  const currentIds = getStoredPurchasedCourseIds();
  if (currentIds.includes(course.id)) {
    return { ownedCourseIds: currentIds, mode: 'existing' };
  }

  if (!isSupabaseReady() || !userId) {
    return { ownedCourseIds: addStoredPurchasedCourseId(course.id), mode: 'local' };
  }

  try {
    const { data: existingOrders, error: existingError } = await supabase
      .from('orders')
      .select('id')
      .eq('user_id', userId)
      .eq('course_id', course.databaseId || course.id)
      .eq('status', 'paid')
      .limit(1);

    if (!existingError && existingOrders?.length) {
      return { ownedCourseIds: addStoredPurchasedCourseId(course.id), mode: 'existing' };
    }

    const { error } = await supabase.from('orders').insert({
      user_id: userId,
      course_id: course.databaseId || course.id,
      provider: 'demo-checkout',
      status: 'paid',
      amount: course.priceValue ?? 0
    });

    if (error) {
      throw error;
    }

    return { ownedCourseIds: addStoredPurchasedCourseId(course.id), mode: 'supabase' };
  } catch {
    return { ownedCourseIds: addStoredPurchasedCourseId(course.id), mode: 'local-fallback' };
  }
}

export async function getCourseBySlug(courseSlug) {
  const fallbackCourse =
    mockCourses.find((course) => course.id === courseSlug || course.slug === courseSlug) || mockCourses[0];
  const normalizedFallback = normalizeCourse(fallbackCourse);

  if (!isSupabaseReady() || !courseSlug) {
    return {
      ...normalizedFallback,
      hero: normalizedFallback.hero || defaultHero(normalizedFallback),
      sections: createFallbackSections()
    };
  }

  const { data: course, error } = await supabase
    .from('courses')
    .select('id, slug, title, description, price, status, banner_url, updated_at')
    .or(`slug.eq.${courseSlug},id.eq.${courseSlug}`)
    .maybeSingle();

  if (error || !course) {
    return {
      ...normalizedFallback,
      hero: normalizedFallback.hero || defaultHero(normalizedFallback),
      sections: createFallbackSections()
    };
  }

  const normalizedCourse = normalizeCourse(course);

  const { data: chapters, error: chaptersError } = await supabase
    .from('chapters')
    .select('id, title, position')
    .eq('course_id', course.id)
    .order('position', { ascending: true });

  let normalizedChapters = createFallbackSections();

  if (!chaptersError && chapters?.length) {
    const chapterIds = chapters.map((chapter) => chapter.id);
    const { data: lessonRows, error: lessonsError } = await supabase
      .from('lessons')
      .select('id, chapter_id, title, position, is_preview')
      .in('chapter_id', chapterIds)
      .order('position', { ascending: true });

    const lessonsByChapter = new Map();

    if (!lessonsError && lessonRows?.length) {
      lessonRows.forEach((lesson) => {
        const chapterLessons = lessonsByChapter.get(lesson.chapter_id) || [];
        chapterLessons.push({
          id: lesson.id,
          databaseId: lesson.id,
          title: lesson.title,
          position: lesson.position,
          status: lesson.is_preview ? 'active' : undefined
        });
        lessonsByChapter.set(lesson.chapter_id, chapterLessons);
      });
    }

    normalizedChapters = chapters.map((chapter) => ({
      title: chapter.title,
      lessons: lessonsByChapter.get(chapter.id) || []
    }));
  }

  return {
    ...normalizedCourse,
    hero: normalizedCourse.hero || defaultHero(normalizedCourse),
    sections: normalizedChapters
  };
}
