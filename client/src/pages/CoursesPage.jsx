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
          ? `${course.title} has been added to this student's library.`
          : `${course.title} is now available in owned courses for demo checkout flow.`
      );
    } catch (error) {
      setFeedback(error?.message || 'We could not complete the purchase right now.');
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
          <span className="eyebrow">Course marketplace</span>
          <h1>Buy the right course, filter the catalog, and keep owned courses in one student library.</h1>
          <p>
            This page now behaves like a real storefront: students can browse every course, filter by
            level or topic, and instantly move purchased courses into their owned collection.
          </p>

          <div className="marketplace-hero__actions">
            <a className="button" href="#course-market-grid">
              Explore courses
            </a>
            {auth.session ? (
              <Link className="button-ghost" to="/dashboard/student">
                Open student dashboard
              </Link>
            ) : (
              <Link className="button-ghost" to="/auth">
                Sign in to buy
              </Link>
            )}
          </div>
        </div>

        <div className="marketplace-hero__stats">
          <MarketplaceStat label="Published courses" value={courses.length || '0'} note="Ready for browsing" />
          <MarketplaceStat label="Owned courses" value={ownedCourses.length} note="Stored for this student" />
          <MarketplaceStat label="Learning tracks" value={categories.length - 1 || 0} note="Exam, speaking, career" />
        </div>
      </section>

      {feedback ? (
        <section className="content-card content-card--enterprise marketplace-feedback">
          <strong>Marketplace update</strong>
          <p>{feedback}</p>
        </section>
      ) : null}

      <section className="catalog-layout marketplace-layout">
        <aside className="content-card content-card--enterprise catalog-filters marketplace-filters">
          <div className="marketplace-filters__head">
            <div>
              <span className="eyebrow">Filters</span>
              <h2>Refine the catalog</h2>
            </div>
            <button type="button" className="text-control marketplace-reset" onClick={resetFilters}>
              Reset
            </button>
          </div>

          <label className="marketplace-field">
            <span>Search by course or instructor</span>
            <input
              className="lesson-input marketplace-search"
              type="search"
              value={filters.search}
              onChange={(event) => setFilters((previous) => ({ ...previous, search: event.target.value }))}
              placeholder="Try IELTS, speaking, business..."
            />
          </label>

          <div className="marketplace-filter-group">
            <span>Ownership</span>
            <div className="marketplace-chip-row">
              <FilterButton active={filters.status === 'all'} onClick={() => setFilters((previous) => ({ ...previous, status: 'all' }))}>
                All
              </FilterButton>
              <FilterButton
                active={filters.status === 'available'}
                onClick={() => setFilters((previous) => ({ ...previous, status: 'available' }))}
              >
                Available
              </FilterButton>
              <FilterButton active={filters.status === 'owned'} onClick={() => setFilters((previous) => ({ ...previous, status: 'owned' }))}>
                Owned
              </FilterButton>
            </div>
          </div>

          <div className="marketplace-filter-group">
            <span>Level</span>
            <div className="marketplace-chip-row">
              {levels.map((level) => (
                <FilterButton
                  key={level}
                  active={filters.level === level}
                  onClick={() => setFilters((previous) => ({ ...previous, level }))}
                >
                  {level === 'all' ? 'All levels' : level}
                </FilterButton>
              ))}
            </div>
          </div>

          <div className="marketplace-filter-group">
            <span>Category</span>
            <div className="marketplace-chip-row">
              {categories.map((category) => (
                <FilterButton
                  key={category}
                  active={filters.category === category}
                  onClick={() => setFilters((previous) => ({ ...previous, category }))}
                >
                  {category === 'all' ? 'All topics' : category}
                </FilterButton>
              ))}
            </div>
          </div>

          <div className="marketplace-filter-group">
            <span>Price</span>
            <div className="marketplace-chip-row">
              <FilterButton active={filters.price === 'all'} onClick={() => setFilters((previous) => ({ ...previous, price: 'all' }))}>
                All prices
              </FilterButton>
              <FilterButton
                active={filters.price === 'under-60'}
                onClick={() => setFilters((previous) => ({ ...previous, price: 'under-60' }))}
              >
                Under $60
              </FilterButton>
              <FilterButton active={filters.price === '60-89'} onClick={() => setFilters((previous) => ({ ...previous, price: '60-89' }))}>
                $60-$89
              </FilterButton>
              <FilterButton active={filters.price === '90-plus'} onClick={() => setFilters((previous) => ({ ...previous, price: '90-plus' }))}>
                $90+
              </FilterButton>
            </div>
          </div>
        </aside>

        <div className="marketplace-results">
          <div className="section-head marketplace-results__head">
            <div className="section-head__copy">
              <span className="eyebrow">Student catalog</span>
              <h2>{filters.status === 'owned' ? 'Owned courses ready to revisit' : 'Courses ready to buy'}</h2>
              <p>
                {auth.session
                  ? 'Signed-in students can purchase a course and see it move straight into owned status.'
                  : 'Browsing is public. Sign in with a student account when you want to buy.'}
              </p>
            </div>

            <label className="marketplace-sort">
              <span>Sort by</span>
              <select
                value={filters.sort}
                onChange={(event) => setFilters((previous) => ({ ...previous, sort: event.target.value }))}
              >
                <option value="featured">Featured</option>
                <option value="rating">Top rated</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
              </select>
            </label>
          </div>

          {ownedCourses.length ? (
            <section className="content-card content-card--enterprise marketplace-owned-strip">
              <div className="marketplace-owned-strip__head">
                <div>
                  <span className="eyebrow">Owned library</span>
                  <h3>Your purchased courses</h3>
                </div>
                <span className="pill">{ownedCourses.length} owned</span>
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
            <span>{filteredCourses.length} matching courses</span>
            <span>{activeFilterCount} active filters</span>
            <span>{auth.session ? `Current role: ${currentRole}` : 'Guest browsing mode'}</span>
          </div>

          {loading ? (
            <p className="empty-state">Loading course marketplace...</p>
          ) : filteredCourses.length ? (
            <div id="course-market-grid" className="card-grid marketplace-grid">
              {filteredCourses.map((course) => {
                const isOwned = ownedCourseIdSet.has(course.id);
                const canBuy = auth.session && currentRole === 'student' && !isOwned;
                const buyLabel =
                  purchasingCourseId === course.id ? 'Processing...' : isOwned ? 'Owned' : 'Buy now';

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
                        {isOwned ? <span className="marketplace-owned-tag">Owned</span> : null}
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
                        <span>{course.lessonsCount} lessons</span>
                        <span>{course.instructor}</span>
                      </div>

                      <div className="marketplace-card__audience">
                        <div className="meter">
                          <span style={{ width: `${course.progress}%` }} />
                        </div>
                        <small>{course.studentsCount.toLocaleString()} students enrolled</small>
                      </div>

                      <div className="marketplace-card__footer">
                        <div className="marketplace-card__price">
                          <strong>{course.price}</strong>
                          <span>One-time purchase · lifetime access</span>
                        </div>

                        <div className="marketplace-card__actions">
                          <Link className="button-ghost" to={`/courses/${course.id}`}>
                            Details
                          </Link>

                          {isOwned ? (
                            <Link className="button" to={course.id === 'english-foundation' ? '/learn' : `/courses/${course.id}`}>
                              {course.id === 'english-foundation' ? 'Start learning' : 'View owned'}
                            </Link>
                          ) : auth.session ? (
                            <button
                              type="button"
                              className="button"
                              disabled={!canBuy || purchasingCourseId === course.id}
                              onClick={() => handlePurchase(course)}
                            >
                              {currentRole === 'student' ? buyLabel : 'Student only'}
                            </button>
                          ) : (
                            <Link className="button" to="/auth">
                              Sign in to buy
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
              <span className="eyebrow">No results</span>
              <h3>No course matches the current filters.</h3>
              <p>Try clearing some filters to reveal more courses that students can buy or already own.</p>
              <button type="button" className="button" onClick={resetFilters}>
                Clear filters
              </button>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
