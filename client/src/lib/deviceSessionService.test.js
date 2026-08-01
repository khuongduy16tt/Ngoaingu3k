import { describe, it, expect, beforeEach } from 'vitest';
import { decideDeviceSlotAction, describeDevice, getOrCreateDeviceId } from './deviceSessionService';

// Mỗi tài khoản học viên chỉ giữ một chỗ thiết bị. Phần quyết định "ở lại hay bị
// đá" là hàm thuần nên test được mà không cần Supabase.

describe('decideDeviceSlotAction', () => {
  it('chỗ đang là máy này thì học tiếp', () => {
    expect(decideDeviceSlotAction({ row: { device_id: 'device-a' }, deviceId: 'device-a' })).toBe('ok');
  });

  it('chỗ đã sang máy khác thì bị đá', () => {
    expect(decideDeviceSlotAction({ row: { device_id: 'device-b' }, deviceId: 'device-a' })).toBe('kick');
  });

  it('chưa có dòng nào thì máy này nhận chỗ', () => {
    // Lần đầu triển khai (bảng còn rỗng) không được đá sạch người đang đăng nhập.
    expect(decideDeviceSlotAction({ row: null, deviceId: 'device-a' })).toBe('claim');
    expect(decideDeviceSlotAction({ row: {}, deviceId: 'device-a' })).toBe('claim');
  });
});

describe('getOrCreateDeviceId', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('giữ nguyên id qua nhiều lần gọi', () => {
    const first = getOrCreateDeviceId();
    expect(first).toBeTruthy();
    expect(getOrCreateDeviceId()).toBe(first);
  });

  it('sinh id mới khi trình duyệt bị xóa dữ liệu', () => {
    const first = getOrCreateDeviceId();
    localStorage.clear();
    expect(getOrCreateDeviceId()).not.toBe(first);
  });
});

describe('describeDevice', () => {
  it('đọc ra tên trình duyệt và hệ điều hành', () => {
    const chromeOnWindows =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    expect(describeDevice(chromeOnWindows)).toBe('Chrome trên Windows');
  });

  it('Edge không bị nhận nhầm thành Chrome', () => {
    const edge =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
    expect(describeDevice(edge)).toBe('Edge trên Windows');
  });

  it('không đoán được thì vẫn trả về nhãn dùng được', () => {
    expect(describeDevice('')).toBe('Trình duyệt trên thiết bị không rõ');
  });
});
