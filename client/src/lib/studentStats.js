// Hai chỉ số của bảng điều khiển học viên: điểm trung bình và chuỗi ngày học.
//
// Tách riêng phần tính để test được mà không phải dựng cả trang dashboard, và
// để hai nguồn điểm (bài tập trong bài học, bài thi) dùng chung một luật cộng.

/**
 * Điểm trung bình tính theo TỔNG điểm trên TỔNG điểm tối đa, không phải trung
 * bình cộng của từng tỉ lệ. Bài 20 câu và bài 2 câu không thể cùng trọng số.
 *
 * @param {Array<{score: number, maxScore: number}>} entries
 * @returns {number|null} phần trăm đã làm tròn, null khi chưa có bài nào chấm điểm
 */
export function calculateAverageScore(entries = []) {
  let totalScore = 0;
  let totalMaxScore = 0;

  for (const entry of Array.isArray(entries) ? entries : []) {
    const maxScore = Number(entry?.maxScore);
    // maxScore = 0 là bài chưa chấm điểm (video, mục lục), bỏ qua chứ không
    // tính thành 0 điểm — nếu không học viên xem video sẽ bị tụt điểm.
    if (!Number.isFinite(maxScore) || maxScore <= 0) continue;

    const score = Number(entry?.score);
    if (!Number.isFinite(score)) continue;

    totalScore += Math.min(Math.max(score, 0), maxScore);
    totalMaxScore += maxScore;
  }

  if (!totalMaxScore) return null;

  return Math.round((totalScore / totalMaxScore) * 100);
}

function getDayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Lùi ngày bằng constructor thay vì trừ 86400000 mili giây: ngày đổi giờ mùa
// hè dài 23 hoặc 25 tiếng, trừ theo mili giây sẽ nhảy sai một ngày.
function addDays(date, amount) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

/**
 * Số ngày học liên tiếp tính tới hôm nay.
 *
 * Hôm nay chưa học thì chuỗi vẫn được tính tới hết hôm qua — chuỗi chỉ đứt khi
 * đã bỏ trọn một ngày. Nếu tính cứng từ hôm nay thì ai mở bảng điều khiển vào
 * buổi sáng trước khi học đều thấy chuỗi về 0.
 *
 * @param {Array<string|Date>} timestamps thời điểm có hoạt động học
 * @param {Date} [now]
 * @returns {number}
 */
export function calculateStreakDays(timestamps = [], now = new Date()) {
  const activeDays = new Set();

  for (const value of Array.isArray(timestamps) ? timestamps : []) {
    if (!value) continue;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) continue;
    activeDays.add(getDayKey(date));
  }

  if (!activeDays.size) return 0;

  let cursor = startOfDay(now);
  if (!activeDays.has(getDayKey(cursor))) {
    cursor = addDays(cursor, -1);
    if (!activeDays.has(getDayKey(cursor))) return 0;
  }

  let streak = 0;
  while (activeDays.has(getDayKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

/**
 * Gộp tiến độ bài học và bài thi thành hai chỉ số của bảng điều khiển.
 *
 * @param {{lessonProgress?: Array, examAttempts?: Array}} sources
 * @param {Date} [now]
 * @returns {{averageScore: number|null, streakDays: number}}
 */
export function buildStudentStats({ lessonProgress = [], examAttempts = [] } = {}, now = new Date()) {
  const scored = [
    ...lessonProgress.map((row) => ({ score: row?.score, maxScore: row?.maxScore })),
    ...examAttempts.map((row) => ({ score: row?.score, maxScore: row?.maxScore }))
  ];

  const timestamps = [
    ...lessonProgress.map((row) => row?.updatedAt),
    ...examAttempts.map((row) => row?.submittedAt)
  ];

  return {
    averageScore: calculateAverageScore(scored),
    streakDays: calculateStreakDays(timestamps, now)
  };
}
