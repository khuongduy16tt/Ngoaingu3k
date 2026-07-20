import { describe, expect, it } from 'vitest';

vi.mock('./supabase', () => ({
  isSupabaseReady: () => false,
  supabase: null
}));

import {
  getQuestionMaxScore,
  normalizeExamSection,
  scoreExamAnswers,
  scoreExamQuestion
} from './examService';

const multipleChoice = {
  id: 'q1',
  type: 'multiple_choice',
  prompt: 'Chọn đáp án đúng',
  options: ['A', 'B', 'C', 'D'],
  correctAnswer: 'B'
};

const trueFalse = {
  id: 'q2',
  type: 'true_false',
  prompt: 'Nhận định này đúng?',
  correctAnswer: 'true'
};

const fillBlank = {
  id: 'q3',
  type: 'fill_blank',
  prompt: 'Điền từ còn thiếu',
  correctAnswer: '',
  acceptedAnswers: ['Hello World', 'hello-world'],
  options: [],
  pairs: []
};

const matching = {
  id: 'q4',
  type: 'matching',
  prompt: 'Nối từ với nghĩa',
  pairs: [
    { left: 'dog', right: 'con chó' },
    { left: 'cat', right: 'con mèo' },
    { left: 'bird', right: 'con chim' }
  ]
};

describe('scoreExamQuestion', () => {
  it('scores multiple choice by exact match', () => {
    expect(scoreExamQuestion(multipleChoice, 'B')).toEqual({ score: 1, maxScore: 1 });
    expect(scoreExamQuestion(multipleChoice, 'A')).toEqual({ score: 0, maxScore: 1 });
    expect(scoreExamQuestion(multipleChoice, undefined)).toEqual({ score: 0, maxScore: 1 });
  });

  it('scores true/false answers', () => {
    expect(scoreExamQuestion(trueFalse, 'true')).toEqual({ score: 1, maxScore: 1 });
    expect(scoreExamQuestion(trueFalse, 'false')).toEqual({ score: 0, maxScore: 1 });
  });

  it('scores fill-in answers case- and whitespace-insensitively', () => {
    expect(scoreExamQuestion(fillBlank, '  hello   world ')).toEqual({ score: 1, maxScore: 1 });
    expect(scoreExamQuestion(fillBlank, 'HELLO-WORLD')).toEqual({ score: 1, maxScore: 1 });
    expect(scoreExamQuestion(fillBlank, 'goodbye')).toEqual({ score: 0, maxScore: 1 });
    expect(scoreExamQuestion(fillBlank, '')).toEqual({ score: 0, maxScore: 1 });
  });

  it('gives matching partial credit per correct pair', () => {
    expect(
      scoreExamQuestion(matching, { 0: 'con chó', 1: 'con mèo', 2: 'con chim' })
    ).toEqual({ score: 3, maxScore: 3 });
    expect(scoreExamQuestion(matching, { 0: 'con chó', 1: 'con chim', 2: 'con mèo' })).toEqual({
      score: 1,
      maxScore: 3
    });
    expect(scoreExamQuestion(matching, undefined)).toEqual({ score: 0, maxScore: 3 });
  });
});

describe('getQuestionMaxScore', () => {
  it('uses pair count for matching and 1 for other types', () => {
    expect(getQuestionMaxScore(matching)).toBe(3);
    expect(getQuestionMaxScore(multipleChoice)).toBe(1);
    expect(getQuestionMaxScore(fillBlank)).toBe(1);
  });
});

describe('scoreExamAnswers', () => {
  it('aggregates per-section and total scores', () => {
    const sections = [
      normalizeExamSection({
        id: 's1',
        type: 'listening',
        title: 'Nghe',
        durationMinutes: 10,
        questions: [multipleChoice, trueFalse]
      }),
      normalizeExamSection({
        id: 's2',
        type: 'reading',
        title: 'Đọc',
        durationMinutes: 20,
        questions: [fillBlank, matching]
      })
    ];

    const result = scoreExamAnswers(sections, {
      q1: 'B',
      q2: 'false',
      q3: 'hello world',
      q4: { 0: 'con chó', 1: 'con mèo', 2: 'sai' }
    });

    expect(result.sectionScores).toEqual([
      { sectionId: 's1', type: 'listening', title: 'Nghe', score: 1, maxScore: 2 },
      { sectionId: 's2', type: 'reading', title: 'Đọc', score: 3, maxScore: 4 }
    ]);
    expect(result.score).toBe(4);
    expect(result.maxScore).toBe(6);
  });
});
