import { describe, expect, it } from 'vitest';

import {
  formatLessonCorrectAnswer,
  getCorrectOptionLabel,
  getLessonQuestionMaxScore,
  isLessonQuestionAnswered,
  normalizeLessonQuestion,
  scoreLessonQuestion,
  scoreLessonQuestions
} from './lessonQuestions';

describe('normalizeLessonQuestion — tương thích ngược', () => {
  it('coi bản ghi cũ không có type là multiple_choice', () => {
    const legacy = {
      id: 'q1',
      prompt: 'Hello nghĩa là gì?',
      options: [{ label: 'A', text: 'Xin chào' }, { label: 'B', text: 'Tạm biệt' }],
      correctAnswer: 'A'
    };

    const normalized = normalizeLessonQuestion(legacy);
    expect(normalized.type).toBe('multiple_choice');
    expect(normalized.options).toEqual([
      { label: 'A', text: 'Xin chào' },
      { label: 'B', text: 'Tạm biệt' }
    ]);
  });

  it('chấp nhận options dạng chuỗi thô (không phải {label,text})', () => {
    const normalized = normalizeLessonQuestion({
      id: 'q1',
      options: ['Xin chào', 'Tạm biệt'],
      correctAnswer: 'A'
    });

    expect(normalized.options).toEqual([
      { label: 'A', text: 'Xin chào' },
      { label: 'B', text: 'Tạm biệt' }
    ]);
  });

  it('chấp nhận pairs dạng {term,answer} của bài tập giao cũ', () => {
    const normalized = normalizeLessonQuestion({
      type: 'matching',
      pairs: [{ term: 'dog', answer: 'con chó' }]
    });

    expect(normalized.pairs).toEqual([{ left: 'dog', right: 'con chó' }]);
  });
});

describe('multiple_choice', () => {
  const question = normalizeLessonQuestion({
    id: 'q1',
    type: 'multiple_choice',
    prompt: 'Chọn đáp án đúng',
    options: [{ label: 'A', text: 'Sai' }, { label: 'B', text: 'Đúng' }],
    correctAnswer: 'B'
  });

  it('chấm đúng theo nhãn lựa chọn', () => {
    expect(scoreLessonQuestion(question, 'B')).toEqual({ score: 1, maxScore: 1 });
    expect(scoreLessonQuestion(question, 'A')).toEqual({ score: 0, maxScore: 1 });
    expect(scoreLessonQuestion(question, undefined)).toEqual({ score: 0, maxScore: 1 });
  });

  it('getCorrectOptionLabel nhận diện qua nhãn hoặc nội dung', () => {
    expect(getCorrectOptionLabel(question)).toBe('B');
    const byText = normalizeLessonQuestion({
      type: 'multiple_choice',
      options: [{ label: 'A', text: 'Sai' }, { label: 'B', text: 'Đúng' }],
      correctAnswer: 'Đúng'
    });
    expect(getCorrectOptionLabel(byText)).toBe('B');
  });
});

describe('true_false', () => {
  const question = normalizeLessonQuestion({ type: 'true_false', prompt: 'Đúng hay sai?', correctAnswer: 'true' });

  it('chấm true/false', () => {
    expect(scoreLessonQuestion(question, 'true')).toEqual({ score: 1, maxScore: 1 });
    expect(scoreLessonQuestion(question, 'false')).toEqual({ score: 0, maxScore: 1 });
  });
});

describe('fill_blank', () => {
  const question = normalizeLessonQuestion({
    type: 'fill_blank',
    prompt: 'Hello, my name ____ Linh.',
    acceptedAnswers: ['is', "'s"]
  });

  it('chấm không phân biệt hoa thường, khoảng trắng và dấu câu', () => {
    expect(scoreLessonQuestion(question, ' IS ')).toEqual({ score: 1, maxScore: 1 });
    expect(scoreLessonQuestion(question, "'s")).toEqual({ score: 1, maxScore: 1 });
    expect(scoreLessonQuestion(question, 'am')).toEqual({ score: 0, maxScore: 1 });
    expect(scoreLessonQuestion(question, '')).toEqual({ score: 0, maxScore: 1 });
  });

  it('không tự chấm được nếu thiếu đáp án chấp nhận', () => {
    const noAnswer = normalizeLessonQuestion({ type: 'fill_blank', prompt: 'test', acceptedAnswers: [] });
    expect(getLessonQuestionMaxScore(noAnswer)).toBe(0);
  });
});

