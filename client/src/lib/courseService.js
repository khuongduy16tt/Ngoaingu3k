import { supabase, isSupabaseReady } from './supabase';
import { featuredCourses as mockCourses, courseDetail as mockCourseDetail } from '../data/mock';

function normalizeCourse(course, fallbackIndex = 0) {
  return {
    id: course.id || course.slug,
    slug: course.slug || course.id,
    title: course.title,
    level: course.level || (fallbackIndex === 0 ? 'Beginner' : fallbackIndex === 1 ? 'Intermediate' : 'Advanced'),
    price: course.price != null ? `$${Number(course.price).toFixed(0)}` : '$0',
    progress: course.progress ?? 0,
    instructor: course.instructor || 'Supabase instructor',
    summary: course.description || course.summary || 'Course synced from Supabase.',
    category: course.category || 'Published course',
    bannerUrl: course.banner_url || course.bannerUrl || null
  };
}

export async function getFeaturedCourses() {
  if (!isSupabaseReady()) {
    return mockCourses;
  }

  const { data, error } = await supabase
    .from('courses')
    .select('id, slug, title, description, price, status, banner_url')
    .eq('status', 'published')
    .order('updated_at', { ascending: false })
    .limit(6);

  if (error || !data?.length) {
    return mockCourses;
  }

  return data.map((course, index) => normalizeCourse(course, index));
}

export async function getCourseBySlug(courseSlug) {
  if (!isSupabaseReady() || !courseSlug) {
    return mockCourseDetail;
  }

  const { data: course, error } = await supabase
    .from('courses')
    .select('id, slug, title, description, price, status, banner_url, updated_at')
    .or(`slug.eq.${courseSlug},id.eq.${courseSlug}`)
    .maybeSingle();

  if (error || !course) {
    return mockCourseDetail;
  }

  const { data: chapters, error: chaptersError } = await supabase
    .from('chapters')
    .select('id, title, position')
    .eq('course_id', course.id)
    .order('position', { ascending: true });

  const normalizedChapters =
    !chaptersError && chapters?.length
      ? chapters.map((chapter) => ({
          title: chapter.title,
          lessons: []
        }))
      : mockCourseDetail.sections;

  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    hero: course.description || 'A live learning layout with video lessons, quizzes, and progress tracking.',
    price: course.price,
    sections: normalizedChapters
  };
}
