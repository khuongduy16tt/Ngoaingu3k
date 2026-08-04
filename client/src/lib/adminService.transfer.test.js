import { beforeEach, describe, expect, it, vi } from 'vitest';

// Bàn giao khóa học chạm vào 3 bảng với bộ lọc khác nhau, nên mock ghi lại
// từng lệnh update để kiểm tra đúng bảng — đúng điều kiện — đúng chủ mới.
const { supabaseState } = vi.hoisted(() => ({
  supabaseState: { ready: true, calls: [], responses: {} }
}));

vi.mock('./supabase', () => ({
  isSupabaseReady: () => supabaseState.ready,
  supabase: {
    from(table) {
      const call = { table, payload: null, filters: {} };
      const builder = {
        update(payload) {
          call.payload = payload;
          return builder;
        },
        eq(column, value) {
          call.filters[column] = value;
          return builder;
        },
        in(column, values) {
          call.filters[column] = values;
          return builder;
        },
        select() {
          supabaseState.calls.push(call);
          return Promise.resolve(supabaseState.responses[table] || { data: [], error: null });
        }
      };

      return builder;
    }
  }
}));

import { transferCourseOwnership } from './adminService';

const OLD_TEACHER = '11111111-1111-1111-1111-111111111111';
const NEW_TEACHER = '22222222-2222-2222-2222-222222222222';
const COURSE = {
  id: '33333333-3333-3333-3333-333333333333',
  databaseId: '33333333-3333-3333-3333-333333333333',
  slug: 'tieng-anh-giao-tiep',
  title: 'Tiếng Anh giao tiếp',
  teacherId: OLD_TEACHER
};

function findCall(table) {
  return supabaseState.calls.find((call) => call.table === table);
}

beforeEach(() => {
  localStorage.clear();
  supabaseState.ready = true;
  supabaseState.calls = [];
  supabaseState.responses = {
    courses: { data: [{ id: COURSE.databaseId }], error: null },
    exams: { data: [{ id: 'exam-1' }], error: null },
    lesson_assignments: { data: [{ id: 'assignment-1' }], error: null }
  };
});

describe('transferCourseOwnership', () => {
  it('đổi giảng viên phụ trách của khóa được chọn', async () => {
    const summary = await transferCourseOwnership({
      courses: [COURSE],
      fromTeacherId: OLD_TEACHER,
      toTeacherId: NEW_TEACHER
    });

    const courseCall = findCall('courses');

    expect(courseCall.payload.teacher_id).toBe(NEW_TEACHER);
    expect(courseCall.filters.id).toEqual([COURSE.databaseId]);
    expect(summary.courses).toBe(1);
  });

  it('chuyển kèm đề thi và bài tập của khóa, chỉ lấy dữ liệu của chủ cũ', async () => {
    const summary = await transferCourseOwnership({
      courses: [COURSE],
      fromTeacherId: OLD_TEACHER,
      toTeacherId: NEW_TEACHER,
      includeExams: true,
      includeAssignments: true
    });

    const examCall = findCall('exams');
    const assignmentCall = findCall('lesson_assignments');

    expect(examCall.payload.teacher_id).toBe(NEW_TEACHER);
    expect(examCall.filters.teacher_id).toBe(OLD_TEACHER);
    // course_key được ghi lúc tạo có thể là uuid hoặc slug, nên phải dò cả hai.
    expect(examCall.filters.course_key).toEqual(expect.arrayContaining([COURSE.databaseId, COURSE.slug]));
    expect(assignmentCall.filters.teacher_id).toBe(OLD_TEACHER);
    expect(summary).toMatchObject({ courses: 1, exams: 1, assignments: 1 });
  });

  it('bỏ qua đề thi và bài tập khi khóa chưa từng gắn giảng viên', async () => {
    await transferCourseOwnership({
      courses: [{ ...COURSE, teacherId: '' }],
      fromTeacherId: '',
      toTeacherId: NEW_TEACHER,
      includeExams: true,
      includeAssignments: true
    });

    expect(findCall('exams')).toBeUndefined();
    expect(findCall('lesson_assignments')).toBeUndefined();
  });

  it('báo lỗi khi RLS chặn (không dòng nào đổi được) thay vì báo thành công', async () => {
    supabaseState.responses.courses = { data: [], error: null };

    await expect(
      transferCourseOwnership({
        courses: [COURSE],
        fromTeacherId: OLD_TEACHER,
        toTeacherId: NEW_TEACHER
      })
    ).rejects.toThrow(/role admin/i);
  });

  it('từ chối bàn giao cho chính giảng viên đang phụ trách', async () => {
    await expect(
      transferCourseOwnership({
        courses: [COURSE],
        fromTeacherId: OLD_TEACHER,
        toTeacherId: OLD_TEACHER
      })
    ).rejects.toThrow(/khác giảng viên/i);

    expect(supabaseState.calls).toHaveLength(0);
  });

  it('vẫn cập nhật cache local khi chưa cấu hình Supabase', async () => {
    supabaseState.ready = false;
    localStorage.setItem(
      'admin-dashboard-state-v1',
      JSON.stringify({ courses: [{ ...COURSE }], lessons: [], profiles: [], orders: [], progress: [] })
    );

    const summary = await transferCourseOwnership({
      courses: [COURSE],
      fromTeacherId: OLD_TEACHER,
      toTeacherId: NEW_TEACHER
    });

    const storedCourses = JSON.parse(localStorage.getItem('admin-dashboard-state-v1')).courses;

    expect(summary.courses).toBe(1);
    expect(storedCourses[0].teacherId).toBe(NEW_TEACHER);
  });
});
