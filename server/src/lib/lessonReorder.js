// Đổi vị trí bài học: phần kiểm dữ liệu vào và phần chặn quyền tách khỏi route
// để test được thẳng, không cần dựng HTTP và Supabase.
//
// Quy tắc chặn quyền, áp cho CẢ hai phía của một cú kéo:
//   - bài bị kéo phải thuộc khóa mà người dùng được quản lý, VÀ
//   - chương được thả vào cũng phải thuộc khóa người dùng được quản lý.
// Thiếu vế thứ hai thì một giảng viên có thể kéo bài của mình sang khóa người
// khác, hoặc ngược lại kéo bài người khác về khóa mình.

// Một khóa dài cỡ 300 bài; chặn trên để một request không thành phép quét lớn.
export const MAX_REORDER_MOVES = 500;

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Đọc và kiểm mảng `moves` từ body.
 * @returns {{ moves?: Array<{lessonId: string, chapterId: string, position: number}>, error?: string }}
 */
export function parseReorderMoves(body) {
  const rawMoves = body?.moves;

  if (!Array.isArray(rawMoves) || !rawMoves.length) {
    return { error: 'Cần một mảng "moves" không rỗng.' };
  }

  if (rawMoves.length > MAX_REORDER_MOVES) {
    return { error: `Mỗi lần chỉ đổi tối đa ${MAX_REORDER_MOVES} bài.` };
  }

  const moves = [];
  const seenLessonIds = new Set();

  for (const raw of rawMoves) {
    const lessonId = String(raw?.lessonId || '').trim();
    const chapterId = String(raw?.chapterId || '').trim();
    const position = Number(raw?.position);

    if (!isUuid(lessonId)) {
      return { error: 'lessonId không hợp lệ.' };
    }

    if (!isUuid(chapterId)) {
      return { error: 'chapterId không hợp lệ.' };
    }

    if (!Number.isInteger(position) || position < 1) {
      return { error: 'position phải là số nguyên từ 1 trở lên.' };
    }

    // Cùng một bài xuất hiện hai lần thì kết quả phụ thuộc thứ tự ghi — từ chối
    // luôn thay vì để client đoán xem lần nào thắng.
    if (seenLessonIds.has(lessonId)) {
      return { error: 'Một bài học xuất hiện nhiều lần trong danh sách.' };
    }

    seenLessonIds.add(lessonId);
    moves.push({ lessonId, chapterId, position });
  }

  return { moves };
}

/**
 * Quyết định người dùng có được thực hiện loạt `moves` này không.
 *
 * @param {object} input
 * @param {string} input.role                vai trò lấy từ DB, không phải từ client
 * @param {string} input.userId
 * @param {Array}  input.moves               kết quả của parseReorderMoves
 * @param {Array}  input.lessons             [{ id, chapter_id }] các bài bị kéo
 * @param {Array}  input.chapters            [{ id, course_id }] chương nguồn + chương đích
 * @param {Array}  input.courses             [{ id, teacher_id }] các khóa liên quan
 * @returns {{ ok: true } | { ok: false, status: number, message: string }}
 */
export function checkReorderAccess({ role, userId, moves, lessons, chapters, courses }) {
  const lessonById = new Map((lessons || []).map((lesson) => [lesson.id, lesson]));
  const chapterById = new Map((chapters || []).map((chapter) => [chapter.id, chapter]));
  const courseById = new Map((courses || []).map((course) => [course.id, course]));

  // Khóa mà loạt thao tác này chạm vào, gom từ cả chương nguồn lẫn chương đích.
  const touchedCourseIds = new Set();

  for (const move of moves) {
    const lesson = lessonById.get(move.lessonId);
    if (!lesson) {
      return { ok: false, status: 404, message: 'Không tìm thấy bài học cần đổi vị trí.' };
    }

    const targetChapter = chapterById.get(move.chapterId);
    if (!targetChapter) {
      return { ok: false, status: 404, message: 'Không tìm thấy chương đích.' };
    }

    const sourceChapter = chapterById.get(lesson.chapter_id);
    if (!sourceChapter) {
      return { ok: false, status: 404, message: 'Không tìm thấy chương hiện tại của bài học.' };
    }

    // Kéo bài sang một khóa khác không phải là thao tác của màn này, kể cả khi
    // người dùng quản lý cả hai khóa: vị trí bài chỉ có nghĩa trong một khóa.
    if (sourceChapter.course_id !== targetChapter.course_id) {
      return {
        ok: false,
        status: 400,
        message: 'Không thể chuyển bài học sang một khóa học khác.'
      };
    }

    touchedCourseIds.add(sourceChapter.course_id);
    touchedCourseIds.add(targetChapter.course_id);
  }

  // Admin quản lý mọi khóa; nhưng khóa phải có thật.
  for (const courseId of touchedCourseIds) {
    const course = courseById.get(courseId);

    if (!course) {
      return { ok: false, status: 404, message: 'Không tìm thấy khóa học của bài.' };
    }

    if (role !== 'admin' && course.teacher_id !== userId) {
      return {
        ok: false,
        status: 403,
        message: 'Bạn không phụ trách khóa học này nên không đổi được vị trí bài.'
      };
    }
  }

  return { ok: true };
}

/** Các id cần nạp từ DB để chạy checkReorderAccess. */
export function collectReorderIds(moves) {
  return {
    lessonIds: [...new Set(moves.map((move) => move.lessonId))],
    chapterIds: [...new Set(moves.map((move) => move.chapterId))]
  };
}
