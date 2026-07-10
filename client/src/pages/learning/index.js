/**
 * Learning page barrel export.
 *
 * The LearningPage and its sub-components (sidebar, exercises, assignments,
 * content viewer) remain in the original LearningPage.jsx for now. This
 * index re-exports it so that other modules can import from the 'learning/'
 * directory, enabling a gradual extraction of sub-components over time.
 *
 * Usage:
 *   import LearningPage from './pages/learning';
 */
export { default } from '../LearningPage';
