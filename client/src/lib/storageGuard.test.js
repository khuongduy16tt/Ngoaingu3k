import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authStorage, clearDisposableCaches, ensureStorageHeadroom, setItemWithEviction } from './storageGuard';

// Giả lập trình duyệt có hạn mức storage: vượt LIMIT ký tự thì ném QuotaExceededError.
const LIMIT = 1000;
function quotaError() {
  const error = new Error('quota');
  error.name = 'QuotaExceededError';
  return error;
}

describe('storageGuard', () => {
  let originalSetItem;

  beforeEach(() => {
    localStorage.clear();
    originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function setItem(key, value) {
      let used = 0;
      for (let i = 0; i < this.length; i += 1) {
        const k = this.key(i);
        if (k !== key) used += k.length + (this.getItem(k) || '').length;
      }
      if (used + key.length + String(value).length > LIMIT) throw quotaError();
      return originalSetItem.call(this, key, value);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('bộ nhớ đầy vì bộ đệm phòng học → vẫn lưu được phiên đăng nhập', () => {
    originalSetItem.call(localStorage, 'learning-room-cache-v1:teacher:hsk-1', 'x'.repeat(900));
    originalSetItem.call(localStorage, 'sb-demo-auth-token', '{"old":true}');

    authStorage.setItem('sb-demo-auth-token', JSON.stringify({ fresh: 'y'.repeat(200) }));

    expect(JSON.parse(localStorage.getItem('sb-demo-auth-token')).fresh).toHaveLength(200);
    expect(localStorage.getItem('learning-room-cache-v1:teacher:hsk-1')).toBeNull();
  });

  it('không xóa bản nháp khóa học của giảng viên', () => {
    originalSetItem.call(localStorage, 'teacher-managed-courses-v1:abc', 'd'.repeat(300));
    originalSetItem.call(localStorage, 'learning-room-cache-v1:x', 'c'.repeat(600));

    expect(setItemWithEviction('sb-demo-auth-token', 'z'.repeat(300))).toBe(true);
    expect(localStorage.getItem('teacher-managed-courses-v1:abc')).toHaveLength(300);
  });

  it('ensureStorageHeadroom dọn bộ đệm khi không còn chỗ, để yên khi còn chỗ', () => {
    expect(ensureStorageHeadroom(100)).toBe(false);
    originalSetItem.call(localStorage, 'learning-room-cache-v1:x', 'c'.repeat(950));
    expect(ensureStorageHeadroom(100)).toBe(true);
    expect(localStorage.getItem('learning-room-cache-v1:x')).toBeNull();
  });

  it('clearDisposableCaches chỉ xóa khóa bộ đệm', () => {
    originalSetItem.call(localStorage, 'learning-room-cache-v1:a', '1');
    originalSetItem.call(localStorage, 'theme', 'dark');
    expect(clearDisposableCaches()).toBe(1);
    expect(localStorage.getItem('theme')).toBe('dark');
  });
});
