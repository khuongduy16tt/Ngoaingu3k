import { isSupabaseReady, supabase } from './supabase';

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

function normalizeProgressRow(row) {
  return {
    lessonId: row.lesson_id || row.lessonId,
    completed: Boolean(row.completed),
    lastPositionSeconds: Number(row.last_position_seconds || row.lastPositionSeconds || 0),
    updatedAt: row.updated_at || row.updatedAt || ''
  };
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

  const { data, error } = await supabase
    .from('progress')
    .select('lesson_id, completed, last_position_seconds, updated_at')
    .eq('user_id', studentId)
    .in('lesson_id', lessonIds);

  if (error) {
    return storedProgress;
  }

  const lessonByDatabaseId = new Map(
    lessons.filter((lesson) => lesson.databaseId).map((lesson) => [lesson.databaseId, lesson.id])
  );

  return (data || []).reduce(
    (progressMap, row) => {
      const progress = normalizeProgressRow(row);
      const localLessonId = lessonByDatabaseId.get(progress.lessonId);
      if (!localLessonId) return progressMap;

      return {
        ...progressMap,
        [localLessonId]: {
          completed: progress.completed,
          lastPositionSeconds: progress.lastPositionSeconds,
          updatedAt: progress.updatedAt
        }
      };
    },
    { ...storedProgress }
  );
}

export async function saveLessonProgress({
  studentId,
  studentEmail,
  courseKey,
  lesson,
  completed = true,
  lastPositionSeconds = 0
}) {
  const studentKey = studentId || studentEmail || 'local';
  const submittedAt = new Date().toISOString();
  const storedProgress = readStoredProgress(studentKey, courseKey);
  const nextProgress = {
    ...storedProgress,
    [lesson.id]: {
      completed,
      lastPositionSeconds,
      updatedAt: submittedAt
    }
  };

  writeStoredProgress(studentKey, courseKey, nextProgress);

  if (!isSupabaseReady() || !studentId || !lesson.databaseId) {
    return nextProgress[lesson.id];
  }

  await supabase
    .from('progress')
    .upsert(
      {
        user_id: studentId,
        lesson_id: lesson.databaseId,
        completed,
        last_position_seconds: lastPositionSeconds,
        updated_at: submittedAt
      },
      { onConflict: 'user_id,lesson_id' }
    );

  return nextProgress[lesson.id];
}
