import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { confirmCoursePayment, getCourseCatalog, getOwnedCourseIds, purchaseCourse } from '../lib/courseService';
import { getEffectiveRole } from '../lib/permissions';
import { useAuth } from '../providers/AuthProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import { PaymentInstructions } from '../components/PaymentInstructions';

const roleLabels = {
  student: 'học viên',
  teacher: 'giảng viên',
  admin: 'quản trị viên'
};

function MarketplaceStat({ label, value, note }) {
  return (
    <article className="marketplace-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function isHskCourse(course) {
  const haystack = `${course.title || ''} ${course.category || ''} ${course.language || ''}`.toLowerCase();
  return haystack.includes('hsk') || haystack.includes('tiếng trung');
}

// Danh mục chỉ ~10-20 khóa nên không cần bộ lọc/sắp xếp/phân trang — sắp xếp
// cố định theo đánh giá + số học viên để khóa nổi bật lên trước, không lộ
// thành 1 control cho người dùng chỉnh.
function sortCoursesDefault(courses) {
  return [...courses].sort(
    (left, right) => right.rating - left.rating || right.studentsCount - left.studentsCount
  );
}

function CourseCard({ course, isOwned, authSession, currentRole, purchasingCourseId, feedback, onPurchase }) {
  const canBuy = authSession && currentRole === 'student' && !isOwned;
  const buyLabel = purchasingCourseId === course.id ? 'Đang xử lý...' : isOwned ? 'Đã sở hữu' : 'Mua ngay';
  const hasBanner = Boolean(course.bannerUrl);

  return (
    <article className={`course-card course-card--enterprise marketplace-card ${isOwned ? 'is-owned' : ''}`}>
      <div className={`marketplace-card__media ${hasBanner ? 'has-banner' : 'is-placeholder'}`}>
        {hasBanner ? (
          <img src={course.bannerUrl} alt={course.title} loading="lazy" />
        ) : (
          <div className="marketplace-card__fallback">
            <span>{course.category}</span>
            <strong>{course.title}</strong>
            <p>{course.summary}</p>
          </div>
        )}

        <div className="marketplace-card__badges">
          <span className="pill">{course.level}</span>
          <span className="pill marketplace-pill">{course.category}</span>
          {isOwned ? <span className="marketplace-owned-tag">Đã sở hữu</span> : null}
        </div>
      </div>

      <div className="marketplace-card__body">
        <div className="marketplace-card__headline">
          <div>
            <span className="marketplace-card__badge">{course.badge}</span>
            <h3>{course.title}</h3>
          </div>
          <span className="marketplace-card__rating">{course.rating.toFixed(1)}</span>
        </div>

        <p>{course.summary}</p>

        <div className="marketplace-card__facts">
          <span>{course.duration}</span>
          <span>{course.lessonsCount} bài học</span>
          <span>{course.instructor}</span>
        </div>

        <div className="marketplace-card__audience">
          <div className="meter">
            <span style={{ width: `${course.progress}%` }} />
          </div>
          <small>{course.studentsCount.toLocaleString('vi-VN')} học viên đã đăng ký</small>
        </div>

        <div className="marketplace-card__footer">
          <div className="marketplace-card__price">
            <strong>{course.price}</strong>
            <span>Thanh toán một lần · truy cập dài hạn</span>
          </div>

          <div className="marketplace-card__actions">
            <Link className="button-ghost" to={`/courses/${course.id}`}>
              Chi tiết
            </Link>

            {isOwned ? (
              <Link className="button" to={`/learn/${course.id}`}>
                Vào học
              </Link>
            ) : authSession ? (
              <button
                type="button"
                className="button"
                disabled={!canBuy || purchasingCourseId === course.id}
                onClick={() => onPurchase(course)}
              >
                {currentRole === 'student' ? buyLabel : 'Chỉ dành cho học viên'}
              </button>
            ) : (
              <Link className="button" to="/auth">
                Đăng nhập để mua
              </Link>
            )}
          </div>
        </div>

        {feedback.text && feedback.courseId === course.id ? (
          <div className="inline-feedback marketplace-card__feedback">{feedback.text}</div>
        ) : null}
      </div>
    </article>
  );
}

function CourseGroupSection({
  id,
  title,
  eyebrow,
  description,
  courses,
  emptyMessage,
  ownedCourseIdSet,
  authSession,
  currentRole,
  purchasingCourseId,
  feedback,
  onPurchase
}) {
  return (
    <section id={id} className="marketplace-program-group">
      <div className="section-head">
        <div className="section-head__copy">
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="pill">{courses.length} khóa</span>
      </div>

      {courses.length ? (
        <div className="card-grid marketplace-grid">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              isOwned={ownedCourseIdSet.has(course.id)}
              authSession={authSession}
              currentRole={currentRole}
              purchasingCourseId={purchasingCourseId}
              feedback={feedback}
              onPurchase={onPurchase}
            />
          ))}
        </div>
      ) : (
        <p className="empty-state">{emptyMessage}</p>
      )}
    </section>
  );
}

