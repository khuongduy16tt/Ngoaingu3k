import { isSupabaseReady, supabase } from './supabase';
import { normalizeFlashcards } from './flashcardParser';

// Bộ thẻ flashcard gắn theo khóa học. Chỉ giảng viên phụ trách khóa (và admin)
// tạo/sửa/nhập được — chặn ở cả RLS (supabase/schema.sql) lẫn UI.
//
// Không có Supabase thì rơi về localStorage để chạy được ở chế độ mock, giống
// examService.

export const MOCK_FLASHCARD_SETS_STORAGE_KEY = 'ngoaingu3k-mock-flashcard-sets';
export const MOCK_FLASHCARD_PROGRESS_STORAGE_KEY = 'ngoaingu3k-mock-flashcard-progress';

// `courses.id` ở client là SLUG (xem normalizeCourse), còn khóa ngoại
// flashcard_sets.course_id là UUID của bảng courses — phải dùng `databaseId`.
// Lọc trước khi query để một slug lọt vào không làm Postgres ném lỗi kiểu.
function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}

export function normalizeFlashcardSet(set, index = 0) {
  return {
    id: String(set?.id || `set-${index + 1}`),
    courseId: set?.courseId || set?.course_id || '',
    courseTitle: set?.courseTitle || set?.course_title || '',
    title: String(set?.title || 'Bộ thẻ chưa đặt tên').trim(),
    description: String(set?.description || '').trim(),
    createdBy: set?.createdBy || set?.created_by || '',
    createdAt: set?.createdAt || set?.created_at || '',
    updatedAt: set?.updatedAt || set?.updated_at || '',
    cards: normalizeFlashcards(set?.cards || set?.flashcards || [])
  };
}

// ─── Local (mock) storage ─────────────────────────────────────────────────────

function readMockSets() {
  try {
    return JSON.parse(localStorage.getItem(MOCK_FLASHCARD_SETS_STORAGE_KEY) || '[]') || [];
  } catch {
    return [];
  }
}

function writeMockSets(sets = []) {
  try {
    localStorage.setItem(MOCK_FLASHCARD_SETS_STORAGE_KEY, JSON.stringify(sets));
    window.dispatchEvent(new CustomEvent('flashcard-sets-updated', { detail: { sets } }));
  } catch {
    // ignore storage failures
  }
}

// ─── Đọc ──────────────────────────────────────────────────────────────────────

/**
 * Bộ thẻ của những khóa mà người dùng được xem.
 * `courseIds` là khóa học viên sở hữu; giảng viên truyền khóa mình phụ trách.
 */
export async function getFlashcardSets({ courseIds = [] } = {}) {
  const allowed = (Array.isArray(courseIds) ? courseIds : []).map(String).filter(Boolean);

  if (!isSupabaseReady()) {
    const sets = readMockSets().map(normalizeFlashcardSet);
    return allowed.length ? sets.filter((set) => allowed.includes(String(set.courseId))) : sets;
  }

  const allowedUuids = allowed.filter(isUuid);

  // Có truyền khóa nhưng không khóa nào là UUID -> không có gì hợp lệ để lọc;
  // trả rỗng thay vì bỏ điều kiện lọc và lộ bộ thẻ của khóa khác.
  if (allowed.length && !allowedUuids.length) {
    return [];
  }

  let query = supabase
    .from('flashcard_sets')
    .select('id, course_id, title, description, created_by, created_at, updated_at, courses(title)')
    .order('created_at', { ascending: false });

  if (allowedUuids.length) {
    query = query.in('course_id', allowedUuids);
  }

  const { data, error } = await query;

  if (error) {
    console.warn('[getFlashcardSets]', error.message);
    return [];
  }

  return (data || []).map((row, index) =>
    normalizeFlashcardSet({ ...row, courseTitle: row.courses?.title }, index)
  );
}

export async function getFlashcardSetById(setId) {
  if (!setId) {
    return null;
  }

  if (!isSupabaseReady()) {
    const found = readMockSets().find((set) => String(set.id) === String(setId));
    return found ? normalizeFlashcardSet(found) : null;
  }

  const { data, error } = await supabase
    .from('flashcard_sets')
    .select('id, course_id, title, description, created_by, created_at, updated_at, courses(title), flashcards(id, term, definition, position)')
    .eq('id', setId)
    .maybeSingle();

  if (error) {
    console.warn('[getFlashcardSetById]', error.message);
    return null;
  }

  if (!data) {
    return null;
  }

  const cards = [...(data.flashcards || [])].sort((left, right) => left.position - right.position);
  return normalizeFlashcardSet({ ...data, courseTitle: data.courses?.title, cards });
}

// ─── Ghi (chỉ giảng viên / admin) ─────────────────────────────────────────────

/**
 * Tạo mới hoặc ghi đè một bộ thẻ. `cards` thay toàn bộ danh sách thẻ cũ — đây là
 * luồng "nhập lại từ text dán vào", không phải sửa từng thẻ.
 */
