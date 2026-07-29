import { describe, it, expect } from 'vitest';
import {
  buildLessonTabs,
  countLessonQuestions,
  createExerciseTab,
  flattenLessonTabExercises,
  getExerciseTabs,
  getVideoTab,
  serializeLessonTabs
} from './lessonTabs';

const question = (id) => ({ id, type: 'multiple_choice', prompt: `Câu ${id}`, correctAnswer: 'A' });

describe('buildLessonTabs — tương thích ngược với bài học cũ', () => {
  it('dựng 1 tab video + 1 tab bài tập từ dữ liệu phẳng', () => {
    const tabs = buildLessonTabs({
      videoUrl: 'https://drive.google.com/file/d/abc/view',
      exerciseType: 'Luyện tập',
      exercises: [question('q1'), question('q2')]
    });

    expect(tabs).toHaveLength(2);
    expect(getVideoTab(tabs).videoUrl).toBe('https://drive.google.com/file/d/abc/view');
    expect(getExerciseTabs(tabs)).toHaveLength(1);
    expect(getExerciseTabs(tabs)[0].title).toBe('Luyện tập');
    expect(countLessonQuestions(tabs)).toBe(2);
  });

  it('vẫn có tab video khi bài học chưa gắn video', () => {
    const tabs = buildLessonTabs({ exercises: [question('q1')] });
    expect(getVideoTab(tabs)).toBeTruthy();
    expect(getVideoTab(tabs).videoUrl).toBe('');
  });

  it('giữ nội dung luyện đọc / bảng phiên âm trong tab video', () => {
    const tabs = buildLessonTabs({ readingItems: ['你好', '很好'], pinyinTable: 'initials' });
    expect(getVideoTab(tabs).readingItems).toEqual(['你好', '很好']);
    expect(getVideoTab(tabs).pinyinTable).toBe('initials');
    expect(getExerciseTabs(tabs)).toHaveLength(0);
  });
});

describe('buildLessonTabs — model tab mới', () => {
  it('giữ nguyên nhiều tab bài tập độc lập với tên riêng', () => {
    const tabs = buildLessonTabs({
      tabs: [
        { id: 'v', kind: 'video', title: 'Video bài học', videoUrl: 'https://youtu.be/xyz' },
        { id: 'e1', kind: 'exercise', title: 'Bài tập ngữ pháp 1', exercises: [question('a')] },
        { id: 'e2', kind: 'exercise', title: 'Bài tập ngữ pháp 2', exercises: [question('b'), question('c')] },
        { id: 'e3', kind: 'exercise', title: 'Bài tập nghe 1', exercises: [] }
      ]
    });

    expect(getExerciseTabs(tabs).map((tab) => tab.title)).toEqual([
      'Bài tập ngữ pháp 1',
      'Bài tập ngữ pháp 2',
      'Bài tập nghe 1'
    ]);
    expect(countLessonQuestions(tabs)).toBe(3);
  });

  it('chèn tab video nếu danh sách tab chỉ có bài tập', () => {
    const tabs = buildLessonTabs({
      videoUrl: 'https://youtu.be/xyz',
      tabs: [{ id: 'e1', kind: 'exercise', title: 'Bài tập 1', exercises: [] }]
    });

    expect(getVideoTab(tabs)).toBeTruthy();
    expect(getVideoTab(tabs).videoUrl).toBe('https://youtu.be/xyz');
    expect(tabs[0].kind).toBe('video');
  });
});

describe('createExerciseTab', () => {
  it('đặt tên không trùng với tab đang có', () => {
    const tabs = buildLessonTabs({
      tabs: [
        { id: 'v', kind: 'video', title: 'Video bài học' },
        { id: 'e1', kind: 'exercise', title: 'Bài tập 1', exercises: [] }
      ]
    });

    const next = createExerciseTab(tabs);
    expect(next.kind).toBe('exercise');
    expect(next.title).toBe('Bài tập 2');
    expect(next.exercises).toEqual([]);
  });
});

