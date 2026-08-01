import { supabase, isSupabaseReady } from './supabase';

// Mỗi tài khoản học viên chỉ được đăng nhập trên một thiết bị. Bảng
// `active_device_sessions` giữ đúng một dòng cho mỗi user = thiết bị đang được
// quyền dùng; máy nào đọc thấy dòng đó mang device_id lạ thì tự đăng xuất.
//
// Điểm mấu chốt: chỉ lúc VỪA ĐĂNG NHẬP mới được ghi đè chỗ. Nếu mở lại app cũng
// ghi đè thì máy cũ chỉ cần F5 là cướp lại chỗ của máy mới, hai máy đá qua đá
// lại vô tận.

const DEVICE_ID_STORAGE_KEY = 'ngoaingu3k-device-id';
const DEVICE_SESSIONS_TABLE = 'active_device_sessions';

function createDeviceId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Trình duyệt cũ không có crypto.randomUUID — id chỉ cần đủ khác nhau giữa
  // các máy, không dùng cho mục đích bảo mật.
  return `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Id của trình duyệt này, sinh một lần rồi dùng mãi. Cùng một trình duyệt (kể
 * cả nhiều tab) là một thiết bị; cửa sổ ẩn danh tính là máy khác.
 */
export function getOrCreateDeviceId() {
  try {
    const stored = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (stored) {
      return stored;
    }

    const nextId = createDeviceId();
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, nextId);
    return nextId;
  } catch {
    // Trình duyệt chặn localStorage: vẫn trả về một id dùng được trong phiên
    // này, chỉ là lần mở sau sẽ khác.
    return createDeviceId();
  }
}

/** Nhãn dễ đọc để admin tra khi học viên khiếu nại. */
export function describeDevice(userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent) {
  const agent = String(userAgent || '');
  const browser =
    (/Edg\//.test(agent) && 'Edge') ||
    (/OPR\//.test(agent) && 'Opera') ||
    (/Chrome\//.test(agent) && 'Chrome') ||
    (/Firefox\//.test(agent) && 'Firefox') ||
    (/Safari\//.test(agent) && 'Safari') ||
    'Trình duyệt';
  const platform =
    (/Windows/.test(agent) && 'Windows') ||
    (/Android/.test(agent) && 'Android') ||
    (/iPhone|iPad/.test(agent) && 'iOS') ||
    (/Mac OS X/.test(agent) && 'macOS') ||
    (/Linux/.test(agent) && 'Linux') ||
    'thiết bị không rõ';

  return `${browser} trên ${platform}`;
}

/**
 * Đọc dòng giữ chỗ rồi quyết định làm gì.
 * - `ok`: chỗ đang là máy này, cứ học tiếp.
 * - `claim`: chưa có dòng nào (bảng mới tạo, hoặc vừa đăng xuất) → máy này nhận
 *   chỗ, để lần đầu triển khai không đá sạch người đang đăng nhập.
 * - `kick`: chỗ đã sang máy khác → máy này phải đăng xuất.
 *
 * Hàm thuần, tách riêng để test được mà không cần Supabase.
 */
export function decideDeviceSlotAction({ row, deviceId }) {
  if (!row?.device_id) {
    return 'claim';
  }
  return row.device_id === deviceId ? 'ok' : 'kick';
}

/** Ghi đè chỗ bằng máy này — chỉ gọi khi vừa đăng nhập thành công. */
export async function claimDeviceSlot(userId) {
  if (!isSupabaseReady() || !userId) {
    return null;
  }

  const deviceId = getOrCreateDeviceId();

  try {
    const { error } = await supabase.from(DEVICE_SESSIONS_TABLE).upsert(
      {
        user_id: userId,
        device_id: deviceId,
        device_label: describeDevice(),
        claimed_at: new Date().toISOString()
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      console.warn('[claimDeviceSlot]', error.message);
      return null;
    }

    return deviceId;
  } catch (err) {
    console.warn('[claimDeviceSlot]', err.message);
    return null;
  }
}

/**
 * Kiểm tra chỗ của máy này. Trả về `'ok' | 'claim' | 'kick'`, hoặc `null` khi
 * không đọc được (mất mạng, bảng chưa tạo) — gọi ở nơi dùng phải coi `null` là
 * "chưa biết" và KHÔNG đăng xuất, tránh đá nhầm người vì mạng chập chờn.
 */
export async function checkDeviceSlot(userId) {
  if (!isSupabaseReady() || !userId) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from(DEVICE_SESSIONS_TABLE)
      .select('device_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[checkDeviceSlot]', error.message);
      return null;
    }

    const action = decideDeviceSlotAction({ row: data, deviceId: getOrCreateDeviceId() });
    if (action === 'claim') {
      await claimDeviceSlot(userId);
    }

    return action;
  } catch (err) {
    console.warn('[checkDeviceSlot]', err.message);
    return null;
  }
}

/**
 * Nhả chỗ khi đăng xuất chủ động. Ràng thêm device_id để không xóa nhầm chỗ mà
 * một máy khác vừa giành được.
 */
export async function releaseDeviceSlot(userId) {
  if (!isSupabaseReady() || !userId) {
    return;
  }

  try {
    await supabase
      .from(DEVICE_SESSIONS_TABLE)
      .delete()
      .eq('user_id', userId)
      .eq('device_id', getOrCreateDeviceId());
  } catch (err) {
    console.warn('[releaseDeviceSlot]', err.message);
  }
}
