// localStorage chỉ có ~5–10MB cho cả site. Bộ đệm phòng học (vài MB mỗi khóa)
// từng lấp đầy chỗ đó → Supabase không ghi được phiên đăng nhập mới, trình
// duyệt giữ mãi phiên cũ đã bị thu hồi, nên cứ tải lại trang là bị đẩy về màn
// đăng nhập dù vừa đăng nhập xong. Module này đảm bảo phiên đăng nhập luôn
// được ưu tiên chỗ hơn bộ đệm.

// Chỉ những khóa dựng lại được từ server mới được xóa khi thiếu chỗ. Bản nháp
// khóa học của giảng viên (teacher-managed-courses-v1) là dữ liệu thật → không đụng.
const DISPOSABLE_CACHE_PREFIXES = ['learning-room-cache-v1:'];

function isQuotaError(error) {
  return (
    error?.name === 'QuotaExceededError' ||
    error?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error?.code === 22 ||
    error?.code === 1014
  );
}

export function clearDisposableCaches() {
  let removed = 0;
  try {
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (typeof key === 'string' && DISPOSABLE_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        keys.push(key);
      }
    }
    keys.forEach((key) => {
      localStorage.removeItem(key);
      removed += 1;
    });
  } catch {
    // Trình duyệt chặn storage: không có gì để dọn.
  }
  return removed;
}

// Ghi một giá trị quan trọng (phiên đăng nhập). Hết chỗ thì dọn bộ đệm rồi thử lại.
export function setItemWithEviction(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (!isQuotaError(error)) {
      return false;
    }
  }

  clearDisposableCaches();
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

// Gọi một lần khi mở app: nếu bộ nhớ đã đầy (không ghi nổi vài KB) thì dọn bộ
// đệm ngay, để những trình duyệt đang kẹt tự hồi phục mà người dùng không phải
// xóa dữ liệu trang web bằng tay.
export function ensureStorageHeadroom(probeBytes = 64 * 1024) {
  const probeKey = '__ngoaingu3k_storage_probe__';
  try {
    localStorage.setItem(probeKey, 'x'.repeat(probeBytes));
    localStorage.removeItem(probeKey);
    return false;
  } catch (error) {
    if (!isQuotaError(error)) {
      return false;
    }
  }
  return clearDisposableCaches() > 0;
}

// Storage adapter cho supabase-js: đọc/xóa như localStorage, ghi thì ưu tiên chỗ.
export const authStorage = {
  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    setItemWithEviction(key, value);
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
};
