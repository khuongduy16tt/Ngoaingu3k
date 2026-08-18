import { describe, expect, it } from 'vitest';
import {
  MAX_REORDER_MOVES,
  checkReorderAccess,
  collectReorderIds,
  parseReorderMoves
} from './lessonReorder.js';

// Kéo thả trong phòng học ghi thẳng vào lessons, nên đây là chốt chặn quyền.
// Ẩn nút ở client không tính là chặn: mọi ca dưới đây mô phỏng request nặn tay.

const GV_A = '11111111-1111-4111-8111-111111111111';
const GV_B = '22222222-2222-4222-8222-222222222222';
const KHOA_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const KHOA_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CHUONG_A1 = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';
const CHUONG_A2 = 'a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2';
const CHUONG_B1 = 'b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1';
const BAI_A1 = 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1';
const BAI_B1 = 'd1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1';

const THE_GIOI = {
  lessons: [
    { id: BAI_A1, chapter_id: CHUONG_A1, position: 1 },
    { id: BAI_B1, chapter_id: CHUONG_B1, position: 1 }
  ],
  chapters: [
    { id: CHUONG_A1, course_id: KHOA_A },
    { id: CHUONG_A2, course_id: KHOA_A },
    { id: CHUONG_B1, course_id: KHOA_B }
  ],
  courses: [
    { id: KHOA_A, teacher_id: GV_A },
    { id: KHOA_B, teacher_id: GV_B }
  ]
};

const check = (input) => checkReorderAccess({ ...THE_GIOI, ...input });

describe('parseReorderMoves — kiểm dữ liệu vào', () => {
  it('nhận danh sách hợp lệ', () => {
    const { moves, error } = parseReorderMoves({
      moves: [{ lessonId: BAI_A1, chapterId: CHUONG_A2, position: 2 }]
    });

    expect(error).toBeUndefined();
    expect(moves).toEqual([{ lessonId: BAI_A1, chapterId: CHUONG_A2, position: 2 }]);
  });

  it('từ chối mảng rỗng, id sai định dạng và vị trí không hợp lệ', () => {
    expect(parseReorderMoves({ moves: [] }).error).toBeTruthy();
    expect(parseReorderMoves({}).error).toBeTruthy();
    expect(parseReorderMoves({ moves: [{ lessonId: 'x', chapterId: CHUONG_A1, position: 1 }] }).error).toBeTruthy();
    expect(parseReorderMoves({ moves: [{ lessonId: BAI_A1, chapterId: 'x', position: 1 }] }).error).toBeTruthy();
    expect(parseReorderMoves({ moves: [{ lessonId: BAI_A1, chapterId: CHUONG_A1, position: 0 }] }).error).toBeTruthy();
    expect(parseReorderMoves({ moves: [{ lessonId: BAI_A1, chapterId: CHUONG_A1, position: 1.5 }] }).error).toBeTruthy();
  });

  it('từ chối khi một bài xuất hiện hai lần — kết quả sẽ phụ thuộc thứ tự ghi', () => {
    const { error } = parseReorderMoves({
      moves: [
        { lessonId: BAI_A1, chapterId: CHUONG_A1, position: 1 },
        { lessonId: BAI_A1, chapterId: CHUONG_A2, position: 3 }
      ]
    });

    expect(error).toBeTruthy();
  });

  it('chặn payload quá lớn', () => {
    const moves = Array.from({ length: MAX_REORDER_MOVES + 1 }, () => ({
      lessonId: BAI_A1,
      chapterId: CHUONG_A1,
      position: 1
    }));

    expect(parseReorderMoves({ moves }).error).toBeTruthy();
  });
});

describe('checkReorderAccess — chặn quyền', () => {
  it('giảng viên sắp xếp được khóa mình phụ trách', () => {
    const result = check({
      role: 'teacher',
      userId: GV_A,
      moves: [{ lessonId: BAI_A1, chapterId: CHUONG_A2, position: 1 }]
    });

    expect(result).toEqual({ ok: true });
  });

  it('CHẶN giảng viên đụng vào bài của khóa người khác', () => {
    const result = check({
      role: 'teacher',
      userId: GV_A,
      moves: [{ lessonId: BAI_B1, chapterId: CHUONG_B1, position: 2 }]
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
  });

  it('CHẶN kéo bài của mình sang chương thuộc khóa người khác', () => {
    const result = check({
      role: 'teacher',
      userId: GV_A,
      moves: [{ lessonId: BAI_A1, chapterId: CHUONG_B1, position: 1 }]
    });

    expect(result.ok).toBe(false);
    // Vượt khóa bị chặn trước cả bước đối chiếu chủ khóa.
    expect([400, 403]).toContain(result.status);
  });

  it('CHẶN kéo bài người khác về chương của mình', () => {
    const result = check({
      role: 'teacher',
      userId: GV_A,
      moves: [{ lessonId: BAI_B1, chapterId: CHUONG_A1, position: 1 }]
    });

    expect(result.ok).toBe(false);
    expect([400, 403]).toContain(result.status);
  });

  it('CHẶN cả khi loạt thao tác trộn một bài hợp lệ với một bài không được phép', () => {
    const result = check({
      role: 'teacher',
      userId: GV_A,
      moves: [
        { lessonId: BAI_A1, chapterId: CHUONG_A1, position: 1 },
        { lessonId: BAI_B1, chapterId: CHUONG_B1, position: 2 }
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
  });

  it('admin sắp xếp được mọi khóa', () => {
    expect(check({
      role: 'admin',
      userId: 'khong-lien-quan',
      moves: [{ lessonId: BAI_B1, chapterId: CHUONG_B1, position: 3 }]
    })).toEqual({ ok: true });
  });

  it('bài hoặc chương không tồn tại thì trả 404, không âm thầm bỏ qua', () => {
    const thieuBai = check({
      role: 'admin',
      userId: GV_A,
      moves: [{ lessonId: 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1', chapterId: CHUONG_A1, position: 1 }]
    });
    expect(thieuBai).toMatchObject({ ok: false, status: 404 });

    const thieuChuong = check({
      role: 'admin',
      userId: GV_A,
      moves: [{ lessonId: BAI_A1, chapterId: 'f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1', position: 1 }]
    });
    expect(thieuChuong).toMatchObject({ ok: false, status: 404 });
  });

  it('khóa của bài đã bị xóa thì chặn chứ không cho qua', () => {
    const result = checkReorderAccess({
      ...THE_GIOI,
      courses: [],
      role: 'teacher',
      userId: GV_A,
      moves: [{ lessonId: BAI_A1, chapterId: CHUONG_A1, position: 1 }]
    });

    expect(result).toMatchObject({ ok: false, status: 404 });
  });
});

describe('collectReorderIds', () => {
  it('gom id không trùng lặp để nạp DB', () => {
    const { lessonIds, chapterIds } = collectReorderIds([
      { lessonId: BAI_A1, chapterId: CHUONG_A1, position: 1 },
      { lessonId: BAI_B1, chapterId: CHUONG_A1, position: 2 }
    ]);

    expect(lessonIds).toEqual([BAI_A1, BAI_B1]);
    expect(chapterIds).toEqual([CHUONG_A1]);
  });
});
