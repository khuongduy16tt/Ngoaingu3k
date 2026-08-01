import { isSupabaseReady, supabase } from './supabase';

// Điểm bài tập của bài học được lưu kèm tiến độ để danh sách bài học tính sao.
// Cột score/max_score do supabase/progress-score-migration.sql thêm vào; nếu
// project chưa chạy migration thì mọi truy vấn tự động rơi về bộ cột cũ và điểm
// chỉ còn nằm ở localStorage.
const PROGRESS_COLUMNS = 'lesson_id, completed, last_position_seconds, updated_at';
const PROGRESS_COLUMNS_WITH_SCORE = 'lesson_id, completed, last_position_seconds, score, max_score, updated_at';

function getStorageKey(studentKey, courseKey) {
  return `learning-lesson-progress:${studentKey || 'local'}:${courseKey || 'course'}`;
}

function readStoredProgress(studentKey, courseKey) {
  try {
    const rawValue = localStorage.getItem(getStorageKey(studentKey, courseKey));
    return rawValue ? JSON.parse(rawValue) : {};
  } catch {
    return {};
  }
}

function writeStoredProgress(studentKey, courseKey, progressMap) {
  try {
    localStorage.setItem(getStorageKey(studentKey, courseKey), JSON.stringify(progressMap));
  } catch {
    // ignore storage failures
  }
}

function isMissingScoreColumn(error) {
  return error?.code === '42703' || /score/i.test(error?.message || '');
}

function normalizeScore(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && value !== null && value !== undefined ? numericValue : null;
}

function normalizeProgressRow(row) {
  return {
    lessonId: row.lesson_id || row.lessonId,
    completed: Boolean(row.completed),
    lastPositionSeconds: Number(row.last_position_seconds || row.lastPositionSeconds || 0),
    score: normalizeScore(row.score),
    maxScore: normalizeScore(row.max_score ?? row.maxScore),
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

async function fetchProgressRows(studentId, lessonIds) {
  function runQuery(columns) {
    return supabase.from('progress').select(columns).eq('user_id', studentId).in('lesson_id', lessonIds);
  }

  const withScore = await runQuery(PROGRESS_COLUMNS_WITH_SCORE);
  if (!withScore.error) {
    return withScore.data || [];
  }

  if (!isMissingScoreColumn(withScore.error)) {
    return null;
  }

  const withoutScore = await runQuery(PROGRESS_COLUMNS);
  return withoutScore.error ? null : withoutScore.data || [];
}

export async function getLessonProgress({ studentId, studentEmail, courseKey, lessons = [] }) {
  const studentKey = studentId || studentEmail || 'local';
  const storedProgress = readStoredProgress(studentKey, courseKey);

  if (!isSupabaseReady() || !studentId) {
    return storedProgress;
  }

  const lessonIds = lessons.map((lesson) => lesson.databaseId).filter(Boolean);
  if (!lessonIds.length) {
    return storedProgress;
  }

  const rows = await fetchProgressRows(studentId, lessonIds);
  if (!rows) {
    return storedProgress;
  }

  const lessonByDatabaseId = new Map(
    lessons.filter((lesson) => lesson.databaseId).map((lesson) => [lesson.databaseId, lesson.id])
  );

  return rows.reduce(
    (progressMap, row) => {
      const progress = normalizeProgressRow(row);
      const localLessonId = lessonByDatabaseId.get(progress.lessonId);
      if (!localLessonId) return progressMap;

      const storedRecord = storedProgress[localLessonId];

      return {
        ...progressMap,
        [localLessonId]: {
          completed: progress.completed,
          lastPositionSeconds: progress.lastPositionSeconds,
          // Điểm ở máy được giữ lại khi Supabase chưa có cột điểm (hoặc chưa
          // đồng bộ) để sao không bị mất sau khi tải lại trang.
          score: progress.score ?? normalizeScore(storedRecord?.score),
          maxScore: progress.maxScore ?? normalizeScore(storedRecord?.maxScore),
          updatedAt: progress.updatedAt
        }
      };
    },
    { ...storedProgress }
  );
}

// Bảng điều khiển học viên cần toàn bộ tiến độ của một người, không giới hạn
// theo một khóa như getLessonProgress. RLS "users manage own progress" đã chặn
// sẵn nên truy vấn này chỉ trả về dòng của chính người đang đăng nhập.
export async function getAllLessonProgress({ studentId, studentEmail } = {}) {
  if (!isSupabaseReady() || !studentId || String(studentId).startsWith('local-')) {
    return readAllStoredProgress(studentId || studentEmail);
  }

  function runQuery(columns) {
    return supabase.from('progress').select(columns).eq('user_id', studentId);
  }

  const withScore = await runQuery(PROGRESS_COLUMNS_WITH_SCORE);
  if (!withScore.error) {
    return (withScore.data || []).map(normalizeProgressRow);
  }

  if (!isMissingScoreColumn(withScore.error)) {
    console.warn('[getAllLessonProgress]', withScore.error.message);
    return readAllStoredProgress(studentId || studentEmail);
  }

  const withoutScore = await runQuery(PROGRESS_COLUMNS);
  if (withoutScore.error) {
    return readAllStoredProgress(studentId || studentEmail);
  }

  return (withoutScore.data || []).map(normalizeProgressRow);
}

// Chế độ chạy không có Supabase: gom tiến độ đã lưu ở máy của mọi khóa lại.
function readAllStoredProgress(studentKey) {
  const prefix = `learning-lesson-progress:${studentKey || 'local'}:`;
  const rows = [];

  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(prefix)) continue;

      const parsed = JSON.parse(localStorage.getItem(key) || '{}');
      for (const record of Object.values(parsed)) {
        rows.push({
          lessonId: '',
          completed: Boolean(record?.completed),
          lastPositionSeconds: Number(record?.lastPositionSeconds || 0),
          score: normalizeScore(record?.score),
          maxScore: normalizeScore(record?.maxScore),
          updatedAt: record?.updatedAt || ''
        });
      }
    }
  } catch {
    return rows;
  }

  return rows;
}

