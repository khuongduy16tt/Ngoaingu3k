// Đổi thứ tự chương: kiểm dữ liệu vào và chặn quyền tách khỏi route để test
// thẳng, cùng khuôn với lessonReorder.js.
//
// Khác với bài học, chương không đi đâu được ngoài khóa của nó — nên quy tắc ở
// đây gọn hơn: mọi chương trong MỘT request phải thuộc CÙNG một khóa, và khóa
// đó phải là khóa người dùng được quản lý.

// Một khóa dài cỡ vài chục chương; chặn trên cho một request khỏi thành phép
// quét lớn.
export const MAX_CHAPTER_MOVES = 200;

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Đọc và kiểm mảng `moves` từ body.
 * @returns {{ moves?: Array<{chapterId: string, position: number}>, error?: string }}
 */
export function parseChapterMoves(body) {
  const rawMoves = body?.moves;

  if (!Array.isArray(rawMoves) || !rawMoves.length) {
    return { error: 'Cần một mảng "moves" không rỗng.' };
  }

  if (rawMoves.length > MAX_CHAPTER_MOVES) {
    return { error: `Mỗi lần chỉ đổi tối đa ${MAX_CHAPTER_MOVES} chương.` };
  }

  const moves = [];
  const seenChapterIds = new Set();

  for (const raw of rawMoves) {
    const chapterId = String(raw?.chapterId || '').trim();
    const position = Number(raw?.position);

    if (!isUuid(chapterId)) {
      return { error: 'chapterId không hợp lệ.' };
    }

    if (!Number.isInteger(position) || position < 1) {
      return { error: 'position phải là số nguyên từ 1 trở lên.' };
    }

    // Cùng một chương hai lần thì kết quả phụ thuộc thứ tự ghi — từ chối luôn.
    if (seenChapterIds.has(chapterId)) {
      return { error: 'Một chương xuất hiện nhiều lần trong danh sách.' };
    }

    seenChapterIds.add(chapterId);
    moves.push({ chapterId, position });
  }

  return { moves };
}

/**
 * Quyết định người dùng có được thực hiện loạt `moves` này không.
 *
 * @param {object} input
 * @param {string} input.role      vai trò lấy từ DB, không phải từ client
 * @param {string} input.userId
 * @param {Array}  input.moves     kết quả của parseChapterMoves
 * @param {Array}  input.chapters  [{ id, course_id }] các chương bị đổi vị trí
 * @param {Array}  input.courses   [{ id, teacher_id }] các khóa liên quan
 * @returns {{ ok: true, courseId: string } | { ok: false, status: number, message: string }}
 */
export function checkChapterReorderAccess({ role, userId, moves, chapters, courses }) {
  const chapterById = new Map((chapters || []).map((chapter) => [chapter.id, chapter]));
  const courseById = new Map((courses || []).map((course) => [course.id, course]));

  let courseId = '';

  for (const move of moves) {
    const chapter = chapterById.get(move.chapterId);

    if (!chapter) {
      return { ok: false, status: 404, message: 'Không tìm thấy chương cần đổi vị trí.' };
    }

    if (!courseId) {
      courseId = chapter.course_id;
      continue;
    }

    // Trộn chương của hai khóa trong một lần sắp xếp là vô nghĩa, và là dấu hiệu
    // payload bị nặn tay — chặn thay vì cố đoán ý.
    if (chapter.course_id !== courseId) {
      return {
        ok: false,
        status: 400,
        message: 'Mỗi lần chỉ sắp xếp chương trong cùng một khóa học.'
      };
    }
  }

  const course = courseById.get(courseId);

  if (!course) {
    return { ok: false, status: 404, message: 'Không tìm thấy khóa học của chương.' };
  }

  if (role !== 'admin' && course.teacher_id !== userId) {
    return {
      ok: false,
      status: 403,
      message: 'Bạn không phụ trách khóa học này nên không đổi được thứ tự chương.'
    };
  }

  return { ok: true, courseId };
}

/** Các id cần nạp từ DB để chạy checkChapterReorderAccess. */
export function collectChapterIds(moves) {
  return [...new Set(moves.map((move) => move.chapterId))];
}
