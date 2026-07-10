import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './providers/AuthProvider';
import { getDashboardPathForRole, getEffectiveRole } from './lib/permissions';
import { ui } from './config/i18n';
import { usePageTitle } from './hooks/usePageTitle';

const HomePage = lazy(() => import('./pages/HomePage'));
const CoursesPage = lazy(() => import('./pages/CoursesPage'));
const CourseDetailPage = lazy(() => import('./pages/CourseDetailPage'));
const LearningPage = lazy(() => import('./pages/LearningPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const StudentDashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((module) => ({ default: module.StudentDashboardPage }))
);
const TeacherDashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((module) => ({ default: module.TeacherDashboardPage }))
);
const AdminDashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((module) => ({ default: module.AdminDashboardPage }))
);

function LoadingScreen() {
  return (
    <div className="page centered">
      <p>{ui.loadingSession}</p>
    </div>
  );
}

function ProtectedRoute({ children, allowedRoles, requireSession = true }) {
  const auth = useAuth();
  const location = useLocation();

  if (!auth.ready) {
    return <LoadingScreen />;
  }

  if (requireSession && !auth.session) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  const effectiveRole = getEffectiveRole(auth);

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(effectiveRole)) {
    return <Navigate to={getDashboardPathForRole(effectiveRole)} replace />;
  }

  return children;
}

function DashboardRedirect() {
  const auth = useAuth();

  if (!auth.ready) {
    return <LoadingScreen />;
  }

  if (!auth.session) {
    return <Navigate to="/auth" replace />;
  }

  return <Navigate to={getDashboardPathForRole(getEffectiveRole(auth))} replace />;
}

function NotFoundPage() {
  usePageTitle(ui.pageNotFound);
  return (
    <div className="page centered">
      <h1>{ui.pageNotFound}</h1>
      <a className="button" href="/home">
        {ui.goHome}
      </a>
    </div>
  );
}

function TestPage() {
  usePageTitle(ui.testPageTitle);
  return (
    <div className="page centered">
      <h1>{ui.testPageTitle}</h1>
      <p>{ui.testPageMessage}</p>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/courses/:courseId" element={<CourseDetailPage />} />
        <Route path="/test" element={<TestPage />} />
        <Route
          path="/learn"
          element={
            <ProtectedRoute allowedRoles={['student', 'teacher', 'admin']}>
              <LearningPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/learn/:courseId"
          element={
            <ProtectedRoute allowedRoles={['student', 'teacher', 'admin']}>
              <LearningPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/learn/:courseId/:lessonId"
          element={
            <ProtectedRoute allowedRoles={['student', 'teacher', 'admin']}>
              <LearningPage />
            </ProtectedRoute>
          }
        />
        <Route path="/dashboard" element={<DashboardRedirect />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/dashboard/student"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/teacher"
          element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <TeacherDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
