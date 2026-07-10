import { create } from 'zustand';
import { getCourseCatalog, getFeaturedCourses, getOwnedCourseIds } from '../lib/courseService';

/**
 * Course store — shared cache for course catalog data.
 * Prevents redundant fetches when navigating between Home ↔ Courses.
 */
export const useCourseStore = create((set, get) => ({
  // State
  courses: [],
  featuredCourses: [],
  ownedCourseIds: [],
  loading: false,
  loaded: false,
  error: null,

  // Actions
  fetchCourses: async () => {
    if (get().loaded && get().courses.length > 0) return;
    set({ loading: true, error: null });
    try {
      const courses = await getCourseCatalog();
      set({ courses, loading: false, loaded: true });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  fetchFeaturedCourses: async () => {
    if (get().featuredCourses.length > 0) return;
    try {
      const featured = await getFeaturedCourses();
      set({ featuredCourses: featured });
    } catch {
      // Fall back to slicing from full catalog
      const courses = get().courses;
      if (courses.length > 0) {
        set({ featuredCourses: courses.slice(0, 6) });
      }
    }
  },

  fetchOwnedCourseIds: async (userId) => {
    try {
      const courses = get().courses;
      const ids = await getOwnedCourseIds(userId, courses);
      set({ ownedCourseIds: ids });
      return ids;
    } catch {
      return get().ownedCourseIds;
    }
  },

  addOwnedCourseId: (courseId) => {
    const current = get().ownedCourseIds;
    if (!current.includes(courseId)) {
      set({ ownedCourseIds: [...current, courseId] });
    }
  },

  invalidate: () => {
    set({ loaded: false, courses: [], featuredCourses: [] });
  },
}));
