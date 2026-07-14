import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { confirmCoursePayment, getCourseCatalog, getOwnedCourseIds, purchaseCourse } from '../lib/courseService';
import { getEffectiveRole } from '../lib/permissions';
import { useAuth } from '../providers/AuthProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import { PaginationControls, usePagination } from '../components/Pagination';
import { PaymentInstructions } from '../components/PaymentInstructions';

const initialFilters = {
  search: '',
  level: 'all',
  category: 'all',
  price: 'all',
  status: 'all',
  sort: 'featured'
};

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

function FilterButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      className={`answer-pill marketplace-filter-pill ${active ? 'is-active' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function matchesPriceTier(course, priceTier) {
  if (priceTier === 'all') {
    return true;
  }

  if (priceTier === 'under-600') {
    return course.priceValue < 600000;
  }

  if (priceTier === '600-899') {
    return course.priceValue >= 600000 && course.priceValue < 900000;
  }

  return course.priceValue >= 900000;
}

function sortCourses(courses, sortKey) {
  const sorted = [...courses];

  sorted.sort((left, right) => {
    if (sortKey === 'price-low') {
      return left.priceValue - right.priceValue;
    }

    if (sortKey === 'price-high') {
      return right.priceValue - left.priceValue;
    }

    if (sortKey === 'rating') {
      return right.rating - left.rating || right.studentsCount - left.studentsCount;
    }

    return (
      right.progress - left.progress ||
      right.rating - left.rating ||
      right.studentsCount - left.studentsCount
    );
  });

  return sorted;
}

export default function CoursesPage() {
  usePageTitle('Khóa học');
  const auth = useAuth();
  const currentRole = getEffectiveRole(auth);
  const [courses, setCourses] = useState([]);
  const [ownedCourseIds, setOwnedCourseIds] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
  const [loading, setLoading] = useState(true);
  const [purchasingCourseId, setPurchasingCourseId] = useState('');
  const [activePaymentOrder, setActivePaymentOrder] = useState(null);
  const [paymentScreenOpen, setPaymentScreenOpen] = useState(false);
  const [confirmingOrderId, setConfirmingOrderId] = useState('');
  const [feedback, setFeedback] = useState({ courseId: '', text: '' });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [coursePageSize, setCoursePageSize] = useState(6);

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

  const levels = useMemo(
    () => ['all', ...new Set(courses.map((course) => course.level))],
    [courses]
  );
  const categories = useMemo(
    () => ['all', ...new Set(courses.map((course) => course.category))],
    [courses]
  );
  const ownedCourseIdSet = useMemo(() => new Set(ownedCourseIds), [ownedCourseIds]);
  const ownedCourses = useMemo(
    () => courses.filter((course) => ownedCourseIdSet.has(course.id)),
    [courses, ownedCourseIdSet]
  );

  const filteredCourses = useMemo(() => {
    const searchValue = filters.search.trim().toLowerCase();

    const nextCourses = courses.filter((course) => {
      const isOwned = ownedCourseIdSet.has(course.id);
      const matchesSearch =
        !searchValue ||
        course.title.toLowerCase().includes(searchValue) ||
        course.summary.toLowerCase().includes(searchValue) ||
        course.instructor.toLowerCase().includes(searchValue);
      const matchesLevel = filters.level === 'all' || course.level === filters.level;
      const matchesCategory = filters.category === 'all' || course.category === filters.category;
      const matchesOwnership =
        filters.status === 'all' ||
        (filters.status === 'owned' && isOwned) ||
        (filters.status === 'available' && !isOwned);

      return (
        matchesSearch &&
        matchesLevel &&
        matchesCategory &&
        matchesOwnership &&
        matchesPriceTier(course, filters.price)
      );
    });

    return sortCourses(nextCourses, filters.sort);
  }, [courses, filters, ownedCourseIdSet]);

  const activeFilterCount = useMemo(() => {
    return [
      filters.search.trim(),
      filters.level !== 'all',
      filters.category !== 'all',
      filters.price !== 'all',
      filters.status !== 'all'
    ].filter(Boolean).length;
  }, [filters]);
  const coursePagination = usePagination(filteredCourses, {
    pageSize: coursePageSize,
    resetKey: `${filters.search}|${filters.level}|${filters.category}|${filters.price}|${filters.status}|${filters.sort}|${courses.length}`
  });

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

  function resetFilters() {
    setFilters(initialFilters);
  }

  function toggleFilters() {
    setFiltersOpen((currentValue) => !currentValue);
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
          <p>Tìm, lọc và mua khóa học phù hợp.</p>

          <div className="marketplace-hero__actions">
            <a className="button" href="#course-market-grid">
              Xem khóa học
            </a>
            {auth.session ? (
              <Link className="button-ghost" to="/dashboard/student">
                Mở bảng điều khiển học viên
              </Link>
            ) : (
              <Link className="button-ghost" to="/auth">
                Đăng nhập để mua
              </Link>
            )}
          </div>
        </div>

        <div className="marketplace-hero__stats">
          <MarketplaceStat label="Khóa học" value={courses.length || '0'} note="công khai" />
          <MarketplaceStat label="Đã sở hữu" value={ownedCourses.length} note="trong thư viện" />
          <MarketplaceStat label="Nhóm" value={categories.length - 1 || 0} note="năng lực" />
        </div>
      </section>

      <section className={`catalog-layout marketplace-layout ${filtersOpen ? 'marketplace-layout--filters-open' : 'marketplace-layout--filters-closed'}`}>
        <aside
          id="course-marketplace-filters"
          className="content-card content-card--enterprise catalog-filters marketplace-filters"
          hidden={!filtersOpen}
        >
          <div className="marketplace-filters__head">
            <div>
              <span className="eyebrow">Bộ lọc</span>
              <h2>Tinh chỉnh danh mục</h2>
            </div>
            <button type="button" className="text-control marketplace-reset" onClick={resetFilters}>
              Đặt lại
            </button>
          </div>

          <label className="marketplace-field">
            <span>Tìm theo khóa học hoặc giảng viên</span>
            <input
              className="lesson-input marketplace-search"
              type="search"
              value={filters.search}
              onChange={(event) => setFilters((previous) => ({ ...previous, search: event.target.value }))}
              placeholder="Ví dụ: IELTS, giao tiếp, doanh nghiệp..."
            />
          </label>

          <div className="marketplace-filter-group">
            <span>Trạng thái sở hữu</span>
            <div className="marketplace-chip-row">
              <FilterButton active={filters.status === 'all'} onClick={() => setFilters((previous) => ({ ...previous, status: 'all' }))}>
                Tất cả
              </FilterButton>
              <FilterButton
                active={filters.status === 'available'}
                onClick={() => setFilters((previous) => ({ ...previous, status: 'available' }))}
              >
                Có thể mua
              </FilterButton>
              <FilterButton active={filters.status === 'owned'} onClick={() => setFilters((previous) => ({ ...previous, status: 'owned' }))}>
                Đã sở hữu
              </FilterButton>
            </div>
          </div>

          <div className="marketplace-filter-group">
            <span>Cấp độ</span>
            <div className="marketplace-chip-row">
              {levels.map((level) => (
                <FilterButton
                  key={level}
                  active={filters.level === level}
                  onClick={() => setFilters((previous) => ({ ...previous, level }))}
                >
                  {level === 'all' ? 'Tất cả cấp độ' : level}
                </FilterButton>
              ))}
            </div>
          </div>

          <div className="marketplace-filter-group">
            <span>Chủ đề</span>
            <div className="marketplace-chip-row">
              {categories.map((category) => (
                <FilterButton
                  key={category}
                  active={filters.category === category}
                  onClick={() => setFilters((previous) => ({ ...previous, category }))}
                >
                  {category === 'all' ? 'Tất cả chủ đề' : category}
                </FilterButton>
              ))}
            </div>
          </div>

          <div className="marketplace-filter-group">
            <span>Ngân sách</span>
            <div className="marketplace-chip-row">
              <FilterButton active={filters.price === 'all'} onClick={() => setFilters((previous) => ({ ...previous, price: 'all' }))}>
                Tất cả mức giá
              </FilterButton>
              <FilterButton
                active={filters.price === 'under-600'}
                onClick={() => setFilters((previous) => ({ ...previous, price: 'under-600' }))}
              >
                Dưới 600.000 đ
              </FilterButton>
              <FilterButton active={filters.price === '600-899'} onClick={() => setFilters((previous) => ({ ...previous, price: '600-899' }))}>
                600.000 - 899.000 đ
              </FilterButton>
              <FilterButton active={filters.price === '90-plus'} onClick={() => setFilters((previous) => ({ ...previous, price: '90-plus' }))}>
                Từ 900.000 đ
              </FilterButton>
            </div>
          </div>
        </aside>

        <div className="marketplace-results">
          <div className="section-head marketplace-results__head">
            <div className="section-head__copy">
              <span className="eyebrow">Danh mục học viên</span>
              <h2>{filters.status === 'owned' ? 'Khóa học đã sở hữu' : 'Khóa học sẵn sàng đăng ký'}</h2>
              <p>
                {auth.session
                  ? 'Học viên đã đăng nhập có thể tạo yêu cầu thanh toán, sau đó chờ admin mở khóa sau khi kế toán kiểm tra.'
                  : 'Bạn có thể xem danh mục công khai. Hãy đăng nhập tài khoản học viên khi cần mua khóa học.'}
              </p>
            </div>

            <div className="marketplace-results__tools">
              <button
                type="button"
                className={`button-ghost marketplace-filter-toggle ${filtersOpen ? 'is-active' : ''}`}
                onClick={toggleFilters}
                aria-expanded={filtersOpen}
                aria-controls="course-marketplace-filters"
              >
                {filtersOpen ? 'Ẩn bộ lọc' : 'Bộ lọc'}
                {activeFilterCount ? <span>{activeFilterCount}</span> : null}
              </button>

              {activeFilterCount ? (
                <button type="button" className="button-ghost marketplace-quick-reset" onClick={resetFilters}>
                  Đặt lại
                </button>
              ) : null}

              <label className="marketplace-sort">
                <span>Sắp xếp</span>
                <select
                  value={filters.sort}
                  onChange={(event) => setFilters((previous) => ({ ...previous, sort: event.target.value }))}
                >
                  <option value="featured">Nổi bật</option>
                  <option value="rating">Đánh giá cao</option>
                  <option value="price-low">Giá tăng dần</option>
                  <option value="price-high">Giá giảm dần</option>
                </select>
              </label>

              <label className="marketplace-sort marketplace-page-size">
                <span>Hiển thị</span>
                <select
                  value={coursePageSize}
                  onChange={(event) => setCoursePageSize(Number(event.target.value))}
                >
                  <option value={4}>4 khóa/trang</option>
                  <option value={6}>6 khóa/trang</option>
                  <option value={8}>8 khóa/trang</option>
                  <option value={12}>12 khóa/trang</option>
                </select>
              </label>
            </div>
          </div>

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

          <div className="marketplace-results__meta">
            <span>{filteredCourses.length} khóa học phù hợp</span>
            <span>{activeFilterCount} bộ lọc đang áp dụng</span>
            <span>
              Trang {coursePagination.page}/{coursePagination.pageCount}
            </span>
            <span>{auth.session ? `Vai trò hiện tại: ${roleLabels[currentRole] || currentRole}` : 'Chế độ xem khách'}</span>
          </div>

          {loading ? (
            <p className="empty-state">Đang tải danh mục khóa học...</p>
          ) : filteredCourses.length ? (
            <>
              <PaginationControls {...coursePagination} label="khóa học" />
              <div id="course-market-grid" className="card-grid marketplace-grid">
                {coursePagination.pageItems.map((course) => {
                const isOwned = ownedCourseIdSet.has(course.id);
                const canBuy = auth.session && currentRole === 'student' && !isOwned;
                const buyLabel =
                  purchasingCourseId === course.id ? 'Đang xử lý...' : isOwned ? 'Đã sở hữu' : 'Mua ngay';

                return (
                  <article
                    key={course.id}
                    className={`course-card course-card--enterprise marketplace-card ${isOwned ? 'is-owned' : ''}`}
                  >
                    <div className="marketplace-card__media">
                      {course.bannerUrl ? (
                        <img src={course.bannerUrl} alt={course.title} loading="lazy" />
                      ) : (
                        <div className="marketplace-card__fallback">
                          <span>{course.category}</span>
                          <strong>{course.title}</strong>
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
                          ) : auth.session ? (
                            <button
                              type="button"
                              className="button"
                              disabled={!canBuy || purchasingCourseId === course.id}
                              onClick={() => handlePurchase(course)}
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
                        <div className="inline-feedback marketplace-card__feedback">
                          {feedback.text}
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
                })}
              </div>
              <PaginationControls {...coursePagination} label="khóa học" />
            </>
          ) : (
            <section className="content-card content-card--enterprise marketplace-empty">
              <span className="eyebrow">Không có kết quả</span>
              <h3>Chưa có khóa học phù hợp với bộ lọc hiện tại.</h3>
              <p>Hãy bỏ bớt điều kiện lọc để xem thêm khóa học có thể mua hoặc đã sở hữu.</p>
              <button type="button" className="button" onClick={resetFilters}>
                Xóa bộ lọc
              </button>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
