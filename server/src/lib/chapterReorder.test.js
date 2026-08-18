import { describe, expect, it } from 'vitest';
import {
  MAX_CHAPTER_MOVES,
  checkChapterReorderAccess,
  collectChapterIds,
  parseChapterMoves
} from './chapterReorder.js';

// Kéo chương trong phòng học ghi thẳng vào bảng chapters, nên đây là chốt chặn
// quyền. Mọi ca dưới đây mô phỏng request nặn tay, không đi qua giao diện.

const GV_A = '11111111-1111-4111-8111-111111111111';
const GV_B = '22222222-2222-4222-8222-222222222222';
const KHOA_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const KHOA_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CHUONG_A1 = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';
const CHUONG_A2 = 'a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2';
const CHUONG_B1 = 'b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1';

const THE_GIOI = {
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

const check = (input) => checkChapterReorderAccess({ ...THE_GIOI, ...input });

describe('parseChapterMoves — kiểm dữ liệu vào', () => {
  it('nhận danh sách hợp lệ', () => {
    const { moves, error } = parseChapterMoves({
      moves: [
        { chapterId: CHUONG_A2, position: 1 },
        { chapterId: CHUONG_A1, position: 2 }
      ]
    });

    expect(error).toBeUndefined();
    expect(moves).toHaveLength(2);
  });

  it('từ chối mảng rỗng, id sai và vị trí không hợp lệ', () => {
    expect(parseChapterMoves({ moves: [] }).error).toBeTruthy();
    expect(parseChapterMoves({}).error).toBeTruthy();
    expect(parseChapterMoves({ moves: [{ chapterId: 'x', position: 1 }] }).error).toBeTruthy();
    expect(parseChapterMoves({ moves: [{ chapterId: CHUONG_A1, position: 0 }] }).error).toBeTruthy();
    expect(parseChapterMoves({ moves: [{ chapterId: CHUONG_A1, position: 2.5 }] }).error).toBeTruthy();
  });

  it('từ chối khi một chương xuất hiện hai lần', () => {
    const { error } = parseChapterMoves({
      moves: [
        { chapterId: CHUONG_A1, position: 1 },
        { chapterId: CHUONG_A1, position: 2 }
      ]
    });

    expect(error).toBeTruthy();
  });

  it('chặn payload quá lớn', () => {
    const moves = Array.from({ length: MAX_CHAPTER_MOVES + 1 }, () => ({
      chapterId: CHUONG_A1,
      position: 1
    }));

    expect(parseChapterMoves({ moves }).error).toBeTruthy();
  });
});

describe('checkChapterReorderAccess — chặn quyền', () => {
  it('giảng viên sắp xếp được chương của khóa mình phụ trách', () => {
    const result = check({
      role: 'teacher',
      userId: GV_A,
      moves: [
        { chapterId: CHUONG_A2, position: 1 },
        { chapterId: CHUONG_A1, position: 2 }
      ]
    });

    expect(result).toEqual({ ok: true, courseId: KHOA_A });
  });

  it('CHẶN giảng viên đụng vào chương của khóa người khác', () => {
    const result = check({
      role: 'teacher',
      userId: GV_A,
      moves: [{ chapterId: CHUONG_B1, position: 1 }]
    });

    expect(result).toMatchObject({ ok: false, status: 403 });
  });

  it('CHẶN trộn chương của hai khóa trong một lần sắp xếp', () => {
    const result = check({
      role: 'admin',
      userId: GV_A,
      moves: [
        { chapterId: CHUONG_A1, position: 1 },
        { chapterId: CHUONG_B1, position: 2 }
      ]
    });

    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it('CHẶN cả khi chương hợp lệ đứng trước chương không được phép', () => {
    const result = check({
      role: 'teacher',
      userId: GV_A,
      moves: [
        { chapterId: CHUONG_A1, position: 1 },
        { chapterId: CHUONG_B1, position: 2 }
      ]
    });

    expect(result.ok).toBe(false);
  });

  it('admin sắp xếp được mọi khóa', () => {
    expect(
      check({ role: 'admin', userId: 'khong-lien-quan', moves: [{ chapterId: CHUONG_B1, position: 1 }] })
    ).toEqual({ ok: true, courseId: KHOA_B });
  });

  it('chương không tồn tại thì 404, không âm thầm bỏ qua', () => {
    const result = check({
      role: 'admin',
      userId: GV_A,
      moves: [{ chapterId: 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1', position: 1 }]
    });

    expect(result).toMatchObject({ ok: false, status: 404 });
  });

  it('khóa của chương đã bị xóa thì chặn chứ không cho qua', () => {
    const result = checkChapterReorderAccess({
      ...THE_GIOI,
      courses: [],
      role: 'teacher',
      userId: GV_A,
      moves: [{ chapterId: CHUONG_A1, position: 1 }]
    });

    expect(result).toMatchObject({ ok: false, status: 404 });
  });
});

describe('collectChapterIds', () => {
  it('gom id không trùng lặp', () => {
    expect(
      collectChapterIds([
        { chapterId: CHUONG_A1, position: 1 },
        { chapterId: CHUONG_A2, position: 2 }
      ])
    ).toEqual([CHUONG_A1, CHUONG_A2]);
  });
});
