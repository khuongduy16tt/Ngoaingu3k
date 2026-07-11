import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { courseDetail as mockCourseDetail } from '../data/mock';
import { getCourseBySlug, getOwnedCourseIds, purchaseCourse } from '../lib/courseService';
import { getEffectiveRole } from '../lib/permissions';
import { useAuth } from '../providers/AuthProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import { PaginationControls, usePagination } from '../components/Pagination';

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
  const [course, setCourse] = useState({
    ...mockCourseDetail,
    price: '$0',
    priceValue: 0,
    instructor: 'Cô Linh',
    level: 'Nền tảng',
    category: 'Kỹ năng cốt lõi',
    whatYouGet: []
  });
  const [ownedCourseIds, setOwnedCourseIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!auth.ready) {
      return undefined;
    }

    let alive = true;

    async function loadCourse() {
      setLoading(true);
      const nextCourse = await getCourseBySlug(courseId);
      const nextOwnedIds = await getOwnedCourseIds(auth.user?.id, [nextCourse]);

      if (alive) {
        setCourse(nextCourse);
        setOwnedCourseIds(nextOwnedIds);
        setLoading(false);
      }
    }

    void loadCourse();

    return () => {
      alive = false;
    };
  }, [auth.ready, auth.user?.id, courseId]);

  const isOwned = ownedCourseIds.includes(course.id);
  const courseSections = useMemo(() => course.sections || [], [course.sections]);
  const sectionPagination = usePagination(courseSections, {
    pageSize: 3,
    resetKey: course.id
  });

  async function handlePurchase() {
    if (!auth.session || currentRole !== 'student' || isOwned) {
      return;
    }

    setPurchasing(true);
    setFeedback('');

    try {
      const result = await purchaseCourse({
        course,
        userId: auth.user?.id,
        accessToken: auth.session?.access_token
      });

      setOwnedCourseIds(result.ownedCourseIds);
      setFeedback(`${course.title} đã được kích hoạt trong thư viện học tập của học viên.`);
    } catch (error) {
      setFeedback(error?.message || 'Chưa thể hoàn tất giao dịch. Vui lòng thử lại sau.');
    } finally {
      setPurchasing(false);
    }
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
              : 'Mua một lần, kích hoạt ngay và lưu khóa học trong thư viện cá nhân.'}
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
