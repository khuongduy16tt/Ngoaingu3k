import { apiFetch } from './api';
import { isSupabaseReady } from './supabase';

const DAY_MS = 24 * 60 * 60 * 1000;
export const EXPIRING_SOON_DAYS = 14;

// ─── Legacy: tổng quan khóa học ở trang chủ giảng viên ───────────────────────
// DashboardPage.jsx dùng 2 hàm này cho widget "Khóa đã đăng / Hiệu quả trung
// bình" ở tổng quan — khác với trang Tiến độ học sinh (roster thật bên dưới).
// Giữ lại dữ liệu demo cũ vì widget đó chưa có nguồn dữ liệu thật để thay thế.
const legacyDemoCourseStudents = [
  { name: 'Minh Anh', email: 'minh.anh@ngoaingu3k.com', courseId: 'english-foundation', progress: 82, score: 91, lastActive: 'Hôm nay' },
  { name: 'Gia Huy', email: 'gia.huy@ngoaingu3k.com', courseId: 'english-foundation', progress: 64, score: 78, lastActive: 'Hôm qua' },
  { name: 'Linh Chi', email: 'linh.chi@ngoaingu3k.com', courseId: 'business-communication', progress: 48, score: 84, lastActive: '2 ngày trước' },
  { name: 'Quốc Bảo', email: 'quoc.bao@ngoaingu3k.com', courseId: 'business-communication', progress: 71, score: 88, lastActive: 'Hôm nay' },
  { name: 'Hoàng Nam', email: 'hoang.nam@ngoaingu3k.com', courseId: 'ielts-boost', progress: 35, score: 73, lastActive: '3 ngày trước' },
  { name: 'Thanh Trúc', email: 'thanh.truc@ngoaingu3k.com', courseId: 'ielts-boost', progress: 59, score: 86, lastActive: 'Hôm qua' }
];

export function average(values) {
  const validValues = values.filter((value) => Number.isFinite(Number(value)));
  if (!validValues.length) return 0;
  return Math.round(validValues.reduce((total, value) => total + Number(value), 0) / validValues.length);
}

export function buildStudentProgressRows(courses = []) {
  const courseLookup = new Map(courses.map((course) => [course.id, course]));

  return legacyDemoCourseStudents
    .filter((student) => courseLookup.has(student.courseId))
    .map((student) => ({
      ...student,
      courseTitle: courseLookup.get(student.courseId)?.title || 'Khóa học'
    }));
}

// ─── Demo fallback (khi chưa cấu hình Supabase / chưa đăng nhập) ─────────────
// Vài mốc thời gian rải rác để trang demo được đầy đủ trạng thái: học sinh
// mới hôm nay, gói sắp hết hạn, gói đã hết hạn, gói không giới hạn.
function buildDemoRoster() {
  const now = Date.now();
  const daysAgo = (days) => new Date(now - days * DAY_MS).toISOString();
  const daysAhead = (days) => new Date(now + days * DAY_MS).toISOString();

  return [
    {
      studentId: 'demo-1',
      fullName: 'Minh Anh',
      email: 'minh.anh@ngoaingu3k.com',
      phone: '0901234567',
      courseId: 'english-foundation',
      courseTitle: 'Tiếng Anh nền tảng',
      enrolledAt: daysAgo(0),
      firstEnrolledAt: daysAgo(0),
      sessionsTotal: 48,
      sessionsUsed: 3,
      sessionsRemaining: 45,
      expiresAt: daysAhead(179)
    },
    {
      studentId: 'demo-2',
      fullName: 'Gia Huy',
      email: 'gia.huy@ngoaingu3k.com',
      phone: '0912345678',
      courseId: 'english-foundation',
      courseTitle: 'Tiếng Anh nền tảng',
      enrolledAt: daysAgo(5),
      firstEnrolledAt: daysAgo(5),
      sessionsTotal: 48,
      sessionsUsed: 14,
      sessionsRemaining: 34,
      expiresAt: daysAhead(174)
    },
    {
      studentId: 'demo-3',
      fullName: 'Linh Chi',
      email: 'linh.chi@ngoaingu3k.com',
      phone: '0923456789',
      courseId: 'business-communication',
      courseTitle: 'Giao tiếp thương mại',
      enrolledAt: daysAgo(20),
      firstEnrolledAt: daysAgo(20),
      sessionsTotal: 24,
      sessionsUsed: 19,
      sessionsRemaining: 5,
      expiresAt: daysAhead(9)
    },
    {
      studentId: 'demo-4',
      fullName: 'Quốc Bảo',
      email: 'quoc.bao@ngoaingu3k.com',
      phone: '0934567890',
      courseId: 'business-communication',
      courseTitle: 'Giao tiếp thương mại',
      enrolledAt: daysAgo(210),
      firstEnrolledAt: daysAgo(210),
      sessionsTotal: 24,
      sessionsUsed: 24,
      sessionsRemaining: 0,
      expiresAt: daysAgo(30)
    },
    {
      studentId: 'demo-5',
      fullName: 'Hoàng Nam',
      email: 'hoang.nam@ngoaingu3k.com',
      phone: '0945678901',
      courseId: 'ielts-boost',
      courseTitle: 'IELTS Cấp tốc',
      enrolledAt: daysAgo(2),
      firstEnrolledAt: daysAgo(2),
      sessionsTotal: null,
      sessionsUsed: 6,
      sessionsRemaining: null,
      expiresAt: null
    },
    {
      studentId: 'demo-6',
      fullName: 'Thanh Trúc',
      email: 'thanh.truc@ngoaingu3k.com',
      phone: '0956789012',
      courseId: 'ielts-boost',
      courseTitle: 'IELTS Cấp tốc',
      enrolledAt: daysAgo(45),
      firstEnrolledAt: daysAgo(45),
      sessionsTotal: 60,
      sessionsUsed: 28,
      sessionsRemaining: 32,
      expiresAt: daysAhead(135)
    }
  ];
}

