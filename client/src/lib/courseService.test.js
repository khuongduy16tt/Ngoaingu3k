import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  isSupabaseReady: () => false,
  supabase: null
}));

import { buildCourseRecordPayload } from './courseService';

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
