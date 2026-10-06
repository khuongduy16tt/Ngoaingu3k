import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  checkCoursePaymentStatus,
  getCourseCatalog,
  getOwnedCourseIds,
  isHskCourse,
  purchaseCourse
} from '../lib/courseService';
import { getEffectiveRole } from '../lib/permissions';
import { useAuth } from '../providers/AuthProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import { usePaymentStatusPolling } from '../hooks/usePaymentStatusPolling';
import { scrollIntoViewRespectingMotion } from '../lib/scrollMotion';
import { handleRemoteImageError, supabaseImageSrcSet, supabaseImageUrl } from '../lib/imageCdn';
import { PaymentInstructions } from '../components/PaymentInstructions';
import { formatVnd } from '../lib/money';
import { ComboSection } from '../components/ComboSection';
import { PackagePicker } from '../components/PackagePicker';
import { getPublishedCombos, purchaseCombo } from '../lib/comboService';

// Ảnh khoá học từ brief "Check ảnh web" (#11 Tiếng Anh, #12 Tiếng Trung) — dùng
// làm ảnh minh hoạ cho khoá chưa có bannerUrl riêng, luân phiên theo vị trí thẻ
// để các thẻ trong cùng nhóm không lặp lại một ảnh.
const ieltsPlaceholderPhotos = [
  '/images/imported/11.1_KH-TA-scaled.webp',
  '/images/imported/11.2_KH-TA-scaled.webp',
  '/images/imported/11.3_KH-TA-scaled.webp',
  '/images/imported/11.4_KH-TA-scaled.webp'
];
const hskPlaceholderPhotos = [
  '/images/imported/12.1_KH-TT-scaled.webp',
  '/images/imported/12.2_KH-TT-scaled.webp',
  '/images/imported/12.3_KH-TT-scaled.webp',
  '/images/imported/12.4_KH-TT-scaled.webp',
  '/images/imported/12.5_KH-TT-scaled.webp'
];