describe('flattenLessonTabExercises', () => {
  it('gộp câu hỏi mọi tab bài tập theo đúng thứ tự, bỏ qua tab video', () => {
    const tabs = buildLessonTabs({
      tabs: [
        { id: 'v', kind: 'video', title: 'Video bài học', videoUrl: 'https://youtu.be/xyz' },
        { id: 'e1', kind: 'exercise', title: 'Bài tập 1', exercises: [question('a')] },
        { id: 'e2', kind: 'exercise', title: 'Bài tập 2', exercises: [question('b')] }
      ]
    });

    expect(flattenLessonTabExercises(tabs).map((item) => item.id)).toEqual(['a', 'b']);
  });
});

// Dashboard giữ tab đã serialize trong bản nháp rồi dựng lại bằng buildLessonTabs
// ở mỗi lần render, nên vòng serialize → build phải đứng yên.
describe('round-trip serialize → build (bản nháp Dashboard)', () => {
  const tabs = buildLessonTabs({
    tabs: [
      { id: 'v', kind: 'video', title: 'Video bài học', videoUrl: 'https://youtu.be/xyz' },
      { id: 'e1', kind: 'exercise', title: 'Bài tập ngữ pháp 1', exercises: [question('a')] },
      { id: 'e2', kind: 'exercise', title: 'Bài tập nghe 2', exercises: [question('b'), question('c')] }
    ]
  });

  it('không đổi sau nhiều vòng lưu rồi dựng lại', () => {
    const once = buildLessonTabs({ tabs: serializeLessonTabs(tabs) });
    const twice = buildLessonTabs({ tabs: serializeLessonTabs(once) });

    expect(twice.map((tab) => [tab.id, tab.kind, tab.title])).toEqual(
      tabs.map((tab) => [tab.id, tab.kind, tab.title])
    );
    expect(flattenLessonTabExercises(twice).map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(getVideoTab(twice).videoUrl).toBe('https://youtu.be/xyz');
  });

  it('tab thêm mới sau khi lưu vẫn giữ tên riêng', () => {
    const withNew = [...tabs, createExerciseTab(tabs)];
    const rebuilt = buildLessonTabs({ tabs: serializeLessonTabs(withNew) });

    expect(getExerciseTabs(rebuilt).map((tab) => tab.title)).toEqual([
      'Bài tập ngữ pháp 1',
      'Bài tập nghe 2',
      'Bài tập 3'
    ]);
  });

  it('xóa một tab không ảnh hưởng câu hỏi của tab còn lại', () => {
    const remaining = tabs.filter((tab) => tab.id !== 'e1');
    const rebuilt = buildLessonTabs({ tabs: serializeLessonTabs(remaining) });

    expect(flattenLessonTabExercises(rebuilt).map((item) => item.id)).toEqual(['b', 'c']);
    expect(getExerciseTabs(rebuilt)).toHaveLength(1);
  });
});

describe('serializeLessonTabs', () => {
  it('bỏ field rỗng nhưng giữ đủ tên tab và câu hỏi', () => {
    const tabs = buildLessonTabs({
      tabs: [
        { id: 'v', kind: 'video', title: 'Video bài học', videoUrl: 'https://youtu.be/xyz' },
        { id: 'e1', kind: 'exercise', title: 'Bài tập ngữ pháp 1', exercises: [question('a')] }
      ]
    });

    const payload = serializeLessonTabs(tabs);
    expect(payload[0]).toEqual({
      id: 'v',
      kind: 'video',
      title: 'Video bài học',
      videoUrl: 'https://youtu.be/xyz'
    });
    expect(payload[1].kind).toBe('exercise');
    expect(payload[1].title).toBe('Bài tập ngữ pháp 1');
    expect(payload[1].exercises).toHaveLength(1);
    expect(payload[1]).not.toHaveProperty('audioUrl');
  });
});