/**
 * Danh sách học sinh (đã mua ít nhất 1 khóa) kèm buổi đã học/còn lại + hạn
 * gói. Teacher chỉ thấy học sinh của khóa mình dạy, admin thấy toàn hệ
 * thống (do server quyết định theo role).
 */
export async function getStudentRoster({ accessToken } = {}) {
  if (!accessToken || accessToken === 'dev-token' || !isSupabaseReady()) {
    return buildDemoRoster();
  }

  try {
    const result = await apiFetch('/api/students/roster', { token: accessToken, timeoutMs: 10000 });
    return Array.isArray(result?.data) ? result.data : [];
  } catch (error) {
    console.warn('[getStudentRoster] Falling back to demo data:', error.message);
    return buildDemoRoster();
  }
}

// ─── Thời gian ────────────────────────────────────────────────────────────────

function startOfDay(date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

// Tuần bắt đầu từ Thứ 2 (quy ước phổ biến ở VN), không phải Chủ nhật.
function startOfWeek(date) {
  const normalized = startOfDay(date);
  const day = normalized.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  normalized.setDate(normalized.getDate() + diffToMonday);
  return normalized;
}

function startOfMonth(date) {
  const normalized = startOfDay(date);
  normalized.setDate(1);
  return normalized;
}

// Nhãn ngày YYYY-MM-DD theo lịch ĐỊA PHƯƠNG. Không dùng toISOString().slice(0,10)
// ở đây — nó quy đổi sang UTC trước, nên ở múi giờ UTC+7 (VN) một mốc nửa đêm
// địa phương có thể bị lùi về ngày hôm trước theo UTC, làm sai nhãn ngày.
function formatLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ─── Học sinh mới: real-time (auto-refresh) + lũy kế ─────────────────────────

// Một học sinh có thể xuất hiện nhiều dòng roster (nhiều khóa) — quy về 1
// bản ghi duy nhất mỗi học sinh, dùng mốc "vào học lần đầu" sớm nhất.
export function getUniqueStudents(rosterRows = []) {
  const byStudentId = new Map();

  rosterRows.forEach((row) => {
    if (!row.studentId) return;
    const existing = byStudentId.get(row.studentId);
    if (!existing || new Date(row.firstEnrolledAt) < new Date(existing.firstEnrolledAt)) {
      byStudentId.set(row.studentId, row);
    }
  });

  return Array.from(byStudentId.values());
}

/**
 * Thống kê học sinh mới: hôm nay / 7 ngày / 30 ngày / tháng này / lũy kế +
 * khoảng ngày tùy chọn. Gọi lại hàm này mỗi khi roster refetch (auto-refresh
 * định kỳ) để có số liệu gần-như-real-time mà không cần Supabase Realtime.
 */
export function buildNewStudentStats(rosterRows = [], { now = new Date(), rangeStart = '', rangeEnd = '' } = {}) {
  const uniqueStudents = getUniqueStudents(rosterRows);
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);

  function countSince(sinceDate) {
    const sinceTime = sinceDate.getTime();
    return uniqueStudents.filter((student) => new Date(student.firstEnrolledAt).getTime() >= sinceTime).length;
  }

  function countInRange(start, end) {
    const startTime = startOfDay(start).getTime();
    const endTime = startOfDay(end).getTime() + DAY_MS;
    return uniqueStudents.filter((student) => {
      const time = new Date(student.firstEnrolledAt).getTime();
      return time >= startTime && time < endTime;
    }).length;
  }

  return {
    today: countSince(todayStart),
    thisWeek: countSince(weekStart),
    last7Days: countSince(new Date(now.getTime() - 7 * DAY_MS)),
    last30Days: countSince(new Date(now.getTime() - 30 * DAY_MS)),
    thisMonth: countSince(monthStart),
    cumulative: uniqueStudents.length,
    customRange: rangeStart && rangeEnd ? countInRange(new Date(rangeStart), new Date(rangeEnd)) : null
  };
}

