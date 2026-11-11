import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  checkCoursePaymentStatus,
  getCourseBySlug,
  getCourseCatalog,
  getOwnedCourseIds,
  getPendingCoursePaymentOrder,
  getTutoringCourseIds,
  purchaseCourse
} from '../lib/courseService';
import { formatVnd } from '../lib/money';
import { PackagePicker } from '../components/PackagePicker';
import { AddToCartButton } from '../components/AddToCartButton';
import { handleRemoteImageError, supabaseImageSrcSet, supabaseImageUrl } from '../lib/imageCdn';
import { getLessonProgress } from '../lib/progressService';
import { isLessonComplete } from '../lib/lessonStars';
import { getEffectiveRole } from '../lib/permissions';
import { useAuth } from '../providers/AuthProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import { usePaymentStatusPolling } from '../hooks/usePaymentStatusPolling';
import { CourseLessonList } from '../components/CourseLessonList';
import { PaginationControls, usePagination } from '../components/Pagination';
import { PaymentInstructions } from '../components/PaymentInstructions';
import { AuthModalLink } from '../providers/AuthModalProvider';
import { toFriendlyError } from '../lib/friendlyError';

export default function CourseDetailPage() {
  const { courseId } = useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const currentRole = getEffectiveRole(auth);
  // Hai nguồn: bản tóm tắt trong danh mục (đã cache, có ngay giá + nút mua) và
  // bản đầy đủ có chương/bài (tải lâu hơn). Có bản nào hiện bản đó trước.
  const [summaryCourse, setSummaryCourse] = useState(null);
  const [detailCourse, setDetailCourse] = useState(null);
  const course = detailCourse || summaryCourse;
  // Tên khóa thật ("HSK 3") chứ không phải slug trên URL ("hsk-3").
  usePageTitle(course?.title ? `Khóa học ${course.title}` : 'Chi tiết khóa học');
  const [ownedCourseIds, setOwnedCourseIds] = useState([]);
  const [loading, setLoading] = useState(true);
  // Chưa biết học viên đã mua chưa thì chưa cho bấm mua (tránh "Mua ngay" chớp
  // lên với người đã có khóa).
  const [ownershipReady, setOwnershipReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [purchasing, setPurchasing] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [paymentScreenOpen, setPaymentScreenOpen] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [paymentCheckNote, setPaymentCheckNote] = useState('');
  const [feedback, setFeedback] = useState('');
  const [lessonProgressMap, setLessonProgressMap] = useState({});
  const [withTutoring, setWithTutoring] = useState(false);
  const [tutoringCourseIds, setTutoringCourseIds] = useState([]);
  // Màn QR mở ngay khi bấm mua, trong lúc server còn đang tạo mã.
  const [draftOrder, setDraftOrder] = useState(null);
  const [lastPurchaseTutoring, setLastPurchaseTutoring] = useState(false);

  // Bản tóm tắt từ danh mục: không cần chờ phiên đăng nhập, thường đã có trong
  // cache (vừa đi qua trang danh mục) nên giá và nút mua hiện gần như tức thì.
  useEffect(() => {
    let alive = true;
    setSummaryCourse(null);
    getCourseCatalog()
      .then((courses) => {
        const found = (courses || []).find(
          (item) => item.id === courseId || item.slug === courseId || item.databaseId === courseId
        );
        if (alive) setSummaryCourse(found || null);
      })
      .catch(() => {
        // Danh mục lỗi thì vẫn còn bản đầy đủ bên dưới.
      });
    return () => {
      alive = false;
    };
  }, [courseId, reloadKey]);

  useEffect(() => {
    if (!auth.ready) {
      return undefined;
    }

    let alive = true;

    // Đã mua chưa: truy vấn nhẹ, chạy song song với bản đầy đủ. Đọc theo uuid nên
    // không cần chờ khóa học (isOwned so cả slug lẫn uuid).
    async function loadOwnership() {
      setOwnershipReady(false);
      try {
        const [nextOwnedIds, nextTutoringIds] = await Promise.all([
          getOwnedCourseIds(auth.user?.id, []),
          getTutoringCourseIds(auth.user?.id)
        ]);
        if (alive) {
          setOwnedCourseIds(nextOwnedIds);
          setTutoringCourseIds(nextTutoringIds);
        }
      } catch (error) {
        console.warn('[loadOwnership]', error?.message || error);
      } finally {
        if (alive) setOwnershipReady(true);
      }
    }

    async function loadCourse() {
      setLoading(true);
      setLoadError('');

      try {
        // Trang này chỉ liệt kê chương và bài, không làm bài — xin bản không kèm
        // ngân hàng câu hỏi để khỏi tải cả bộ đề của toàn khóa.
        const nextCourse = await getCourseBySlug(courseId, { summaryOnly: true });

        if (alive) {
          setDetailCourse(nextCourse);
          setPaymentOrder(nextCourse ? getPendingCoursePaymentOrder(auth.user?.id, nextCourse.id) || null : null);
        }
      } catch (error) {
        // Thiếu catch thì trang kẹt ở màn "Đang tải thông tin khóa học...".
        console.warn('[loadCourse]', error?.message || error);
        if (alive) {
          setLoadError(toFriendlyError(error, 'Chưa tải được thông tin khóa học.'));
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    setDetailCourse(null);
    void loadOwnership();
    void loadCourse();

    return () => {
      alive = false;
    };
  }, [auth.ready, auth.user?.id, courseId, reloadKey]);

  const isOwned = course
    ? ownedCourseIds.includes(course.id) || ownedCourseIds.includes(course.databaseId)
    : false;
  const hasTutoring = course ? tutoringCourseIds.includes(course.databaseId) : false;
  const canAddTutoring = isOwned && !hasTutoring && Boolean(course?.tutoringPriceValue);
  const upgradeAmount = canAddTutoring ? Math.max(course.tutoringPriceValue - course.priceValue, 0) : 0;
  const courseSections = useMemo(() => course?.sections || [], [course?.sections]);
  const courseLessons = useMemo(
    () => courseSections.flatMap((section) => (Array.isArray(section.lessons) ? section.lessons : [])),
    [courseSections]
  );
  const sectionPagination = usePagination(courseSections, {
    pageSize: 12,
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

  // Nhịp tự hỏi chạy ngầm, không đổi chữ trên màn hình; chỉ khi học viên bấm
  // "Kiểm tra ngay" mới hiện "Đang kiểm tra..." và báo kết quả.
  const syncPaymentStatus = useCallback(
    async (order, { manual = false } = {}) => {
      if (!order?.id || order.status === 'paid') {
        return;
      }

      if (manual) {
        setCheckingPayment(true);
        setPaymentCheckNote('');
      }

      try {
        const result = await checkCoursePaymentStatus({
          order,
          accessToken: auth.session?.access_token
        });

        if (result.order) {
          setPaymentOrder(result.order);
        }

        if (manual && !result.paid) {
          setPaymentCheckNote('Chưa thấy tiền về. Ngân hàng có thể chậm vài phút — màn hình này sẽ tự cập nhật.');
        }

        if (result.paid && course) {
          setOwnedCourseIds(await getOwnedCourseIds(auth.user?.id, [course]));
          if (order.withTutoring) {
            setTutoringCourseIds(await getTutoringCourseIds(auth.user?.id));
          }
          setFeedback('Đã nhận được thanh toán. Khóa học đã mở, bạn vào học được ngay.');
        }
      } catch (error) {
        // Rớt mạng một nhịp thì nhịp sau hỏi lại, không cần dựng báo lỗi.
        console.warn('[checkCoursePaymentStatus]', error?.message || error);
        if (manual) {
          setPaymentCheckNote(toFriendlyError(error, 'Chưa kiểm tra được giao dịch. Vui lòng thử lại sau ít phút.'));
        }
      } finally {
        if (manual) {
          setCheckingPayment(false);
        }
      }
    },
    [auth.session?.access_token, auth.user?.id, course]
  );

  usePaymentStatusPolling({
    order: paymentOrder,
    active: paymentScreenOpen,
    onCheck: syncPaymentStatus
  });

  async function handlePurchase(buyTutoring = withTutoring) {
    if (!course || !auth.session || currentRole !== 'student' || (isOwned && !buyTutoring)) {
      return;
    }

    if (paymentOrder && Boolean(paymentOrder.withTutoring) === Boolean(buyTutoring)) {
      setPaymentScreenOpen(true);
      setFeedback('');
      return;
    }

    setPurchasing(true);
    setFeedback('');
    setLastPurchaseTutoring(buyTutoring);
    setDraftOrder({
      status: 'creating',
      courseTitle: buyTutoring ? `${course.title} + dạy kèm` : course.title,
      // Đã có khóa mà thêm dạy kèm thì chỉ trả phần chênh.
      amount: buyTutoring ? (isOwned ? upgradeAmount : course.tutoringPriceValue) : course.priceValue
    });
    setPaymentScreenOpen(true);

    try {
      const result = await purchaseCourse({
        course,
        userId: auth.user?.id,
        accessToken: auth.session?.access_token,
        user: auth.user,
        withTutoring: buyTutoring
      });

      setOwnedCourseIds(result.ownedCourseIds);
      setPaymentOrder(result.order || null);
      setDraftOrder(null);
      if (!(result.requiresPayment && result.order)) {
        setPaymentScreenOpen(false);
      }
      setFeedback(
        result.requiresPayment
          ? 'Đã tạo đơn thanh toán. Quét QR để chuyển khoản, khóa học tự mở khi tiền về.'
          : `Bạn đã sở hữu ${course.title}.`
      );
    } catch (error) {
      const message = toFriendlyError(error, 'Chưa thể hoàn tất giao dịch. Vui lòng thử lại sau.');
      setDraftOrder((draft) => (draft ? { ...draft, status: 'error', error: message } : draft));
      setFeedback(message);
    } finally {
      setPurchasing(false);
    }
  }

  // Màn chờ toàn trang chỉ khi chưa có cả bản tóm tắt lẫn bản đầy đủ.
  if (loading && !course) {
    return (
      <div className="page">
        <section className="content-card content-card--enterprise marketplace-empty">
          <span className="eyebrow">Đang tải</span>
          <h3>Đang tải thông tin khóa học...</h3>
        </section>
      </div>
    );
  }

  // Đặt trước nhánh !course: tải hỏng thì course cũng null, mà báo "không tồn
  // tại" cho một khóa vẫn còn là sai và làm người dùng bỏ đi.
  if (loadError && !course) {
    return (
      <div className="page">
        <section className="content-card content-card--enterprise marketplace-empty">
          <span className="eyebrow">Lỗi tải trang</span>
          <h3>Chưa tải được thông tin khóa học</h3>
          <p role="alert">{loadError}</p>
          <div className="marketplace-hero__actions">
            <button type="button" className="button" onClick={() => setReloadKey((value) => value + 1)}>
              Thử lại
            </button>
            <Link className="button-ghost" to="/courses">
              Quay lại danh mục
            </Link>
          </div>
        </section>
      </div>
    );
  }

  // Bản đầy đủ đã trả lời "không có" (khóa bị xóa/ẩn) thì không hiện bản tóm
  // tắt còn sót trong cache danh mục nữa.
  if (!course || (!loading && !loadError && !detailCourse)) {
    return (
      <div className="page">
        <section className="content-card content-card--enterprise marketplace-empty">
          <span className="eyebrow">Không tìm thấy</span>
          <h3>Khóa học này không tồn tại hoặc chưa được xuất bản.</h3>
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
          {course.hero ? <p>{course.hero}</p> : null}

          {course.bannerUrl && (
            <div style={{ margin: '1.5rem 0' }}>
              {/* Banner này là LCP của trang chi tiết: không lazy, ưu tiên cao,
                  nhưng vẫn lấy bản đã resize thay vì PNG gốc vài MB. */}
              <img
                src={supabaseImageUrl(course.bannerUrl, { width: 1200 })}
                srcSet={supabaseImageSrcSet(course.bannerUrl, [800, 1200, 1600])}
                sizes="(max-width: 900px) 100vw, 900px"
                onError={handleRemoteImageError(course.bannerUrl)}
                alt={course.title}
                fetchpriority="high"
                decoding="async"
                // Banner khóa học đều là 2:1 — giữ chỗ trước khi ảnh tải xong, không
                // thì khối thông tin và cột giá bị đẩy xuống (CLS 0.12).
                width={1200}
                height={600}
                // Hiện trọn ảnh theo tỉ lệ gốc: ép 2:1 + cắt (cover) làm mất logo ở mép trên.
                style={{
                  display: 'block',
                  width: '100%',
                  height: 'auto',
                  borderRadius: 'var(--radius)'
                }}
              />
            </div>
          )}

          <div className="marketplace-card__facts course-detail__facts">
            {course.level ? <span>{course.level}</span> : null}
            {course.duration ? <span>{course.duration}</span> : null}
            {/* Trang chi tiết có sẵn danh sách chương (= chủ đề) nên đếm thật
                thay vì chỉ dựa vào số đếm của danh mục. */}
            {courseSections.length || course.topicsCount ? (
              <span>{courseSections.length || course.topicsCount} chủ đề</span>
            ) : null}
            {course.lessonsCount ? <span>{course.lessonsCount} bài học</span> : null}
            {course.instructor ? <span>{course.instructor}</span> : null}
          </div>
        </div>

        <div className="price-box course-detail__sidebar">
          {isOwned ? <span className="pill">{hasTutoring ? 'Đã sở hữu · có dạy kèm' : 'Đã sở hữu'}</span> : null}
          {!isOwned ? (
            <PackagePicker
              price={course.priceValue}
              tutoringPrice={course.tutoringPriceValue}
              withTutoring={withTutoring}
              onChange={setWithTutoring}
            />
          ) : null}
          <strong>{withTutoring && !isOwned ? formatVnd(course.tutoringPriceValue) : course.price}</strong>

          {isOwned ? (
            <>
              <Link className="button" to={`/learn/${course.id}`}>
                Vào học
              </Link>
              {canAddTutoring && currentRole === 'student' ? (
                <button
                  type="button"
                  className="button-ghost"
                  disabled={purchasing}
                  onClick={() => handlePurchase(true)}
                >
                  {purchasing ? 'Đang xử lý...' : `Thêm dạy kèm · ${formatVnd(upgradeAmount)}`}
                </button>
              ) : null}
            </>
          ) : auth.session || !auth.ready ? (
            <button
              type="button"
              className="button"
              disabled={currentRole !== 'student' || purchasing || !ownershipReady}
              onClick={() => handlePurchase()}
            >
              {!ownershipReady
                ? 'Đang tải...'
                : currentRole !== 'student'
                  ? 'Chỉ dành cho học viên'
                  : purchasing
                    ? 'Đang xử lý...'
                    : paymentOrder && Boolean(paymentOrder.withTutoring) === withTutoring
                      ? 'Tiếp tục thanh toán'
                      : withTutoring
                        ? 'Mua kèm dạy kèm'
                        : 'Mua ngay'}
            </button>
          ) : (
            <AuthModalLink className="button">
              Đăng nhập để mua
            </AuthModalLink>
          )}

          {!isOwned && ownershipReady && (!auth.session || currentRole === 'student') ? (
            <AddToCartButton course={course} withTutoring={withTutoring} />
          ) : null}

          <Link className="button-ghost" to="/courses">
            Quay lại danh mục
          </Link>

          {feedback ? (
            <div className="inline-feedback course-detail__feedback" role="status">
              {feedback}
            </div>
          ) : null}
        </div>
      </section>

      <PaymentInstructions
        order={draftOrder || paymentOrder}
        onRetry={() => handlePurchase(lastPurchaseTutoring)}
        checking={checkingPayment}
        checkNote={paymentCheckNote}
        onCheckNow={() => syncPaymentStatus(paymentOrder, { manual: true })}
        learnHref={`/learn/${course.id}`}
        variant="overlay"
        open={paymentScreenOpen}
        onClose={() => {
          setPaymentScreenOpen(false);
          setPaymentCheckNote('');
          setDraftOrder(null);
        }}
      />

      <section className="section split-layout">
        {loading ? (
          <div className="content-card content-card--enterprise course-detail__lessons-loading" role="status">
            <span className="payment-waiting-dot" aria-hidden="true" />
            <span>Đang tải danh sách bài học...</span>
          </div>
        ) : loadError ? (
          <div className="content-card content-card--enterprise course-detail__lessons-loading" role="alert">
            <span>{loadError}</span>
            <button type="button" className="button-ghost" onClick={() => setReloadKey((value) => value + 1)}>
              Thử lại
            </button>
          </div>
        ) : (
        <CourseLessonList
          sections={sectionPagination.pageItems}
          progressMap={lessonProgressMap}
          sectionOffset={(sectionPagination.page - 1) * sectionPagination.pageSize}
          totalLessonsCount={courseLessons.length}
          completedLessonsCount={courseLessons.filter((lesson) => isLessonComplete(lesson, lessonProgressMap)).length}
          onSelectLesson={isOwned ? (lessonId) => navigate(`/learn/${course.id}/${lessonId}`) : undefined}
          footer={<PaginationControls {...sectionPagination} label="chương" />}
        />
        )}

        <div className="content-card content-card--enterprise">
          {course.whatYouGet?.length ? (
            <>
              <h2>Quyền lợi học viên</h2>
              <ul className="plain-list">
                {course.whatYouGet.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : null}

          {course.instructor ? (
            <>
              <h3>Giảng viên</h3>
              <p>{course.instructor}</p>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
