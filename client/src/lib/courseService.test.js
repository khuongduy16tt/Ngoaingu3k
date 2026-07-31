import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  isSupabaseReady: () => false,
  supabase: null
}));

import { buildCourseRecordPayload, reconcileManagedCourses } from './courseService';
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

// Cache localStorage của dashboard giảng viên từng chỉ được cộng thêm, không
// bao giờ bớt đi, nên khóa đã xóa khỏi Supabase (ở máy khác, hoặc do admin)
// vẫn nằm mãi trong "Khóa đang vận hành".
describe('reconcileManagedCourses', () => {
  const daDongBo = { id: 'khoa-a', databaseId: '123e4567-e89b-12d3-a456-426614174000', title: 'Khóa A' };
  const biXoa = { id: 'khoa-b', databaseId: '223e4567-e89b-12d3-a456-426614174000', title: 'Khóa B' };
  const chuaDongBo = { id: 'khoa-nhap-1700000000000', databaseId: 'khoa-nhap-1700000000000', title: 'Nháp' };

  it('bỏ khóa đã biến mất khỏi server', () => {
    const ketQua = reconcileManagedCourses([daDongBo, biXoa], [daDongBo]);
    expect(ketQua.map((c) => c.title)).toEqual(['Khóa A']);
  });

  it('giữ khóa chưa từng đồng bộ (id không phải uuid)', () => {
    const ketQua = reconcileManagedCourses([chuaDongBo, biXoa], []);
    expect(ketQua.map((c) => c.title)).toEqual(['Nháp']);
  });

  it('so khớp được cả khi server trả id thay vì databaseId', () => {
    const ketQua = reconcileManagedCourses([daDongBo], [{ id: daDongBo.databaseId }]);
    expect(ketQua).toHaveLength(1);
  });
});

// Danh mục khóa học trộn cache localStorage của giảng viên vào kết quả từ
// server. Cache chỉ được cộng thêm nên khóa đã xóa khỏi Supabase vẫn hiện ở
// trang /courses — đúng triệu chứng "xóa trên Supabase rồi mà web vẫn còn".
describe('reconcileManagedCourses — dùng cho cả danh mục', () => {
  it('lọc khóa ma ra khỏi danh sách trộn với dữ liệu server', () => {
    const server = [{ id: '123e4567-e89b-12d3-a456-426614174000', title: 'HSK 3' }];
    const cacheLocal = [
      { id: 'hsk-3', databaseId: '123e4567-e89b-12d3-a456-426614174000', title: 'HSK 3' },
      { id: 'demo-hsk', databaseId: '999e4567-e89b-12d3-a456-426614174000', title: 'DEMO đã xóa' }
    ];

    expect(reconcileManagedCourses(cacheLocal, server).map((c) => c.title)).toEqual(['HSK 3']);
  });

  it('danh sách server rỗng thì bỏ hết khóa đã từng đồng bộ', () => {
    const cacheLocal = [
      { id: 'a', databaseId: '123e4567-e89b-12d3-a456-426614174000', title: 'Đã xóa' }
    ];
    expect(reconcileManagedCourses(cacheLocal, [])).toEqual([]);
  });
});