/**
 * Số học sinh mới theo từng ngày trong N ngày gần nhất — dữ liệu cho biểu đồ
 * xu hướng.
 */
export function buildDailySignupTrend(rosterRows = [], days = 30, now = new Date()) {
  const uniqueStudents = getUniqueStudents(rosterRows);
  const todayStart = startOfDay(now).getTime();

  const buckets = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const dayStart = todayStart - offset * DAY_MS;
    const dayEnd = dayStart + DAY_MS;
    const count = uniqueStudents.filter((student) => {
      const time = new Date(student.firstEnrolledAt).getTime();
      return time >= dayStart && time < dayEnd;
    }).length;
    buckets.push({ date: formatLocalDateKey(new Date(dayStart)), count });
  }

  return buckets;
}

// ─── Buổi học & hạn gói ───────────────────────────────────────────────────────

export function getSessionsLabel(row) {
  if (row.sessionsTotal === null || row.sessionsTotal === undefined) {
    return `${row.sessionsUsed} buổi (không giới hạn)`;
  }
  return `${row.sessionsUsed}/${row.sessionsTotal} buổi`;
}

/**
 * 'unlimited' | 'active' | 'expiring_soon' | 'expired'
 */
export function getPackageStatus(row, now = new Date()) {
  if (!row.expiresAt) {
    return 'unlimited';
  }

  const daysLeft = Math.ceil((new Date(row.expiresAt).getTime() - now.getTime()) / DAY_MS);
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= EXPIRING_SOON_DAYS) return 'expiring_soon';
  return 'active';
}

const PACKAGE_STATUS_LABELS = {
  unlimited: 'Không giới hạn',
  active: 'Còn hạn',
  expiring_soon: 'Sắp hết hạn',
  expired: 'Đã hết hạn'
};

export function getPackageStatusLabel(status) {
  return PACKAGE_STATUS_LABELS[status] || '';
}

// ─── Tìm kiếm & lọc ───────────────────────────────────────────────────────────

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .trim();
}

function normalizePhoneDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

/**
 * Lọc roster theo từ khóa (khớp SĐT/email/tên), khóa học, và khoảng ngày vào
 * học (enrolledAt).
 */
export function filterStudentRoster(rows = [], { search = '', courseId = 'all', startDate = '', endDate = '' } = {}) {
  const normalizedSearch = normalizeSearchText(search);
  const searchPhoneDigits = normalizePhoneDigits(search);
  const startTime = startDate ? startOfDay(new Date(startDate)).getTime() : null;
  const endTime = endDate ? startOfDay(new Date(endDate)).getTime() + DAY_MS : null;

  return rows.filter((row) => {
    if (courseId !== 'all' && row.courseId !== courseId) {
      return false;
    }

    if (normalizedSearch) {
      const matchesName = normalizeSearchText(row.fullName).includes(normalizedSearch);
      const matchesEmail = normalizeSearchText(row.email).includes(normalizedSearch);
      const matchesPhone = Boolean(searchPhoneDigits) && normalizePhoneDigits(row.phone).includes(searchPhoneDigits);
      if (!matchesName && !matchesEmail && !matchesPhone) {
        return false;
      }
    }

    const enrolledAtTime = new Date(row.enrolledAt).getTime();
    if (startTime !== null && enrolledAtTime < startTime) {
      return false;
    }
    if (endTime !== null && enrolledAtTime >= endTime) {
      return false;
    }

    return true;
  });
}
