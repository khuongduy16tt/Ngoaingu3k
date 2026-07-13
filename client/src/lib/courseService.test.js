import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  isSupabaseReady: () => false,
  supabase: null
}));

import { buildCourseRecordPayload } from './courseService';
import { getCourseOptions } from './assignmentService';

describe('buildCourseRecordPayload', () => {
  it('maps a published course draft into the Supabase course payload', () => {
    const payload = buildCourseRecordPayload(
      {
        title: 'Khóa học tiếng Anh giao tiếp',
        summary: 'Phát triển kỹ năng nói',
        priceValue: 490000,
        status: 'published',
        sections: [{ title: 'Bài 1', lessons: [{ title: 'Giới thiệu' }] }]
      },
      { teacherId: '123e4567-e89b-12d3-a456-426614174000' }
    );

    expect(payload).toMatchObject({
      slug: 'khoa-hoc-tieng-anh-giao-tiep',
      title: 'Khóa học tiếng Anh giao tiếp',
      description: 'Phát triển kỹ năng nói',
      price: 490000,
      status: 'published',
      teacher_id: '123e4567-e89b-12d3-a456-426614174000',
      banner_url: null
    });
  });
});

describe('getCourseOptions', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('includes teacher-managed courses in the learning room selector', () => {
    localStorage.setItem(
      'teacher-managed-courses-v1:test-teacher',
      JSON.stringify([
        { id: 'course-a', title: 'Course A' },
        { id: 'course-b', title: 'Course B' }
      ])
    );

    const options = getCourseOptions('test-teacher');
    const keys = options.map((course) => course.key);

    expect(keys).toContain('course-a');
    expect(keys).toContain('course-b');
  });
});
