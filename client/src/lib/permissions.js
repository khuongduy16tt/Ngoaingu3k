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

export function getDashboardPathForRole(role) {
  if (role === 'teacher') {
    return '/dashboard/teacher';
  }

  if (role === 'admin') {
    return '/dashboard/admin';
  }

  return '/dashboard/student';
}
