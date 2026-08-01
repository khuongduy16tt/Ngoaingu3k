import { describe, expect, it } from 'vitest';
import { buildStudentStats, calculateAverageScore, calculateStreakDays } from './studentStats';

describe('calculateAverageScore', () => {
  it('cộng theo tổng điểm chứ không lấy trung bình của từng tỉ lệ', () => {
    // Bài 20 câu đúng 10 (50%) và bài 2 câu đúng 2 (100%): trung bình cộng tỉ lệ
    // sẽ ra 75%, nhưng đúng phải là 12/22 = 55%.
    expect(
      calculateAverageScore([
        { score: 10, maxScore: 20 },
        { score: 2, maxScore: 2 }
      ])
    ).toBe(55);
  });

  it('bỏ qua bài không chấm điểm thay vì tính thành 0', () => {
    expect(
      calculateAverageScore([
        { score: 8, maxScore: 10 },
        { score: 0, maxScore: 0 },
        { score: null, maxScore: null }
      ])
    ).toBe(80);
  });

  it('trả về null khi chưa có bài nào được chấm', () => {
    expect(calculateAverageScore([])).toBeNull();
    expect(calculateAverageScore([{ score: 0, maxScore: 0 }])).toBeNull();
  });

  it('chặn điểm vượt khung và điểm âm', () => {
    expect(calculateAverageScore([{ score: 15, maxScore: 10 }])).toBe(100);
    expect(calculateAverageScore([{ score: -5, maxScore: 10 }])).toBe(0);
  });
});

describe('calculateStreakDays', () => {
  const now = new Date(2026, 7, 1, 9, 0, 0); // 01/08/2026

  it('đếm các ngày liên tiếp tính tới hôm nay', () => {
    const days = [new Date(2026, 7, 1), new Date(2026, 6, 31), new Date(2026, 6, 30)];
    expect(calculateStreakDays(days, now)).toBe(3);
  });

  it('hôm nay chưa học nhưng hôm qua có thì chuỗi vẫn được tính', () => {
    const days = [new Date(2026, 6, 31), new Date(2026, 6, 30)];
    expect(calculateStreakDays(days, now)).toBe(2);
  });

  it('bỏ trọn một ngày thì chuỗi đứt', () => {
    const days = [new Date(2026, 6, 30), new Date(2026, 6, 29)];
    expect(calculateStreakDays(days, now)).toBe(0);
  });

  it('nhiều lần học trong cùng một ngày chỉ tính một', () => {
    const days = [new Date(2026, 7, 1, 8), new Date(2026, 7, 1, 20), new Date(2026, 6, 31, 7)];
    expect(calculateStreakDays(days, now)).toBe(2);
  });

  it('bỏ qua giá trị rỗng hoặc không phải ngày', () => {
    expect(calculateStreakDays(['', null, 'không phải ngày'], now)).toBe(0);
  });
});

describe('buildStudentStats', () => {
  const now = new Date(2026, 7, 1, 9, 0, 0);

  it('gộp cả điểm bài học lẫn điểm bài thi', () => {
    const stats = buildStudentStats(
      {
        lessonProgress: [{ score: 8, maxScore: 10, updatedAt: new Date(2026, 7, 1).toISOString() }],
        examAttempts: [{ score: 6, maxScore: 10, submittedAt: new Date(2026, 6, 31).toISOString() }]
      },
      now
    );

    expect(stats).toEqual({ averageScore: 70, streakDays: 2 });
  });

  it('học viên chưa có dữ liệu thì trả về null và 0', () => {
    expect(buildStudentStats({}, now)).toEqual({ averageScore: null, streakDays: 0 });
  });
});
