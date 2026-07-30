// Sao và cúp của danh sách bài học.
//
// Sao của một bài = điểm bài tập đã nộp của bài đó (lưu trong progress:
// score/maxScore). Bài không có câu hỏi chấm điểm (video, mục lục, bài đọc)
// chỉ cần hoàn thành là đủ sao — nếu không thì học viên sẽ thấy bài trống điểm
// giống bài làm sai.
//
// Cúp của một chương = tổng sao của chương so với tổng sao tối đa.

export const MAX_LESSON_STARS = 3;
export const MAX_SECTION_TROPHIES = 3;

export function isLessonComplete(lesson, progressMap = {}) {
  return Boolean(progressMap?.[lesson?.id]?.completed || lesson?.status === 'done');
}

// Trả về null khi bài chưa có điểm để phân biệt "chưa chấm" với "được 0 điểm".
function getScoreRatio(progressRecord) {
  const maxScore = Number(progressRecord?.maxScore ?? progressRecord?.max_score ?? 0);
  if (!Number.isFinite(maxScore) || maxScore <= 0) {
    return null;
  }

  const score = Number(progressRecord?.score ?? progressRecord?.score_value ?? 0);
  if (!Number.isFinite(score)) {
    return null;
  }

  return Math.min(Math.max(score / maxScore, 0), 1);
}

export function getLessonStars(lesson, progressMap = {}) {
  if (!isLessonComplete(lesson, progressMap)) {
    return 0;
  }

  const ratio = getScoreRatio(progressMap?.[lesson?.id]);
  if (ratio === null) {
    return MAX_LESSON_STARS;
  }

  if (ratio >= 0.8) return 3;
  if (ratio >= 0.5) return 2;
  return 1;
}

export function getSectionStars(section, progressMap = {}) {
  const lessons = Array.isArray(section?.lessons) ? section.lessons : [];

  return {
    earned: lessons.reduce((total, lesson) => total + getLessonStars(lesson, progressMap), 0),
    max: lessons.length * MAX_LESSON_STARS
  };
}

export function getSectionTrophies({ earned = 0, max = 0 } = {}) {
  if (!max || earned <= 0) {
    return 0;
  }

  const ratio = earned / max;
  if (ratio >= 0.9) return 3;
  if (ratio >= 0.6) return 2;
  return 1;
}

export function countCompletedLessons(sections = [], progressMap = {}) {
  return (Array.isArray(sections) ? sections : []).reduce(
    (total, section) =>
      total + (Array.isArray(section?.lessons) ? section.lessons : []).filter((lesson) => isLessonComplete(lesson, progressMap)).length,
    0
  );
}

export function countLessons(sections = []) {
  return (Array.isArray(sections) ? sections : []).reduce(
    (total, section) => total + (Array.isArray(section?.lessons) ? section.lessons.length : 0),
    0
  );
}
