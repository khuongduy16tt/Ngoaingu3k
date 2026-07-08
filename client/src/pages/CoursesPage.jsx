import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCourseCatalog, getOwnedCourseIds, purchaseCourse } from '../lib/courseService';
import { getEffectiveRole } from '../lib/permissions';
import { useAuth } from '../providers/AuthProvider';

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

  if (priceTier === 'under-60') {
    return course.priceValue < 60;
  }

  if (priceTier === '60-89') {
    return course.priceValue >= 60 && course.priceValue < 90;
  }

  return course.priceValue >= 90;
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
  const auth = useAuth();
  const currentRole = getEffectiveRole(auth);
  const [courses, setCourses] = useState([]);
  const [ownedCourseIds, setOwnedCourseIds] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
  const [loading, setLoading] = useState(true);
  const [purchasingCourseId, setPurchasingCourseId] = useState('');
  const [feedback, setFeedback] = useState('');

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

  async function handlePurchase(course) {
    if (!auth.session || currentRole !== 'student') {
      return;
    }

    setFeedback('');
    setPurchasingCourseId(course.id);

    try {
      const result = await purchaseCourse({
        course,
        userId: auth.user?.id
      });

      setOwnedCourseIds(result.ownedCourseIds);
      setFeedback(
        result.mode === 'supabase'
          ? `${course.title} đã được thêm vào thư viện học tập của học viên.`
          : `${course.title} đã được kích hoạt trong thư viện khóa học.`
      );
    } catch (error) {
      setFeedback(error?.message || 'Chưa thể hoàn tất giao dịch. Vui lòng thử lại sau.');
    } finally {
      setPurchasingCourseId('');
    }
  }

  function resetFilters() {
    setFilters(initialFilters);
  }

  return (
    <div className="page course-market-page">
      <section className="content-card content-card--enterprise marketplace-hero">
        <div className="marketplace-hero__copy">
          <span className="eyebrow">Danh mục đào tạo</span>
          <h1>Lựa chọn đúng khóa học, quản lý quyền sở hữu và theo dõi thư viện học viên trong một nơi.</h1>
          <p>
            Trải nghiệm danh mục được thiết kế như một cổng bán khóa học chuyên nghiệp: học viên có thể
            tìm kiếm, lọc theo cấp độ hoặc chủ đề, sau đó kích hoạt khóa học vào thư viện cá nhân.
          </p>

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
          <MarketplaceStat label="Khóa học công khai" value={courses.length || '0'} note="Sẵn sàng tư vấn và bán" />
          <MarketplaceStat label="Đã sở hữu" value={ownedCourses.length} note="Ghi nhận theo từng học viên" />
          <MarketplaceStat label="Nhóm năng lực" value={categories.length - 1 || 0} note="Luyện thi, giao tiếp, công sở" />
        </div>
      </section>

      {feedback ? (
        <section className="content-card content-card--enterprise marketplace-feedback">
          <strong>Cập nhật danh mục</strong>
          <p>{feedback}</p>
        </section>
      ) : null}

      <section className="catalog-layout marketplace-layout">
        <aside className="content-card content-card--enterprise catalog-filters marketplace-filters">
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
                active={filters.price === 'under-60'}
                onClick={() => setFilters((previous) => ({ ...previous, price: 'under-60' }))}
              >
                Dưới $60
              </FilterButton>
              <FilterButton active={filters.price === '60-89'} onClick={() => setFilters((previous) => ({ ...previous, price: '60-89' }))}>
                $60 - $89
              </FilterButton>
              <FilterButton active={filters.price === '90-plus'} onClick={() => setFilters((previous) => ({ ...previous, price: '90-plus' }))}>
                Từ $90
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
                  ? 'Học viên đã đăng nhập có thể mua khóa học và thấy trạng thái sở hữu được cập nhật ngay.'
                  : 'Bạn có thể xem danh mục công khai. Hãy đăng nhập tài khoản học viên khi cần mua khóa học.'}
              </p>
            </div>

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
                {ownedCourses.slice(0, 3).map((course) => (
                  <Link key={course.id} className="marketplace-owned-tile" to={course.id === 'english-foundation' ? '/learn' : `/courses/${course.id}`}>
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
            <span>{auth.session ? `Vai trò hiện tại: ${roleLabels[currentRole] || currentRole}` : 'Chế độ xem khách'}</span>
          </div>

          {loading ? (
            <p className="empty-state">Đang tải danh mục khóa học...</p>
          ) : filteredCourses.length ? (
            <div id="course-market-grid" className="card-grid marketplace-grid">
              {filteredCourses.map((course) => {
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
                            <Link className="button" to={course.id === 'english-foundation' ? '/learn' : `/courses/${course.id}`}>
                              {course.id === 'english-foundation' ? 'Vào học' : 'Xem khóa học'}
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
                    </div>
                  </article>
                );
              })}
            </div>
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