function MarketplaceStat({ label, value, note }) {
  return (
    <article className="marketplace-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

// Danh mục chỉ ~10-20 khóa nên không cần bộ lọc/sắp xếp/phân trang — sắp xếp
// cố định theo đánh giá + số học viên để khóa nổi bật lên trước, không lộ
// thành 1 control cho người dùng chỉnh.
function sortCoursesDefault(courses) {
  return [...courses].sort(
    (left, right) =>
      (right.rating ?? 0) - (left.rating ?? 0) || (right.studentsCount ?? 0) - (left.studentsCount ?? 0)
  );
}

function CourseCard({ course, isOwned, authSession, currentRole, purchasingCourseId, feedback, onPurchase, placeholderPhoto }) {
  const [withTutoring, setWithTutoring] = useState(false);
  const canBuy = authSession && currentRole === 'student' && !isOwned;
  const buyLabel =
    purchasingCourseId === course.id
      ? 'Đang xử lý...'
      : isOwned
        ? 'Đã sở hữu'
        : withTutoring
          ? 'Mua kèm dạy kèm'
          : 'Mua ngay';
  const hasBanner = Boolean(course.bannerUrl);
  const mediaSrc = course.bannerUrl || placeholderPhoto;

  return (
    <article className={`course-card course-card--enterprise marketplace-card ${isOwned ? 'is-owned' : ''}`}>
      <div className={`marketplace-card__media ${mediaSrc ? 'has-banner' : 'is-placeholder'}`}>
        {mediaSrc ? (
          <img
            src={supabaseImageUrl(mediaSrc, { width: 800 })}
            srcSet={supabaseImageSrcSet(mediaSrc)}
            sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 400px"
            onError={handleRemoteImageError(mediaSrc)}
            alt={course.title}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="marketplace-card__fallback">
            <span>{course.category}</span>
            <strong>{course.title}</strong>
            <p>{course.summary}</p>
          </div>
        )}

        <div className="marketplace-card__badges">
          {course.level ? <span className="pill">{course.level}</span> : null}
          {course.category ? <span className="pill marketplace-pill">{course.category}</span> : null}
          {isOwned ? <span className="marketplace-owned-tag">Đã sở hữu</span> : null}
        </div>
      </div>

      {/* Chỉ hiện số liệu có thật: khóa trên server không có điểm đánh giá, số
          học viên hay số tuần thì ẩn, không tự điền số đẹp cho đủ chỗ. */}
      <div className="marketplace-card__body">
        <div className="marketplace-card__headline">
          <div>
            {course.badge ? <span className="marketplace-card__badge">{course.badge}</span> : null}
            <h3>{course.title}</h3>
          </div>
          {typeof course.rating === 'number' ? (
            <span className="marketplace-card__rating">{course.rating.toFixed(1)}</span>
          ) : null}
        </div>

        {course.summary ? <p>{course.summary}</p> : null}

        <div className="marketplace-card__facts">
          {course.duration ? <span>{course.duration}</span> : null}
          {course.lessonsCount ? (
            <span>{course.lessonsCount} bài học</span>
          ) : course.topicsCount ? (
            <span>{course.topicsCount} chủ đề</span>
          ) : null}
          <span>Video bài giảng + bài tập</span>
        </div>

        {typeof course.studentsCount === 'number' && course.studentsCount > 0 ? (
          <div className="marketplace-card__audience">
            <div className="meter">
              <span style={{ width: `${course.progress}%` }} />
            </div>
            <small>{course.studentsCount.toLocaleString('vi-VN')} học viên đã đăng ký</small>
          </div>
        ) : null}

        {!isOwned ? (
          <PackagePicker
            price={course.priceValue}
            tutoringPrice={course.tutoringPriceValue}
            withTutoring={withTutoring}
            onChange={setWithTutoring}
          />
        ) : null}

        <div className="marketplace-card__footer">
          <div className="marketplace-card__price">
            <strong>{withTutoring ? formatVnd(course.tutoringPriceValue) : course.price}</strong>
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
                onClick={() => onPurchase(course, withTutoring)}
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
          <div className="inline-feedback marketplace-card__feedback" role="status">
            {feedback.text}
          </div>
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
  onPurchase,
  placeholderPhotos = []
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
          {courses.map((course, courseIndex) => (
            <CourseCard
              key={course.id}
              course={course}
              isOwned={ownedCourseIdSet.has(course.id)}
              authSession={authSession}
              currentRole={currentRole}
              purchasingCourseId={purchasingCourseId}
              feedback={feedback}
              onPurchase={onPurchase}
              placeholderPhoto={
                placeholderPhotos.length
                  ? placeholderPhotos[courseIndex % placeholderPhotos.length]
                  : undefined
              }
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
  const [combos, setCombos] = useState([]);
  const [ownedCourseIds, setOwnedCourseIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [purchasingCourseId, setPurchasingCourseId] = useState('');
  const [activePaymentOrder, setActivePaymentOrder] = useState(null);
  const [paymentScreenOpen, setPaymentScreenOpen] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [feedback, setFeedback] = useState({ courseId: '', text: '' });

  useEffect(() => {
    if (!auth.ready) {
      return undefined;
    }

    let alive = true;

    async function loadMarketplace() {
      setLoading(true);
      setLoadError('');

      try {
        const nextCourses = await getCourseCatalog();
        const [nextOwnedCourseIds, nextCombos] = await Promise.all([
          getOwnedCourseIds(auth.user?.id, nextCourses),
          getPublishedCombos(nextCourses)
        ]);

        if (alive) {
          setCourses(nextCourses);
          setCombos(nextCombos);
          setOwnedCourseIds(nextOwnedCourseIds);
        }
      } catch (error) {
        // Thiếu catch thì setLoading(false) không chạy, trang kẹt ở "Đang tải..."
        // vĩnh viễn mà không báo gì.
        console.warn('[loadMarketplace]', error?.message || error);
        if (alive) {
          setLoadError(error?.message || 'Chưa tải được danh mục khóa học.');
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    void loadMarketplace();

    return () => {
      alive = false;
    };
  }, [auth.ready, auth.user?.id, reloadKey]);

  useEffect(() => {
    if (loading || !location.hash) {
      return;
    }

    const target = document.getElementById(location.hash.slice(1));
    scrollIntoViewRespectingMotion(target, { block: 'start' });
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

  const syncPaymentStatus = useCallback(
    async (order) => {
      if (!order?.id || order.status === 'paid') {
        return;
      }

      setCheckingPayment(true);

      try {
        const result = await checkCoursePaymentStatus({
          order,
          accessToken: auth.session?.access_token
        });

        if (result.order) {
          setActivePaymentOrder(result.order);
        }

        if (result.paid) {
          setOwnedCourseIds(await getOwnedCourseIds(auth.user?.id, courses));
          setFeedback({
            courseId: order.comboId || order.localCourseId || order.courseId || '',
            text: `Đã nhận được thanh toán cho ${order.courseTitle}. Khóa học đã mở.`
          });
        }
      } catch (error) {
        // Mạng chập chờn giữa hai nhịp hỏi là chuyện thường, đừng dựng báo lỗi
        // đỏ giữa màn thanh toán — nhịp sau hỏi lại.
        console.warn('[checkCoursePaymentStatus]', error?.message || error);
      } finally {
        setCheckingPayment(false);
      }
    },
    [auth.session?.access_token, auth.user?.id, courses]
  );

  usePaymentStatusPolling({
    order: activePaymentOrder,
    active: paymentScreenOpen,
    onCheck: syncPaymentStatus
  });

  async function handlePurchase(course, withTutoring = false) {
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
        user: auth.user,
        withTutoring
      });

      setOwnedCourseIds(result.ownedCourseIds);
      setActivePaymentOrder(result.order || null);
      if (result.requiresPayment && result.order) {
        setPaymentScreenOpen(true);
      }
      setFeedback({
        courseId: course.id,
        text: result.requiresPayment
          ? `Đã tạo đơn thanh toán cho ${course.title}. Vui lòng chuyển khoản theo hướng dẫn để mở khóa học.`
          : `Bạn đã sở hữu ${course.title}.`
      });
    } catch (error) {
      setFeedback({ courseId: course.id, text: error?.message || 'Chưa thể hoàn tất giao dịch. Vui lòng thử lại sau.' });
    } finally {
      setPurchasingCourseId('');
    }
  }

  async function handlePurchaseCombo(combo, withTutoring = false) {
    if (!auth.session || currentRole !== 'student') {
      return;
    }

    setFeedback({ courseId: '', text: '' });
    setPurchasingCourseId(combo.id);

    try {
      const result = await purchaseCombo({
        combo,
        userId: auth.user?.id,
        accessToken: auth.session?.access_token,
        user: auth.user,
        withTutoring
      });

      if (result.ownedCourseIds) {
        setOwnedCourseIds(result.ownedCourseIds);
      }
      setActivePaymentOrder(result.order || null);
      if (result.requiresPayment && result.order) {
        setPaymentScreenOpen(true);
      }
      setFeedback({
        courseId: combo.id,
        text: result.requiresPayment
          ? `Đã tạo đơn thanh toán cho ${combo.title}. Vui lòng chuyển khoản theo hướng dẫn để mở khóa học.`
          : `Bạn đã sở hữu toàn bộ khóa trong ${combo.title}.`
      });
    } catch (error) {
      setFeedback({ courseId: combo.id, text: error?.message || 'Chưa thể hoàn tất giao dịch. Vui lòng thử lại sau.' });
    } finally {
      setPurchasingCourseId('');
    }
  }

  return (
    <div className="page course-market-page">
      <PaymentInstructions
        order={activePaymentOrder}
        checking={checkingPayment}
        onCheckNow={() => syncPaymentStatus(activePaymentOrder)}
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
          <p>Chọn khóa học IELTS hoặc HSK phù hợp với bạn.</p>

          <div className="marketplace-hero__actions">
            <a className="button" href="#khoa-hoc-ielts">
              Xem khóa IELTS
            </a>
            <a className="button-ghost" href="#khoa-hoc-hsk">
              Xem khóa HSK
            </a>
            {combos.length ? (
              <a className="button-ghost" href="#combo">
                Xem combo
              </a>
            ) : null}
          </div>
        </div>

        <div className="marketplace-hero__stats">
          <MarketplaceStat label="Khóa học" value={courses.length || '0'} note="đang mở" />
          {/* Khách chưa đăng nhập không có thư viện — "0 đã sở hữu" chỉ gây nhiễu. */}
          {auth.session ? (
            <MarketplaceStat label="Đã sở hữu" value={ownedCourses.length} note="khóa học" />
          ) : null}
        </div>
      </section>

      <div className="marketplace-results">
        {ownedCourses.length ? (
          <section className="content-card content-card--enterprise marketplace-owned-strip">
            <div className="marketplace-owned-strip__head">
              <div>
                <span className="eyebrow">Của bạn</span>
                <h3>Khóa học đã mua</h3>
              </div>
              <span className="pill">{ownedCourses.length} khóa</span>
            </div>

            <div className="marketplace-owned-strip__list">
              {ownedCourses.map((course) => (
                <Link key={course.id} className="marketplace-owned-tile" to={`/learn/${course.id}`}>
                  <strong>{course.title}</strong>
                  <span>
                    {[course.category, course.level].filter(Boolean).join(' · ')}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {loading ? (
          <p className="empty-state">Đang tải danh mục khóa học...</p>
        ) : loadError ? (
          <section className="content-card content-card--enterprise marketplace-empty">
            <span className="eyebrow">Lỗi tải trang</span>
            <h3>Chưa tải được danh mục khóa học</h3>
            <p role="alert">{loadError}</p>
            <button type="button" className="button" onClick={() => setReloadKey((value) => value + 1)}>
              Thử lại
            </button>
          </section>
        ) : (
          <div className="marketplace-program-groups">
            <ComboSection
              combos={combos}
              ownedCourseIdSet={ownedCourseIdSet}
              authSession={auth.session}
              currentRole={currentRole}
              purchasingId={purchasingCourseId}
              feedback={feedback}
              onPurchase={handlePurchaseCombo}
            />

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
              placeholderPhotos={ieltsPlaceholderPhotos}
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
              placeholderPhotos={hskPlaceholderPhotos}
            />
          </div>
        )}
      </div>
    </div>
  );
}
