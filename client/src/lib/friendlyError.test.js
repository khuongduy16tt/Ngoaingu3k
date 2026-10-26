import { describe, expect, it } from 'vitest';
import { toFriendlyError } from './friendlyError';

describe('toFriendlyError', () => {
  it('đổi lỗi mạng thành câu tiếng Việt', () => {
    expect(toFriendlyError(new TypeError('Failed to fetch'), 'dự phòng')).toBe(
      'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'
    );
  });

  it('đổi lỗi phân quyền của Supabase', () => {
    expect(
      toFriendlyError({ message: 'new row violates row-level security policy for table "courses"' }, 'dự phòng')
    ).toBe('Bạn không có quyền thực hiện thao tác này.');
  });

  it('giữ nguyên lỗi app đã viết bằng tiếng Việt', () => {
    expect(toFriendlyError(new Error('Khóa học chưa có chương nào.'), 'dự phòng')).toBe('Khóa học chưa có chương nào.');
  });

  it('lỗi tiếng Anh lạ thì dùng câu dự phòng', () => {
    expect(toFriendlyError(new Error('column "foo" does not exist'), 'Chưa lưu được.')).toBe('Chưa lưu được.');
  });

  it('không có lỗi thì dùng câu dự phòng', () => {
    expect(toFriendlyError(null, 'Chưa lưu được.')).toBe('Chưa lưu được.');
    expect(toFriendlyError(undefined)).toBe('Đã có lỗi xảy ra. Vui lòng thử lại.');
  });
});