export async function saveFlashcardSet({ setId, courseId, title, description = '', cards = [], userId } = {}) {
  const normalizedCards = normalizeFlashcards(cards);

  if (!courseId) {
    throw new Error('Hãy chọn khóa học cho bộ thẻ.');
  }

  if (!String(title || '').trim()) {
    throw new Error('Hãy đặt tên cho bộ thẻ.');
  }

  if (!normalizedCards.length) {
    throw new Error('Bộ thẻ cần có ít nhất một thẻ.');
  }

  if (!isSupabaseReady()) {
    const sets = readMockSets();
    const id = setId || `mock-flashcard-set-${Date.now()}`;
    const now = new Date().toISOString();
    const existing = sets.find((set) => String(set.id) === String(id));
    const record = {
      ...(existing || {}),
      id,
      course_id: courseId,
      title,
      description,
      created_by: userId || existing?.created_by || 'local',
      created_at: existing?.created_at || now,
      updated_at: now,
      cards: normalizedCards
    };

    writeMockSets([record, ...sets.filter((set) => String(set.id) !== String(id))]);
    return normalizeFlashcardSet(record);
  }

  if (!isUuid(courseId)) {
    throw new Error(
      'Khóa học chưa được đồng bộ Supabase nên chưa thể gắn bộ thẻ. Hãy đăng khóa học lên Supabase trước.'
    );
  }

  // RLS chỉ cho giảng viên phụ trách khóa (và admin) ghi. Lỗi thô của Postgres
  // không nói được nguyên nhân, nên dịch lại cho người dùng hiểu.
  const describeError = (error) => {
    const message = String(error?.message || '');
    if (/row-level security/i.test(message)) {
      return new Error(
        'Bạn không phụ trách khóa học này nên không thể tạo bộ thẻ cho nó. Hãy chọn khóa của bạn, hoặc nhờ quản trị viên gán khóa cho bạn.'
      );
    }
    return error;
  };

  const setPayload = {
    course_id: courseId,
    title: String(title).trim(),
    description: String(description || '').trim(),
    updated_at: new Date().toISOString()
  };

  let savedSetId = setId;

  if (savedSetId) {
    const { error } = await supabase.from('flashcard_sets').update(setPayload).eq('id', savedSetId);
    if (error) {
      throw describeError(error);
    }
    // Nhập lại thì thay trọn danh sách thẻ.
    const { error: deleteError } = await supabase.from('flashcards').delete().eq('set_id', savedSetId);
    if (deleteError) {
      throw deleteError;
    }
  } else {
    const { data, error } = await supabase
      .from('flashcard_sets')
      .insert({ ...setPayload, created_by: userId || null })
      .select('id')
      .single();
    if (error) {
      throw describeError(error);
    }
    savedSetId = data.id;
  }

  const { error: insertError } = await supabase.from('flashcards').insert(
    normalizedCards.map((card, index) => ({
      set_id: savedSetId,
      term: card.term,
      definition: card.definition,
      position: index
    }))
  );

  if (insertError) {
    throw describeError(insertError);
  }

  return getFlashcardSetById(savedSetId);
}

export async function deleteFlashcardSet(setId) {
  if (!setId) {
    return;
  }

  if (!isSupabaseReady()) {
    writeMockSets(readMockSets().filter((set) => String(set.id) !== String(setId)));
    return;
  }

  const { error } = await supabase.from('flashcard_sets').delete().eq('id', setId);
  if (error) {
    throw error;
  }
}

// ─── Tiến độ từng thẻ (chế độ Learn) ─────────────────────────────────────────

function readMockProgress() {
  try {
    return JSON.parse(localStorage.getItem(MOCK_FLASHCARD_PROGRESS_STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

export async function getFlashcardProgress({ userId, setId } = {}) {
  if (!isSupabaseReady() || !userId) {
    const all = readMockProgress();
    return all[`${userId || 'local'}:${setId}`] || {};
  }

  const { data, error } = await supabase
    .from('flashcard_progress')
    .select('card_id, correct_streak, wrong_count, mastered')
    .eq('user_id', userId);

  if (error) {
    console.warn('[getFlashcardProgress]', error.message);
    return {};
  }

  return (data || []).reduce((map, row) => {
    map[row.card_id] = {
      correctStreak: row.correct_streak,
      wrongCount: row.wrong_count,
      mastered: row.mastered
    };
    return map;
  }, {});
}

export async function saveFlashcardProgress({ userId, setId, progress = {} } = {}) {
  if (!isSupabaseReady() || !userId) {
    try {
      const all = readMockProgress();
      all[`${userId || 'local'}:${setId}`] = progress;
      localStorage.setItem(MOCK_FLASHCARD_PROGRESS_STORAGE_KEY, JSON.stringify(all));
    } catch {
      // ignore storage failures
    }
    return;
  }

  const rows = Object.entries(progress).map(([cardId, value]) => ({
    user_id: userId,
    card_id: cardId,
    correct_streak: Number(value?.correctStreak || 0),
    wrong_count: Number(value?.wrongCount || 0),
    mastered: Boolean(value?.mastered),
    updated_at: new Date().toISOString()
  }));

  if (!rows.length) {
    return;
  }

  const { error } = await supabase.from('flashcard_progress').upsert(rows, { onConflict: 'user_id,card_id' });
  if (error) {
    console.warn('[saveFlashcardProgress]', error.message);
  }
}
