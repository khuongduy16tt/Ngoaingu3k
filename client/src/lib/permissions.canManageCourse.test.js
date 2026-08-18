import { describe, expect, it } from 'vitest';
import { canManageCourse } from './permissions';

// Quy tắc quyết định phòng học có hiện nút "Sửa bài" và có cho kéo thả hay
// không. Đây là lớp giao diện; server và RLS vẫn kiểm lại. Nhưng nếu hàm này sai
// theo hướng nới ra thì giảng viên sẽ thấy nút sửa trên khóa của người khác rồi
// bấm vào và bị API từ chối — trải nghiệm tệ và lộ ra khóa đó tồn tại.

const GV_A = 'gv-a';
const GV_B = 'gv-b';
const khoaCuaA = { id: 'k1', teacherId: GV_A };

describe('canManageCourse', () => {
  it('admin quản được mọi khóa, kể cả khóa chưa gắn giảng viên', () => {
    expect(canManageCourse({ role: 'admin', userId: 'bat-ky', course: khoaCuaA })).toBe(true);
    expect(canManageCourse({ role: 'admin', userId: 'bat-ky', course: { id: 'k9' } })).toBe(true);
  });

  it('giảng viên quản được đúng khóa mình phụ trách', () => {
    expect(canManageCourse({ role: 'teacher', userId: GV_A, course: khoaCuaA })).toBe(true);
  });

  it('CHẶN giảng viên với khóa của người khác', () => {
    expect(canManageCourse({ role: 'teacher', userId: GV_B, course: khoaCuaA })).toBe(false);
  });

  it('CHẶN học viên và người chưa đăng nhập', () => {
    expect(canManageCourse({ role: 'student', userId: GV_A, course: khoaCuaA })).toBe(false);
    expect(canManageCourse({ role: '', userId: '', course: khoaCuaA })).toBe(false);
    expect(canManageCourse()).toBe(false);
  });

  it('CHẶN khi khóa chưa gắn giảng viên — không mở cho mọi giảng viên cùng sửa', () => {
    expect(canManageCourse({ role: 'teacher', userId: GV_A, course: { id: 'k9' } })).toBe(false);
    expect(canManageCourse({ role: 'teacher', userId: GV_A, course: { id: 'k9', teacherId: '' } })).toBe(false);
  });

  it('CHẶN khi chưa biết người dùng là ai, dù khóa cũng thiếu chủ', () => {
    // Hai giá trị cùng rỗng không được coi là "khớp nhau".
    expect(canManageCourse({ role: 'teacher', userId: '', course: { teacherId: '' } })).toBe(false);
    expect(canManageCourse({ role: 'teacher', userId: undefined, course: { teacherId: undefined } })).toBe(false);
  });

  it('đọc được cả teacher_id kiểu snake_case từ Supabase', () => {
    expect(canManageCourse({ role: 'teacher', userId: GV_A, course: { teacher_id: GV_A } })).toBe(true);
    expect(canManageCourse({ role: 'teacher', userId: GV_B, course: { teacher_id: GV_A } })).toBe(false);
  });

  it('không có khóa thì không quản được (trừ admin)', () => {
    expect(canManageCourse({ role: 'teacher', userId: GV_A, course: null })).toBe(false);
  });
});