export async function saveLessonProgress({
  studentId,
  studentEmail,
  courseKey,
  lesson,
  completed = true,
  lastPositionSeconds = 0,
  score,
  maxScore
}) {
  const studentKey = studentId || studentEmail || 'local';
  const submittedAt = new Date().toISOString();
  const storedProgress = readStoredProgress(studentKey, courseKey);
  const previousRecord = storedProgress[lesson.id];
  // Không truyền điểm (bấm "đánh dấu hoàn thành", xem hết video...) thì giữ
  // nguyên điểm bài tập đã nộp trước đó.
  const nextScore = normalizeScore(score) ?? normalizeScore(previousRecord?.score);
  const nextMaxScore = normalizeScore(maxScore) ?? normalizeScore(previousRecord?.maxScore);
  const nextProgress = {
    ...storedProgress,
    [lesson.id]: {
      completed,
      lastPositionSeconds,
      score: nextScore,
      maxScore: nextMaxScore,
      updatedAt: submittedAt
    }
  };

  writeStoredProgress(studentKey, courseKey, nextProgress);

  if (!isSupabaseReady() || !studentId || !lesson.databaseId) {
    return nextProgress[lesson.id];
  }

  const basePayload = {
    user_id: studentId,
    lesson_id: lesson.databaseId,
    completed,
    last_position_seconds: lastPositionSeconds,
    updated_at: submittedAt
  };

  const { error } = await supabase
    .from('progress')
    .upsert({ ...basePayload, score: nextScore, max_score: nextMaxScore }, { onConflict: 'user_id,lesson_id' });

  if (error && isMissingScoreColumn(error)) {
    await supabase.from('progress').upsert(basePayload, { onConflict: 'user_id,lesson_id' });
  }

  return nextProgress[lesson.id];
}
