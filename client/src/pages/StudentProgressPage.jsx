import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PaginationControls, usePagination } from '../components/Pagination';
import {
  buildDailySignupTrend,
  buildNewStudentStats,
  filterStudentRoster,
  getPackageStatus,
  getPackageStatusLabel,
  getStudentRoster
} from '../lib/studentProgressService';
import { exportStudentRosterToExcel } from '../lib/reportService';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAuth } from '../providers/AuthProvider';

const REFRESH_INTERVAL_MS = 30000;
const TREND_DAYS = 30;

function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '';
  }
}

function formatShortDate(isoDateKey) {
  const [, month, day] = isoDateKey.split('-');
  return `${day}/${month}`;
}

// Path hình chữ nhật chỉ bo góc trên (đáy cột luôn thẳng, chạm baseline) —
// đúng mark spec "rounded data-ends anchored to the baseline" cho bar chart.
function topRoundedRectPath(x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  return `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`;
}

// Biểu đồ cột 1 chuỗi (số học sinh mới/ngày) — không cần legend (chỉ 1 series),
// màu lấy từ --accent-2 của theme hiện có (đã qua validate contrast/chroma),
// có hover tooltip + <title> gốc SVG cho khả năng tiếp cận không cần chuột.
function DailyTrendChart({ data }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const width = 720;
  const height = 160;
  const paddingTop = 10;
  const paddingBottom = 22;
  const chartHeight = height - paddingTop - paddingBottom;
  const maxCount = Math.max(1, ...data.map((point) => point.count));
  const gap = 2;
  const barWidth = data.length ? width / data.length - gap : 0;
  // Giãn đều nhãn trục ngày, luôn hiện ngày cuối cùng — nhưng bỏ qua nhãn
  // theo chu kỳ nếu nó sẽ nằm sát ngay cạnh nhãn cuối (tránh 2 nhãn dính nhau).
  const maxLabels = 7;
  const labelStep = Math.max(1, Math.round((data.length - 1) / (maxLabels - 1)));
  const lastPeriodicIndex = Math.floor((data.length - 1) / labelStep) * labelStep;
  const lastIndex = data.length - 1;

  if (!data.length) {
    return null;
  }

  return (
    <div className="daily-trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Số học sinh mới mỗi ngày trong ${data.length} ngày gần nhất`}>
        <line x1={0} y1={paddingTop + chartHeight} x2={width} y2={paddingTop + chartHeight} className="daily-trend-chart__baseline" />
        {data.map((point, index) => {
          const barHeight = (point.count / maxCount) * chartHeight;
          const x = index * (barWidth + gap);
          const y = paddingTop + (chartHeight - barHeight);
          const isHovered = hoverIndex === index;
          const showLabel =
            index % labelStep === 0 || (index === lastIndex && lastPeriodicIndex !== lastIndex);

          return (
            <g key={point.date}>
              <rect
                x={x}
                y={paddingTop}
                width={Math.max(barWidth, 1)}
                height={chartHeight}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(index)}
                onMouseLeave={() => setHoverIndex((current) => (current === index ? null : current))}
              />
              {point.count > 0 ? (
                <path
                  d={topRoundedRectPath(x, y, Math.max(barWidth, 1), barHeight, 4)}
                  className={`daily-trend-chart__bar ${isHovered ? 'is-hovered' : ''}`}
                  pointerEvents="none"
                >
                  <title>{`${formatShortDate(point.date)}: ${point.count} học sinh mới`}</title>
                </path>
              ) : null}
              {showLabel ? (
                <text x={x + barWidth / 2} y={height - 6} textAnchor="middle" className="daily-trend-chart__axis-label">
                  {formatShortDate(point.date)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {hoverIndex !== null ? (
        <div
          className="daily-trend-chart__tooltip"
          style={{ left: `${((hoverIndex + 0.5) / data.length) * 100}%` }}
        >
          <strong>{data[hoverIndex].count} học sinh mới</strong>
          <span>{formatShortDate(data[hoverIndex].date)}</span>
        </div>
      ) : null}
    </div>
  );
}

export default function StudentProgressPage() {
  usePageTitle('Tiến độ học sinh');
  const auth = useAuth();
  const accessToken = auth.session?.access_token;
  const [searchParams] = useSearchParams();

  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [search, setSearch] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState(searchParams.get('course') || 'all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

  useEffect(() => {
    setSelectedCourseId(searchParams.get('course') || 'all');
  }, [searchParams]);

  async function loadRoster({ silent = false } = {}) {
    if (!silent) setLoading(true);
    const rows = await getStudentRoster({ accessToken });
    setRoster(rows);
    setLastUpdated(new Date());
    if (!silent) setLoading(false);
  }

  useEffect(() => {
    void loadRoster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // "Real-time" ở mức tự động làm mới định kỳ khi tab đang mở/hiển thị —
  // không dùng Supabase Realtime (chưa có hạ tầng này trong dự án).
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadRoster({ silent: true });
      }
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const courseOptions = useMemo(() => {
    const map = new Map();
    roster.forEach((row) => {
      if (row.courseId && !map.has(row.courseId)) {
        map.set(row.courseId, row.courseTitle);
      }
    });
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [roster]);

  const hasActiveFilters = Boolean(search || selectedCourseId !== 'all' || startDate || endDate);

  const filteredRoster = useMemo(
    () => filterStudentRoster(roster, { search, courseId: selectedCourseId, startDate, endDate }),
    [roster, search, selectedCourseId, startDate, endDate]
  );

  const rosterWithStatus = useMemo(
    () => filteredRoster.map((row) => ({ ...row, packageStatus: getPackageStatus(row) })),
    [filteredRoster]
  );

  const newStudentStats = useMemo(
    () => buildNewStudentStats(roster, { rangeStart, rangeEnd }),
    [roster, rangeStart, rangeEnd]
  );
  const dailyTrend = useMemo(() => buildDailySignupTrend(roster, TREND_DAYS), [roster]);

  // Đếm trên toàn bộ roster (không theo bộ lọc đang chọn) — đây là số việc
  // telesale cần xử lý, không phụ thuộc học sinh nào đang được xem trên bảng.
  const needsFollowUpCount = useMemo(
    () =>
      roster.filter((row) => {
        const status = getPackageStatus(row);
        return status === 'expiring_soon' || status === 'expired';
      }).length,
    [roster]
  );

  const pagination = usePagination(rosterWithStatus, {
    pageSize: 8,
    resetKey: `${search}|${selectedCourseId}|${startDate}|${endDate}|${rosterWithStatus.length}`
  });

  function clearFilters() {
    setSearch('');
    setSelectedCourseId('all');
    setStartDate('');
    setEndDate('');
  }

  return (
    <div className="page">
      <section className="dashboard-head">
        <div>
          <span className="eyebrow">Tiến độ học sinh</span>
          <h1>Theo dõi tiến độ học sinh</h1>
          <p>Học sinh mới, số buổi đã học/còn lại, và hạn gói cần gia hạn.</p>
        </div>
        {lastUpdated ? (
          <span className="student-progress-updated">
            Cập nhật lúc {lastUpdated.toLocaleTimeString('vi-VN')} · tự làm mới mỗi {REFRESH_INTERVAL_MS / 1000}s
          </span>
        ) : null}
      </section>

      <section className="stat-grid">
        <article className="stat-card stat-card--enterprise">
          <span>Học sinh mới hôm nay</span>
          <strong>{newStudentStats.today}</strong>
        </article>
        <article className="stat-card stat-card--enterprise">
          <span>7 ngày qua</span>
          <strong>{newStudentStats.last7Days}</strong>
        </article>
        <article className="stat-card stat-card--enterprise">
          <span>30 ngày qua</span>
          <strong>{newStudentStats.last30Days}</strong>
        </article>
        <article className="stat-card stat-card--enterprise">
          <span>Tháng này</span>
          <strong>{newStudentStats.thisMonth}</strong>
        </article>
        <article className="stat-card stat-card--enterprise">
          <span>Lũy kế toàn thời gian</span>
          <strong>{newStudentStats.cumulative}</strong>
        </article>
        <article className="stat-card stat-card--enterprise stat-card--warning">
          <span>Cần liên hệ gia hạn</span>
          <strong>{needsFollowUpCount}</strong>
        </article>
      </section>

      <section className="content-card content-card--enterprise student-trend-card">
        <div className="section-head">
          <div>
            <span className="eyebrow">Xu hướng</span>
            <h2>Học sinh mới theo ngày ({TREND_DAYS} ngày gần nhất)</h2>
          </div>
          <div className="student-range-picker">
            <label>
              <span>Từ ngày</span>
              <input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} />
            </label>
            <label>
              <span>Đến ngày</span>
              <input type="date" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} />
            </label>
            {newStudentStats.customRange !== null ? (
              <span className="pill">{newStudentStats.customRange} học sinh mới trong khoảng đã chọn</span>
            ) : null}
          </div>
        </div>
        <DailyTrendChart data={dailyTrend} />
      </section>

      <section className="content-card content-card--enterprise teacher-student-monitor">
        <div className="section-head">
          <div>
            <span className="eyebrow">Danh sách học sinh</span>
            <h2>Buổi đã học, còn lại và hạn gói</h2>
          </div>
          <button
            type="button"
            className="button-ghost"
            onClick={() => exportStudentRosterToExcel(rosterWithStatus)}
            disabled={!rosterWithStatus.length}
          >
            Xuất Excel
          </button>
        </div>

        <div className="student-filter-bar">
          <input
            type="search"
            className="student-filter-bar__search"
            placeholder="Tìm theo tên, SĐT hoặc email..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <label className="student-filter-bar__select">
            <span>Khóa học</span>
            <select value={selectedCourseId} onChange={(event) => setSelectedCourseId(event.target.value)}>
              <option value="all">Tất cả khóa</option>
              {courseOptions.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </label>
          <label className="student-filter-bar__date">
            <span>Từ ngày</span>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className="student-filter-bar__date">
            <span>Đến ngày</span>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
          {hasActiveFilters ? (
            <button type="button" className="button-ghost student-filter-bar__clear" onClick={clearFilters}>
              Xóa lọc
            </button>
          ) : null}
        </div>

        {loading ? <p>Đang tải danh sách học sinh...</p> : null}
        {!loading && roster.length === 0 ? (
          <p className="empty-state">Chưa có học sinh nào mua khóa học.</p>
        ) : null}
        {!loading && roster.length > 0 && rosterWithStatus.length === 0 ? (
          <p className="empty-state">Không tìm thấy học sinh phù hợp với bộ lọc hiện tại.</p>
        ) : null}

        {!loading && rosterWithStatus.length > 0 ? (
          <>
            <div className="teacher-student-table-wrap">
              <table className="teacher-student-table">
                <thead>
                  <tr>
                    <th>Học sinh</th>
                    <th>Khóa học</th>
                    <th>Ngày vào học</th>
                    <th>Buổi học</th>
                    <th>Hạn gói</th>
                  </tr>
                </thead>
                <tbody>
                  {pagination.pageItems.map((row) => (
                    <tr key={`${row.studentId}-${row.courseId}`}>
                      <td>
                        <strong>{row.fullName || 'Học sinh'}</strong>
                        <span>{row.phone}</span>
                        <span>{row.email}</span>
                      </td>
                      <td>{row.courseTitle}</td>
                      <td>{formatDate(row.enrolledAt)}</td>
                      <td>
                        {row.sessionsTotal === null || row.sessionsTotal === undefined ? (
                          <span>{row.sessionsUsed} buổi (không giới hạn)</span>
                        ) : (
                          <div className="teacher-progress-cell">
                            <div className="meter">
                              <span
                                style={{
                                  width: `${Math.min(100, Math.round((row.sessionsUsed / Math.max(1, row.sessionsTotal)) * 100))}%`
                                }}
                              />
                            </div>
                            <small>
                              {row.sessionsUsed}/{row.sessionsTotal} buổi · còn {row.sessionsRemaining}
                            </small>
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`package-status-badge package-status-badge--${row.packageStatus}`}>
                          {getPackageStatusLabel(row.packageStatus)}
                        </span>
                        {row.expiresAt ? <small>{formatDate(row.expiresAt)}</small> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls {...pagination} label="học sinh" />
          </>
        ) : null}
      </section>
    </div>
  );
}
