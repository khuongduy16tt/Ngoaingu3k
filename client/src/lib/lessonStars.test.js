import { describe, it, expect } from 'vitest';
import {
  countCompletedLessons,
  countLessons,
  getLessonStars,
  getSectionStars,
  getSectionTrophies,
  isLessonComplete
} from './lessonStars';

// Sao của bài học lấy theo điểm bài tập đã nộp; cúp của chương lấy theo tổng sao.

describe('getLessonStars', () => {
  it('gives no star to an unfinished lesson', () => {
    expect(getLessonStars({ id: 'l1', status: 'active' }, {})).toBe(0);
  });

  it('gives full stars to a finished lesson without graded questions', () => {
    expect(getLessonStars({ id: 'l1' }, { l1: { completed: true } })).toBe(3);
    expect(getLessonStars({ id: 'l1', status: 'done' }, {})).toBe(3);
  });

  it('grades stars from the submitted score', () => {
    expect(getLessonStars({ id: 'l1' }, { l1: { completed: true, score: 9, maxScore: 10 } })).toBe(3);
    expect(getLessonStars({ id: 'l1' }, { l1: { completed: true, score: 6, maxScore: 10 } })).toBe(2);
    expect(getLessonStars({ id: 'l1' }, { l1: { completed: true, score: 2, maxScore: 10 } })).toBe(1);
    expect(getLessonStars({ id: 'l1' }, { l1: { completed: true, score: 0, maxScore: 10 } })).toBe(1);
  });

  it('reads snake_case score columns coming straight from Supabase', () => {
    expect(getLessonStars({ id: 'l1' }, { l1: { completed: true, score: 5, max_score: 10 } })).toBe(2);
  });
});

describe('getSectionStars & getSectionTrophies', () => {
  const section = {
    lessons: [{ id: 'l1' }, { id: 'l2' }, { id: 'l3' }]
  };

  it('sums the stars of a section', () => {
    const progressMap = { l1: { completed: true }, l2: { completed: true } };
    expect(getSectionStars(section, progressMap)).toEqual({ earned: 6, max: 9 });
  });

  it('turns the star ratio into trophies', () => {
    expect(getSectionTrophies({ earned: 0, max: 9 })).toBe(0);
    expect(getSectionTrophies({ earned: 3, max: 9 })).toBe(1);
    expect(getSectionTrophies({ earned: 6, max: 9 })).toBe(2);
    expect(getSectionTrophies({ earned: 9, max: 9 })).toBe(3);
    expect(getSectionTrophies({ earned: 0, max: 0 })).toBe(0);
  });
});

describe('lesson counters', () => {
  const sections = [{ lessons: [{ id: 'l1' }, { id: 'l2' }] }, { lessons: [{ id: 'l3' }] }];

  it('counts lessons and completed lessons across sections', () => {
    expect(countLessons(sections)).toBe(3);
    expect(countCompletedLessons(sections, { l1: { completed: true }, l3: { completed: true } })).toBe(2);
  });

  it('treats a lesson marked done by the course data as complete', () => {
    expect(isLessonComplete({ id: 'l9', status: 'done' }, {})).toBe(true);
    expect(isLessonComplete({ id: 'l9', status: 'locked' }, {})).toBe(false);
  });
});
