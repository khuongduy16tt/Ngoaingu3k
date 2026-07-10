import { describe, it, expect } from 'vitest';
import { getEffectiveRole, isRoleAllowed, getDashboardPathForRole, ROLE_ORDER } from './permissions';

describe('ROLE_ORDER', () => {
  it('defines student < teacher < admin', () => {
    expect(ROLE_ORDER.student).toBeLessThan(ROLE_ORDER.teacher);
    expect(ROLE_ORDER.teacher).toBeLessThan(ROLE_ORDER.admin);
  });
});

describe('getEffectiveRole', () => {
  it('returns profile role when available', () => {
    const auth = { profile: { role: 'teacher' }, role: 'student' };
    expect(getEffectiveRole(auth)).toBe('teacher');
  });

  it('falls back to auth.role when profile is null', () => {
    const auth = { profile: null, role: 'admin' };
    expect(getEffectiveRole(auth)).toBe('admin');
  });

  it('defaults to student when no role info exists', () => {
    expect(getEffectiveRole({})).toBe('student');
    expect(getEffectiveRole(null)).toBe('student');
    expect(getEffectiveRole(undefined)).toBe('student');
  });
});

describe('isRoleAllowed', () => {
  it('allows any role when allowedRoles is empty', () => {
    expect(isRoleAllowed('student', [])).toBe(true);
    expect(isRoleAllowed('admin', null)).toBe(true);
    expect(isRoleAllowed('teacher', undefined)).toBe(true);
  });

  it('returns true when role is in allowedRoles', () => {
    expect(isRoleAllowed('student', ['student', 'admin'])).toBe(true);
    expect(isRoleAllowed('admin', ['admin'])).toBe(true);
  });

  it('returns false when role is not in allowedRoles', () => {
    expect(isRoleAllowed('student', ['teacher', 'admin'])).toBe(false);
  });

  it('returns false when currentRole is falsy', () => {
    expect(isRoleAllowed(null, ['student'])).toBe(false);
    expect(isRoleAllowed('', ['student'])).toBe(false);
  });
});

describe('getDashboardPathForRole', () => {
  it('returns student path for student', () => {
    expect(getDashboardPathForRole('student')).toBe('/dashboard/student');
  });

  it('returns teacher path for teacher', () => {
    expect(getDashboardPathForRole('teacher')).toBe('/dashboard/teacher');
  });

  it('returns admin path for admin', () => {
    expect(getDashboardPathForRole('admin')).toBe('/dashboard/admin');
  });

  it('defaults to student path for unknown role', () => {
    expect(getDashboardPathForRole('unknown')).toBe('/dashboard/student');
    expect(getDashboardPathForRole(undefined)).toBe('/dashboard/student');
  });
});
