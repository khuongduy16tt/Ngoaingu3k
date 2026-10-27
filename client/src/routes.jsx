import React, { Suspense, lazy } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './providers/AuthProvider';
import { getDashboardPathForRole, getEffectiveRole } from './lib/permissions';
import { ui } from './config/i18n';
import { usePageTitle } from './hooks/usePageTitle';
import { Mascot } from './components/home/Mascot';
import { OPEN_CONSULTATION_EVENT } from './components/ConsultationFab';

const HomePage = lazy(() => import('./pages/HomePage'));
const CoursesPage = lazy(() => import('./pages/CoursesPage'));
const CourseDetailPage = lazy(() => import('./pages/CourseDetailPage'));
const LearningPage = lazy(() => import('./pages/LearningPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const StudentProgressPage = lazy(() => import('./pages/StudentProgressPage'));
const StudentDashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((module) => ({ default: module.StudentDashboardPage }))
);
const TeacherDashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((module) => ({ default: module.TeacherDashboardPage }))
);
const AdminDashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((module) => ({ default: module.AdminDashboardPage }))
);
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const ExamsPage = lazy(() => import('./pages/ExamsPage'));
const ExamRoomPage = lazy(() => import('./pages/ExamRoomPage'));
const FlashcardsPage = lazy(() => import('./pages/FlashcardsPage'));
const CartPage = lazy(() => import('./pages/CartPage'));

function LoadingScreen() {
  return (
    <div className="page centered">
      <p>{ui.loadingSession}</p>
    </div>
  );
}

// Màn chờ khi đang tải mã của trang (lazy chunk) — khác màn chờ phiên đăng
// nhập: khách vào trang chủ không nên thấy chữ "Đang tải phiên".
function PageLoadingScreen() {
  return (
    <div className="page centered page-loading" role="status" aria-live="polite">
      <span className="page-loading__spinner" aria-hidden="true" />
      <p>{ui.loadingPage}</p>
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
  const navigate = useNavigate();

  return (
    <div className="page centered status-page">
      <div className="status-page__card">
        <Mascot className="status-page__mascot" mood="wow" />
        <span className="status-page__code" aria-hidden="true">404</span>
        <h1>{ui.pageNotFound}</h1>
        <div className="not-found__actions">
          {/* <a href> ở đây nạp lại cả SPA và mất state; Link giữ nguyên phiên. */}
          <Link className="button" to="/home">
            {ui.goHome}
          </Link>
          <button type="button" className="button-ghost" onClick={() => navigate(-1)}>
            {ui.goBack}
          </button>
        </div>
      </div>
    </div>
  );
}

// Bài test trình độ chưa có: thay trang trống bằng lối đi tiếp — mở form tư vấn
// (trung tâm kiểm tra trình độ qua tư vấn) hoặc xem khoá học.
function TestPage() {
  usePageTitle(ui.testPageTitle);
  return (
    <div className="page centered status-page">
      <div className="status-page__card">
        <Mascot className="status-page__mascot" />
        <span className="eyebrow">Kiểm tra trình độ miễn phí</span>
        <h1>{ui.testPageTitle}</h1>
        <p>{ui.testPageMessage} Trong lúc chờ, để lại thông tin — giảng viên sẽ kiểm tra trình độ và gửi lộ trình phù hợp cho bạn trong 24h.</p>
        <div className="not-found__actions">
          <button type="button" className="button" onClick={() => window.dispatchEvent(new Event(OPEN_CONSULTATION_EVENT))}>
            Đăng ký kiểm tra trình độ
          </button>
          <Link className="button-ghost" to="/courses">
            Xem khoá học
          </Link>
        </div>
      </div>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoadingScreen />}>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/courses/:courseId" element={<CourseDetailPage />} />
        <Route path="/cart" element={<CartPage />} />
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
        <Route
          path="/exams"
          element={
            <ProtectedRoute allowedRoles={['student', 'teacher', 'admin']}>
              <ExamsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/flashcards"
          element={
            <ProtectedRoute allowedRoles={['student', 'teacher', 'admin']}>
              <FlashcardsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/exam/:examId"
          element={
            <ProtectedRoute allowedRoles={['student', 'teacher', 'admin']}>
              <ExamRoomPage />
            </ProtectedRoute>
          }
        />
        <Route path="/dashboard" element={<DashboardRedirect />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student-progress"
          element={
            <ProtectedRoute allowedRoles={['teacher', 'admin']}>
              <StudentProgressPage />
            </ProtectedRoute>
          }
        />
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
