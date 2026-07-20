import { describe, expect, it } from 'vitest';

import {
  buildDailySignupTrend,
  buildNewStudentStats,
  EXPIRING_SOON_DAYS,
  filterStudentRoster,
  getPackageStatus,
  getUniqueStudents
} from './studentProgressService';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-07-20T12:00:00.000Z');
const daysAgo = (days) => new Date(NOW.getTime() - days * DAY_MS).toISOString();
const daysAhead = (days) => new Date(NOW.getTime() + days * DAY_MS).toISOString();

// Nhãn ngày theo lịch địa phương của máy chạy test — không dùng
// toISOString().slice(0,10) vì đó là ngày theo UTC, có thể lệch 1 ngày so với
// lịch địa phương (đúng là bug mà buildDailySignupTrend từng mắc phải).
function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const roster = [
  // Học sinh A: mua 2 khóa, mốc "vào học đầu tiên" phải lấy khóa cũ hơn (10 ngày trước).
  {
    studentId: 'A',
    fullName: 'Học sinh A',
    email: 'a@example.com',
    phone: '0900000001',
    courseId: 'c1',
    courseTitle: 'Khóa 1',
    enrolledAt: daysAgo(2),
    firstEnrolledAt: daysAgo(10),
    sessionsTotal: 20,
    sessionsUsed: 5,
    sessionsRemaining: 15,
    expiresAt: daysAhead(5) // trong ngưỡng sắp hết hạn
  },
  {
    studentId: 'A',
    fullName: 'Học sinh A',
    email: 'a@example.com',
    phone: '0900000001',
    courseId: 'c2',
    courseTitle: 'Khóa 2',
    enrolledAt: daysAgo(10),
    firstEnrolledAt: daysAgo(10),
    sessionsTotal: 10,
    sessionsUsed: 10,
    sessionsRemaining: 0,
    expiresAt: daysAgo(1) // đã hết hạn
  },
  // Học sinh B: mới hôm nay, gói không giới hạn.
  {
    studentId: 'B',
    fullName: 'Học sinh B',
    email: 'b@example.com',
    phone: '0900000002',
    courseId: 'c1',
    courseTitle: 'Khóa 1',
    enrolledAt: daysAgo(0),
    firstEnrolledAt: daysAgo(0),
    sessionsTotal: null,
    sessionsUsed: 1,
    sessionsRemaining: null,
    expiresAt: null
  },
  // Học sinh C: vào học 40 ngày trước (ngoài mốc 30 ngày), gói còn hạn dài.
  {
    studentId: 'C',
    fullName: 'Học sinh C',
    email: 'c@example.com',
    phone: '0900000003',
    courseId: 'c2',
    courseTitle: 'Khóa 2',
    enrolledAt: daysAgo(40),
    firstEnrolledAt: daysAgo(40),
    sessionsTotal: 30,
    sessionsUsed: 10,
    sessionsRemaining: 20,
    expiresAt: daysAhead(100)
  }
];

describe('getUniqueStudents', () => {
  it('gộp học sinh mua nhiều khóa về 1 dòng, lấy mốc vào học sớm nhất', () => {
    const unique = getUniqueStudents(roster);
    expect(unique).toHaveLength(3);

    const studentA = unique.find((s) => s.studentId === 'A');
    expect(studentA.firstEnrolledAt).toBe(daysAgo(10));
  });
});

describe('buildNewStudentStats', () => {
  it('đếm học sinh mới theo hôm nay / 7 ngày / 30 ngày / lũy kế', () => {
    const stats = buildNewStudentStats(roster, { now: NOW });

    expect(stats.today).toBe(1); // chỉ B
    expect(stats.last7Days).toBe(1); // chỉ B (A vào học 10 ngày trước, ngoài 7 ngày)
    expect(stats.last30Days).toBe(2); // A + B
    expect(stats.cumulative).toBe(3); // A + B + C
  });

  it('đếm theo khoảng ngày tùy chọn (rangeStart/rangeEnd)', () => {
    const stats = buildNewStudentStats(roster, {
      now: NOW,
      rangeStart: daysAgo(11),
      rangeEnd: daysAgo(9)
    });

    expect(stats.customRange).toBe(1); // chỉ A (vào học 10 ngày trước)
  });

  it('customRange là null khi không truyền khoảng ngày', () => {
    const stats = buildNewStudentStats(roster, { now: NOW });
    expect(stats.customRange).toBeNull();
  });
});

describe('buildDailySignupTrend', () => {
  it('trả về đúng số ngày yêu cầu, ngày cuối cùng là hôm nay', () => {
    const trend = buildDailySignupTrend(roster, 7, NOW);
    expect(trend).toHaveLength(7);
    expect(trend[trend.length - 1].date).toBe(localDateKey(NOW));
    expect(trend[trend.length - 1].count).toBe(1); // học sinh B vào học hôm nay
  });
});

describe('getPackageStatus', () => {
  it('phân loại đúng unlimited/active/expiring_soon/expired', () => {
    expect(getPackageStatus(roster[2], NOW)).toBe('unlimited'); // B
    expect(getPackageStatus(roster[3], NOW)).toBe('active'); // C, còn 100 ngày
    expect(getPackageStatus(roster[0], NOW)).toBe('expiring_soon'); // A/c1, còn 5 ngày <= 14
    expect(getPackageStatus(roster[1], NOW)).toBe('expired'); // A/c2, hết hạn hôm qua
  });

  it('ngưỡng sắp hết hạn đúng bằng EXPIRING_SOON_DAYS', () => {
    const row = { expiresAt: daysAhead(EXPIRING_SOON_DAYS) };
    expect(getPackageStatus(row, NOW)).toBe('expiring_soon');

    const rowJustOutside = { expiresAt: daysAhead(EXPIRING_SOON_DAYS + 1) };
    expect(getPackageStatus(rowJustOutside, NOW)).toBe('active');
  });
});

describe('filterStudentRoster', () => {
  it('lọc theo số điện thoại (bỏ qua ký tự không phải số)', () => {
    const result = filterStudentRoster(roster, { search: '0900000002' });
    expect(result.map((r) => r.studentId)).toEqual(['B']);
  });

  it('lọc theo email', () => {
    const result = filterStudentRoster(roster, { search: 'c@example.com' });
    expect(result.every((r) => r.studentId === 'C')).toBe(true);
  });

  it('lọc theo khóa học', () => {
    const result = filterStudentRoster(roster, { courseId: 'c2' });
    expect(result.map((r) => r.studentId).sort()).toEqual(['A', 'C']);
  });

  it('lọc theo khoảng ngày enrolledAt', () => {
    const result = filterStudentRoster(roster, {
      startDate: daysAgo(3).slice(0, 10),
      endDate: daysAgo(0).slice(0, 10)
    });
    // enrolledAt trong khoảng: A/c1 (2 ngày trước), B (hôm nay)
    expect(result.map((r) => r.studentId).sort()).toEqual(['A', 'B']);
  });

  it('kết hợp nhiều điều kiện lọc cùng lúc', () => {
    const result = filterStudentRoster(roster, { search: 'Học sinh A', courseId: 'c1' });
    expect(result).toHaveLength(1);
    expect(result[0].courseId).toBe('c1');
  });
});
