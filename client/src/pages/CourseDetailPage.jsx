import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  confirmCoursePayment,
  getCourseBySlug,
  getOwnedCourseIds,
  getPendingCoursePaymentOrder,
  purchaseCourse
} from '../lib/courseService';
import { getLessonProgress } from '../lib/progressService';
import { isLessonComplete } from '../lib/lessonStars';
import { getEffectiveRole } from '../lib/permissions';
import { useAuth } from '../providers/AuthProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import { CourseLessonList } from '../components/CourseLessonList';
import { PaginationControls, usePagination } from '../components/Pagination';
import { PaymentInstructions } from '../components/PaymentInstructions';

export default function CourseDetailPage() {
  const { courseId } = useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  usePageTitle(courseId ? `Khóa học ${courseId}` : 'Chi tiết khóa học');
  const currentRole = getEffectiveRole(auth);
  const [course, setCourse] = useState(null);
  const [ownedCourseIds, setOwnedCourseIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [paymentScreenOpen, setPaymentScreenOpen] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [lessonProgressMap, setLessonProgressMap] = useState({});

  useEffect(() => {
    if (!auth.ready) {
      return undefined;
    }

    let alive = true;

    async function loadCourse() {
      setLoading(true);
      const nextCourse = await getCourseBySlug(courseId);
      const nextOwnedIds = nextCourse ? await getOwnedCourseIds(auth.user?.id, [nextCourse]) : [];

      if (alive) {
        setCourse(nextCourse);
        setOwnedCourseIds(nextOwnedIds);
        setPaymentOrder(nextCourse ? getPendingCoursePaymentOrder(auth.user?.id, nextCourse.id) || null : null);
        setLoading(false);
      }
    }

    void loadCourse();

    return () => {
      alive = false;
    };
  }, [auth.ready, auth.user?.id, courseId]);

  const isOwned = course ? ownedCourseIds.includes(course.id) : false;
  const courseSections = useMemo(() => course?.sections || [], [course?.sections]);
  const courseLessons = useMemo(
    () => courseSections.flatMap((section) => (Array.isArray(section.lessons) ? section.lessons : [])),
    [courseSections]
  );
  const sectionPagination = usePagination(courseSections, {
    pageSize: 3,
    resetKey: course?.id || courseId
  });

  // Tiến độ và điểm bài tập của học viên → dấu tích, sao và cúp của danh sách bài học.
  useEffect(() => {
    if (!course?.id || !courseLessons.length) {
      setLessonProgressMap({});
      return undefined;
    }

    let alive = true;

    async function loadProgress() {
      const nextProgress = await getLessonProgress({
        studentId: auth.user?.id,
        studentEmail: auth.user?.email,
        courseKey: course.id,
        lessons: courseLessons
      });

      if (alive) {
        setLessonProgressMap(nextProgress);
      }
    }

    void loadProgress();

    return () => {
      alive = false;
    };
  }, [auth.user?.id, auth.user?.email, course?.id, courseLessons]);

  async function handlePurchase() {
    if (!course || !auth.session || currentRole !== 'student' || isOwned) {
      return;
    }

    if (paymentOrder) {
      setPaymentScreenOpen(true);
      setFeedback('');
      return;
    }

    setPurchasing(true);
    setFeedback('');

    try {
      const result = await purchaseCourse({
        course,
        userId: auth.user?.id,
        accessToken: auth.session?.access_token,
        user: auth.user
      });

      setOwnedCourseIds(result.ownedCourseIds);
      setPaymentOrder(result.order || null);
      if (result.requiresPayment && result.order) {
        setPaymentScreenOpen(true);
      }
      setFeedback(
        result.requiresPayment
          ? 'Đã tạo mã thanh toán. Vui lòng chuyển khoản theo QR rồi bấm xác nhận.'
          : `${course.title} đã được ghi nhận.`
      );
    } catch (error) {
      setFeedback(error?.message || 'Chưa thể hoàn tất giao dịch. Vui lòng thử lại sau.');
    } finally {
      setPurchasing(false);
    }
  }

  async function handleConfirmPayment() {
    if (!paymentOrder) return;

    setConfirmingPayment(true);
    setFeedback('');

    try {
      const nextOrder = await confirmCoursePayment({
        order: paymentOrder,
        accessToken: auth.session?.access_token
      });
      setPaymentOrder(nextOrder);
      setPaymentScreenOpen(true);
      setFeedback('Đã gửi xác nhận thanh toán cho admin. Khóa học sẽ được mở sau khi kế toán kiểm tra.');
    } catch (error) {
      setFeedback(error?.message || 'Chưa thể gửi xác nhận thanh toán.');
    } finally {
      setConfirmingPayment(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <section className="content-card content-card--enterprise marketplace-empty">
          <span className="eyebrow">Đang tải</span>
          <h3>Đang tải thông tin khóa học...</h3>
        </section>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="page">
        <section className="content-card content-card--enterprise marketplace-empty">
          <span className="eyebrow">Không tìm thấy</span>
          <h3>Khóa học này không tồn tại hoặc chưa được xuất bản.</h3>
          <p>Danh mục chỉ hiển thị các khóa học đang có trong Supabase.</p>
          <Link className="button" to="/courses">
            Quay lại danh mục
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <section className="course-hero">
        <div style={{ flex: 1 }}>
          <span className="eyebrow">{course.category || 'Thông tin khóa học'}</span>
          <h1>{course.title}</h1>
          <p>{loading ? 'Đang tải thông tin khóa học...' : course.hero}</p>

          {course.bannerUrl && (
            <div style={{ margin: '1.5rem 0' }}>
              <img src={course.bannerUrl} alt={course.title} style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', borderRadius: 'var(--radius)' }} />
            </div>
          )}

          <div className="marketplace-card__facts course-detail__facts">
            <span>{course.level}</span>
            <span>{course.duration || 'Lịch học linh hoạt'}</span>
            <span>{course.lessonsCount || 0} bài học</span>
            <span>{course.instructor}</span>
          </div>
        </div>

        <div className="price-box course-detail__sidebar">
          <span className="pill">{isOwned ? 'Đã sở hữu' : 'Thanh toán một lần'}</span>
          <strong>{course.price}</strong>
          <p>
            {isOwned
              ? 'Khóa học này đã thuộc thư viện của tài khoản học viên hiện tại.'
              : 'Mua một lần, chuyển khoản qua QR và chờ admin mở khóa sau khi kế toán kiểm tra.'}
          </p>

          {isOwned ? (
            <Link className="button" to={`/learn/${course.id}`}>
              Vào học
            </Link>
          ) : auth.session ? (
            <button
              type="button"
              className="button"
              disabled={currentRole !== 'student' || purchasing}
              onClick={handlePurchase}
            >
              {currentRole === 'student' ? (purchasing ? 'Đang xử lý...' : paymentOrder ? 'Tiếp tục thanh toán' : 'Mua ngay') : 'Chỉ dành cho học viên'}
            </button>
          ) : (
            <Link className="button" to="/auth">
              Đăng nhập để mua
            </Link>
          )}

          <Link className="button-ghost" to="/courses">
            Quay lại danh mục
          </Link>

          {feedback ? (
            <div className="inline-feedback course-detail__feedback">
              {feedback}
            </div>
          ) : null}
        </div>
      </section>

      <PaymentInstructions
        order={paymentOrder}
        confirming={confirmingPayment}
        onConfirm={handleConfirmPayment}
        variant="overlay"
        open={paymentScreenOpen}
        onClose={() => setPaymentScreenOpen(false)}
      />

      <section className="section split-layout">
        <CourseLessonList
          sections={sectionPagination.pageItems}
          progressMap={lessonProgressMap}
          sectionOffset={(sectionPagination.page - 1) * sectionPagination.pageSize}
          totalLessonsCount={courseLessons.length}
          completedLessonsCount={courseLessons.filter((lesson) => isLessonComplete(lesson, lessonProgressMap)).length}
          onSelectLesson={isOwned ? (lessonId) => navigate(`/learn/${course.id}/${lessonId}`) : undefined}
          footer={<PaginationControls {...sectionPagination} label="chương" />}
        />

        <div className="content-card content-card--enterprise">
          <h2>Quyền lợi học viên</h2>
          <ul className="plain-list">
            {(course.whatYouGet || []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h3>Giảng viên</h3>
          <p>{course.instructor}</p>

          <h3>Quyền sở hữu</h3>
          <p>
            Khóa học đã mua được ghi nhận trong thư viện học viên, giúp đội ngũ vận hành dễ kiểm tra
            quyền truy cập và trạng thái sở hữu trong danh mục.
          </p>
        </div>
      </section>
    </div>
  );
}
