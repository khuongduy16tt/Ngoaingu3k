import { describe, it, expect } from 'vitest';
import {
  BASIC_STROKES,
  CHINESE_STROKES,
  findStrokeByVietnameseName,
  getStrokeById,
  normalizeStrokeName
} from './strokes';
import hsk1Course from '../../scripts/hsk1-course.json';

describe('bộ nét chữ Hán', () => {
  it('mỗi nét có đủ id, tên Việt, tên Hán, pinyin và path vẽ', () => {
    CHINESE_STROKES.forEach((stroke) => {
      expect(stroke.id, `nét ${stroke.vi} thiếu id`).toBeTruthy();
      expect(stroke.vi).toMatch(/^Nét /);
      expect(stroke.zh).toBeTruthy();
      expect(stroke.pinyin).toBeTruthy();
      expect(stroke.path, `nét ${stroke.vi} thiếu path`).toMatch(/^M /);
      expect(stroke.start).toHaveLength(2);
    });
  });

  it('id và tên tiếng Việt không trùng nhau', () => {
    const ids = CHINESE_STROKES.map((stroke) => stroke.id);
    const names = CHINESE_STROKES.map((stroke) => normalizeStrokeName(stroke.vi));
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it('có đúng 8 nét cơ bản', () => {
    expect(BASIC_STROKES).toHaveLength(8);
    expect(BASIC_STROKES.map((s) => s.id)).toContain('heng');
    expect(BASIC_STROKES.map((s) => s.id)).toContain('shugou');
  });
});

describe('tra nét theo tên tiếng Việt', () => {
  it('bỏ qua tiền tố "Nét", hoa thường và khoảng trắng thừa', () => {
    expect(findStrokeByVietnameseName('Nét sổ móc')?.id).toBe('shugou');
    expect(findStrokeByVietnameseName('sổ móc')?.id).toBe('shugou');
    expect(findStrokeByVietnameseName('  NÉT SỔ MÓC  ')?.id).toBe('shugou');
  });

  it('trả về null với tên không có trong bộ nét', () => {
    expect(findStrokeByVietnameseName('Nét không tồn tại')).toBeNull();
    expect(findStrokeByVietnameseName('')).toBeNull();
  });

  it('phân biệt nét ngang, nét ngang gập và nét ngang gập móc', () => {
    expect(findStrokeByVietnameseName('Nét ngang')?.id).toBe('heng');
    expect(findStrokeByVietnameseName('Nét ngang gập')?.id).toBe('hengzhe');
    expect(findStrokeByVietnameseName('Nét ngang gập móc')?.id).toBe('hengzhegou');
  });
});

// Bài "Chọn tên gọi đúng của nét trong hình" trong khóa HSK 1 mất ảnh gốc khi
// import; mỗi câu được gắn strokeId để vẽ lại hình bằng SVG.
describe('vá bài nét chữ của HSK 1', () => {
  const strokeLessons = (hsk1Course.sections || []).flatMap((section) =>
    (section.lessons || []).filter((lesson) => /tên gọi đúng của nét/i.test(lesson.title || ''))
  );

  it('tìm thấy bài trong payload khóa học', () => {
    expect(strokeLessons.length).toBeGreaterThan(0);
  });

  it('mọi câu đều có strokeId tra được ra nét thật', () => {
    strokeLessons.forEach((lesson) => {
      expect(lesson.exercises.length).toBeGreaterThan(0);
      lesson.exercises.forEach((question) => {
        expect(question.strokeId, `câu "${question.prompt}" chưa có strokeId`).toBeTruthy();
        expect(getStrokeById(question.strokeId), `strokeId ${question.strokeId} không có thật`).toBeTruthy();
      });
    });
  });

  it('hình nét khớp với đáp án đúng của câu hỏi', () => {
    strokeLessons.forEach((lesson) => {
      lesson.exercises.forEach((question) => {
        const correctOption = question.options.find((option) => option.label === question.correctAnswer);
        expect(correctOption, `câu "${question.prompt}" không có đáp án đúng`).toBeTruthy();

        const strokeFromAnswer = findStrokeByVietnameseName(correctOption.text);
        expect(strokeFromAnswer?.id).toBe(question.strokeId);
      });
    });
  });

  it('mỗi câu vẽ một nét khác nhau — không còn 4 câu nhìn giống hệt nhau', () => {
    strokeLessons.forEach((lesson) => {
      const ids = lesson.exercises.map((question) => question.strokeId);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
