import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import CoursesPage from './pages/CoursesPage';
import CourseDetailPage from './pages/CourseDetailPage';
import LearningPage from './pages/LearningPage';
import AuthPage from './pages/AuthPage';
import {
  AdminDashboardPage,
  StudentDashboardPage,
  TeacherDashboardPage
} from './pages/DashboardPage';
import { useAuth } from './providers/AuthProvider';
import { getDashboardPathForRole, getEffectiveRole } from './lib/permissions';

function LoadingScreen() {
  return (
    <div className="page centered">
      <p>Loading session...</p>
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
  return (
    <div className="page centered">
      <h1>Page not found</h1>
      <a className="button" href="/home">
        Go home
      </a>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/courses" element={<CoursesPage />} />
      <Route path="/courses/:courseId" element={<CourseDetailPage />} />
      <Route
        path="/learn"
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
  );
}
