/**
 * Dashboard pages barrel export.
 *
 * The three dashboard pages (Student, Teacher, Admin) and shared helpers
 * remain in the original DashboardPage.jsx for now. This index re-exports
 * them so that other modules can import from the 'dashboard/' directory,
 * enabling a gradual extraction of sub-components over time.
 *
 * Usage:
 *   import { StudentDashboardPage, TeacherDashboardPage, AdminDashboardPage } from './pages/dashboard';
 */
export {
  StudentDashboardPage,
  TeacherDashboardPage,
  AdminDashboardPage
} from '../DashboardPage';