export default function CoursesPage() {
  usePageTitle('Khóa học');
  const auth = useAuth();
  const location = useLocation();
  const currentRole = getEffectiveRole(auth);
  const [courses, setCourses] = useState([]);
  const [ownedCourseIds, setOwnedCourseIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasingCourseId, setPurchasingCourseId] = useState('');
  const [activePaymentOrder, setActivePaymentOrder] = useState(null);
  const [paymentScreenOpen, setPaymentScreenOpen] = useState(false);
  const [confirmingOrderId, setConfirmingOrderId] = useState('');
  const [feedback, setFeedback] = useState({ courseId: '', text: '' });

  useEffect(() => {
    if (!auth.ready) {
      return undefined;
    }

    let alive = true;

    async function loadMarketplace() {
      setLoading(true);
      const nextCourses = await getCourseCatalog();
      const nextOwnedCourseIds = await getOwnedCourseIds(auth.user?.id, nextCourses);

      if (alive) {
        setCourses(nextCourses);
        setOwnedCourseIds(nextOwnedCourseIds);
        setLoading(false);
      }
    }

    void loadMarketplace();

    return () => {
      alive = false;
    };
  }, [auth.ready, auth.user?.id]);

  useEffect(() => {
    if (loading || !location.hash) {
      return;
    }

    const target = document.getElementById(location.hash.slice(1));
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [loading, location.hash]);

  const ownedCourseIdSet = useMemo(() => new Set(ownedCourseIds), [ownedCourseIds]);
  const ownedCourses = useMemo(
    () => courses.filter((course) => ownedCourseIdSet.has(course.id)),
    [courses, ownedCourseIdSet]
  );

  const ieltsCourses = useMemo(
    () => sortCoursesDefault(courses.filter((course) => !isHskCourse(course))),
    [courses]
  );
  const hskCourses = useMemo(() => sortCoursesDefault(courses.filter(isHskCourse)), [courses]);

  async function handlePurchase(course) {
    if (!auth.session || currentRole !== 'student') {
      return;
    }

    setFeedback({ courseId: '', text: '' });
    setPurchasingCourseId(course.id);

    try {
      const result = await purchaseCourse({
        course,
        userId: auth.user?.id,
        accessToken: auth.session?.access_token,
        user: auth.user
      });

      setOwnedCourseIds(result.ownedCourseIds);
      setActivePaymentOrder(result.order || null);
      if (result.requiresPayment && result.order) {
        setPaymentScreenOpen(true);
      }
      setFeedback({
        courseId: course.id,
        text: result.requiresPayment
          ? `Đã tạo yêu cầu thanh toán cho ${course.title}. Vui lòng quét QR và bấm xác nhận sau khi chuyển khoản.`
          : `${course.title} đã được ghi nhận.`
      });
    } catch (error) {
      setFeedback({ courseId: course.id, text: error?.message || 'Chưa thể hoàn tất giao dịch. Vui lòng thử lại sau.' });
    } finally {
      setPurchasingCourseId('');
    }
  }

  async function handleConfirmPayment() {
    if (!activePaymentOrder) return;

    setFeedback({ courseId: '', text: '' });
    setConfirmingOrderId(activePaymentOrder.id);

    try {
      const nextOrder = await confirmCoursePayment({
        order: activePaymentOrder,
        accessToken: auth.session?.access_token
      });
      setActivePaymentOrder(nextOrder);
      setPaymentScreenOpen(true);
      setFeedback({
        courseId: activePaymentOrder.localCourseId || activePaymentOrder.courseId || '',
        text: 'Đã gửi xác nhận thanh toán cho admin. Khóa học sẽ được mở sau khi kế toán kiểm tra.'
      });
    } catch (error) {
      setFeedback({
        courseId: activePaymentOrder.localCourseId || activePaymentOrder.courseId || '',
        text: error?.message || 'Chưa thể gửi xác nhận thanh toán.'
      });
    } finally {
      setConfirmingOrderId('');
    }
  }

  return (
    <div className="page course-market-page">
      <PaymentInstructions
        order={activePaymentOrder}
        confirming={confirmingOrderId === activePaymentOrder?.id}
        onConfirm={handleConfirmPayment}
        variant="overlay"
        open={paymentScreenOpen}
        onClose={() => setPaymentScreenOpen(false)}
      />

      <section className="content-card content-card--enterprise marketplace-hero marketplace-hero--compact">
        <div className="marketplace-hero__copy">
          <div>
            <span className="eyebrow">Danh mục đào tạo</span>
            <h1>Khóa học</h1>
          </div>
          <p>Chọn khóa học IELTS hoặc HSK phù hợp — hoặc gõ nhanh tên khóa ở menu "Khóa học" trên thanh điều hướng.</p>

          <div className="marketplace-hero__actions">
            <a className="button" href="#khoa-hoc-ielts">
              Xem khóa IELTS
            </a>
            <a className="button-ghost" href="#khoa-hoc-hsk">
              Xem khóa HSK
            </a>
          </div>
        </div>

        <div className="marketplace-hero__stats">
          <MarketplaceStat label="Khóa học" value={courses.length || '0'} note="công khai" />
          <MarketplaceStat label="Đã sở hữu" value={ownedCourses.length} note="trong thư viện" />
        </div>
      </section>

      <div className="marketplace-results">
        {ownedCourses.length ? (
          <section className="content-card content-card--enterprise marketplace-owned-strip">
            <div className="marketplace-owned-strip__head">
              <div>
                <span className="eyebrow">Thư viện sở hữu</span>
                <h3>Khóa học đã mua</h3>
              </div>
              <span className="pill">{ownedCourses.length} khóa</span>
            </div>

            <div className="marketplace-owned-strip__list">
              {ownedCourses.map((course) => (
                <Link key={course.id} className="marketplace-owned-tile" to={`/learn/${course.id}`}>
                  <strong>{course.title}</strong>
                  <span>
                    {course.category} · {course.level}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {!loading && auth.session ? (
          <p className="marketplace-results__meta">Vai trò hiện tại: {roleLabels[currentRole] || currentRole}</p>
        ) : null}

        {loading ? (
          <p className="empty-state">Đang tải danh mục khóa học...</p>
        ) : (
          <div className="marketplace-program-groups">
            <CourseGroupSection
              id="khoa-hoc-ielts"
              title="Khóa học IELTS"
              eyebrow="Tiếng Anh"
              description="Nền tảng, giao tiếp, luyện thi IELTS/TOEIC và tiếng Anh công sở."
              courses={ieltsCourses}
              emptyMessage="Chưa có khóa học IELTS nào được đăng."
              ownedCourseIdSet={ownedCourseIdSet}
              authSession={auth.session}
              currentRole={currentRole}
              purchasingCourseId={purchasingCourseId}
              feedback={feedback}
              onPurchase={handlePurchase}
            />

            <CourseGroupSection
              id="khoa-hoc-hsk"
              title="Khóa học HSK"
              eyebrow="Tiếng Trung"
              description="Luyện thi HSK theo từng cấp độ, xây nền tảng đến tăng tốc phản xạ."
              courses={hskCourses}
              emptyMessage="Chưa có khóa học HSK nào được đăng."
              ownedCourseIdSet={ownedCourseIdSet}
              authSession={auth.session}
              currentRole={currentRole}
              purchasingCourseId={purchasingCourseId}
              feedback={feedback}
              onPurchase={handlePurchase}
            />
          </div>
        )}
      </div>
    </div>
  );
}
