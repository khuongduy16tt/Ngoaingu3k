import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  confirmCoursePayment,
  getCourseBySlug,
  getOwnedCourseIds,
  getPendingCoursePaymentOrder,
  purchaseCourse
} from '../lib/courseService';
import { getEffectiveRole } from '../lib/permissions';
import { useAuth } from '../providers/AuthProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import { PaginationControls, usePagination } from '../components/Pagination';
import { PaymentInstructions } from '../components/PaymentInstructions';

const lessonStatusLabels = {
  done: 'hoàn thành',
  active: 'đang học',
  locked: 'đang khóa'
};

function formatLessonStatus(status) {
  return lessonStatusLabels[status] || status;
}

export default function CourseDetailPage() {
  const { courseId } = useParams();
  const auth = useAuth();
  usePageTitle(courseId ? `Khóa học ${courseId}` : 'Chi tiết khóa học');
  const currentRole = getEffectiveRole(auth);
  const [course, setCourse] = useState(null);
  const [ownedCourseIds, setOwnedCourseIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [feedback, setFeedback] = useState('');

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
  const sectionPagination = usePagination(courseSections, {
    pageSize: 3,
    resetKey: course?.id || courseId
  });

  async function handlePurchase() {
    if (!course || !auth.session || currentRole !== 'student' || isOwned) {
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
        <div>
          <span className="eyebrow">{course.category || 'Thông tin khóa học'}</span>
          <h1>{course.title}</h1>
          <p>{loading ? 'Đang tải thông tin khóa học...' : course.hero}</p>

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
              {currentRole === 'student' ? (purchasing ? 'Đang xử lý...' : 'Mua ngay') : 'Chỉ dành cho học viên'}
            </button>
          ) : (
            <Link className="button" to="/auth">
              Đăng nhập để mua
            </Link>
          )}

          <Link className="button-ghost" to="/courses">
            Quay lại danh mục
          </Link>
        </div>
      </section>

      <PaymentInstructions
        order={paymentOrder}
        confirming={confirmingPayment}
        onConfirm={handleConfirmPayment}
      />

      {feedback ? (
        <section className="content-card content-card--enterprise marketplace-feedback">
          <strong>Cập nhật khóa học</strong>
          <p>{feedback}</p>
        </section>
      ) : null}

      <section className="section split-layout">
        <div className="content-card content-card--enterprise">
          <h2>Nội dung khóa học</h2>
          {sectionPagination.pageItems.map((section) => (
            <div key={section.title}>
              <h3>{section.title}</h3>
              {section.lessons?.length ? (
                section.lessons.map((lesson) => (
                  <div key={lesson.id} className="detail-row">
                    <span>{lesson.title}</span>
                    <span>{formatLessonStatus(lesson.status)}</span>
                  </div>
                ))
              ) : (
                <div className="detail-row">
                  <span>Danh sách bài học sẽ hiển thị khi chương được đồng bộ.</span>
                  <span>Xem trước</span>
                </div>
              )}
            </div>
          ))}
          <PaginationControls {...sectionPagination} label="chương" />
        </div>

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
