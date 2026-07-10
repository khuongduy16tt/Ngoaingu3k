import { create } from 'zustand';
import { getAdminDashboardData } from '../lib/adminService';

/**
 * Dashboard store — caches admin dashboard data to avoid re-fetching.
 */
export const useDashboardStore = create((set, get) => ({
  // State
  profiles: [],
  courses: [],
  lessons: [],
  orders: [],
  progress: [],
  assignments: [],
  rolePermissions: [],
  mode: 'local',
  loading: false,
  loaded: false,
  error: null,

  // Actions
  fetchDashboardData: async () => {
    if (get().loaded) return;
    set({ loading: true, error: null });
    try {
      const data = await getAdminDashboardData();
      set({
        ...data,
        loading: false,
        loaded: true,
      });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  updateProfiles: (profiles) => set({ profiles }),
  updateCourses: (courses) => set({ courses }),
  updateLessons: (lessons) => set({ lessons }),
  updateRolePermissions: (rolePermissions) => set({ rolePermissions }),

  invalidate: () => {
    set({ loaded: false });
  },
}));
