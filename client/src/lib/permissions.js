export const ROLE_ORDER = {
  student: 0,
  teacher: 1,
  admin: 2
};

export function getEffectiveRole(auth) {
  return auth?.profile?.role ?? auth?.role ?? 'student';
}

export function isRoleAllowed(currentRole, allowedRoles) {
  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }

  if (!currentRole) {
    return false;
  }

  return allowedRoles.includes(currentRole);
}

/**
 * Ai được sửa nội dung của một khóa: admin sửa mọi khóa, giảng viên chỉ sửa khóa
 * mình phụ trách, còn lại thì không.
 *
 * Đây chỉ là lớp quyết định GIAO DIỆN — ẩn nút cho đỡ rối mắt và tránh bấm vào
 * rồi bị API từ chối. Chốt chặn thật nằm ở route server (đối chiếu teacher_id)
 * và RLS của Supabase; đừng bao giờ coi hàm này là hàng rào.
 */
export function canManageCourse({ role, userId, course } = {}) {
  if (role === 'admin') {
    return true;
  }

  if (role !== 'teacher') {
    return false;
  }

  const teacherId = course?.teacherId ?? course?.teacher_id ?? '';

  // Thiếu một trong hai vế thì coi như không có quyền: khóa chưa gắn giảng viên
  // không được mở cho mọi giảng viên cùng sửa.
  return Boolean(userId) && Boolean(teacherId) && teacherId === userId;
}

export function getDashboardPathForRole(role) {
  if (role === 'teacher') {
    return '/dashboard/teacher';
  }

  if (role === 'admin') {
    return '/dashboard/admin';
  }

  return '/dashboard/student';
}
