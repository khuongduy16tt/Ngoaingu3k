import { describe, it, expect } from 'vitest';
import { buildPageTitle, ui } from './i18n';

describe('ui constants', () => {
  it('has Vietnamese sign-in label', () => {
    expect(ui.signIn).toBe('Đăng nhập');
  });

  it('has Vietnamese sign-out label', () => {
    expect(ui.signOut).toBe('Đăng xuất');
  });

  it('has error recovery strings', () => {
    expect(ui.errorTitle).toBeTruthy();
    expect(ui.errorMessage).toBeTruthy();
    expect(ui.reload).toBeTruthy();
  });
});

describe('buildPageTitle', () => {
  it('appends suffix to page title', () => {
    expect(buildPageTitle('Trang chủ')).toBe('Trang chủ | Ngoaingu3k Academy');
  });

  it('returns suffix only when no page title', () => {
    expect(buildPageTitle('')).toBe('Ngoaingu3k Academy');
    expect(buildPageTitle(null)).toBe('Ngoaingu3k Academy');
    expect(buildPageTitle(undefined)).toBe('Ngoaingu3k Academy');
  });
});