describe('listening', () => {
  const question = normalizeLessonQuestion({
    type: 'listening',
    prompt: 'Nghe và gõ lại',
    audioUrl: 'https://example.com/a.mp3',
    acceptedAnswers: ['I go to school every day.']
  });

  it('chấm giống fill_blank, bỏ qua dấu câu', () => {
    expect(scoreLessonQuestion(question, 'i go to school every day')).toEqual({ score: 1, maxScore: 1 });
    expect(scoreLessonQuestion(question, 'i go to school')).toEqual({ score: 0, maxScore: 1 });
  });

  it('giữ lại audioUrl sau khi normalize', () => {
    expect(question.audioUrl).toBe('https://example.com/a.mp3');
  });
});

describe('matching', () => {
  const question = normalizeLessonQuestion({
    type: 'matching',
    prompt: 'Nối từ với nghĩa',
    pairs: [
      { left: 'dog', right: 'con chó' },
      { left: 'cat', right: 'con mèo' }
    ]
  });

  it('chấm điểm từng phần theo số cặp đúng', () => {
    expect(scoreLessonQuestion(question, { 0: 'con chó', 1: 'con mèo' })).toEqual({ score: 2, maxScore: 2 });
    expect(scoreLessonQuestion(question, { 0: 'con chó', 1: 'sai' })).toEqual({ score: 1, maxScore: 2 });
    expect(scoreLessonQuestion(question, undefined)).toEqual({ score: 0, maxScore: 2 });
  });

  it('isLessonQuestionAnswered yêu cầu trả lời đủ mọi cặp', () => {
    expect(isLessonQuestionAnswered(question, { 0: 'con chó' })).toBe(false);
    expect(isLessonQuestionAnswered(question, { 0: 'con chó', 1: 'con mèo' })).toBe(true);
  });
});

describe('writing', () => {
  const question = normalizeLessonQuestion({
    type: 'writing',
    prompt: 'Viết một đoạn giới thiệu bản thân.',
    sampleAnswer: 'My name is Linh...'
  });

  it('không tự chấm điểm — chỉ hiện đáp án mẫu để đối chiếu', () => {
    expect(getLessonQuestionMaxScore(question)).toBe(0);
    expect(scoreLessonQuestion(question, 'bất kỳ câu trả lời nào')).toEqual({ score: 0, maxScore: 0 });
    expect(formatLessonCorrectAnswer(question)).toBe('My name is Linh...');
  });

  it('vẫn tính là đã trả lời để không chặn nộp bài', () => {
    expect(isLessonQuestionAnswered(question, 'Hello, I am Linh.')).toBe(true);
    expect(isLessonQuestionAnswered(question, '')).toBe(false);
  });
});

describe('scoreLessonQuestions', () => {
  it('cộng dồn điểm, bỏ qua câu writing khỏi tổng điểm nhưng đếm riêng', () => {
    const mcq = normalizeLessonQuestion({
      id: 'q1',
      type: 'multiple_choice',
      options: [{ label: 'A', text: 'A' }, { label: 'B', text: 'B' }],
      correctAnswer: 'A'
    });
    const writing = normalizeLessonQuestion({ id: 'q2', type: 'writing', prompt: 'Viết gì đó' });

    const result = scoreLessonQuestions([mcq, writing], { q1: 'A', q2: 'câu trả lời' });

    expect(result).toEqual({ score: 1, maxScore: 1, gradedCount: 1, selfGradedCount: 1 });
  });
});
