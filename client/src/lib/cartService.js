import { useEffect, useState } from 'react';
import { apiFetch } from './api';
import { isSupabaseReady } from './supabase';
import { logActivity } from './activityService';
import { createLocalCartPaymentOrder, upsertPaymentOrder } from './paymentService';
import { getPurchasedCourseIds, setPurchasedCourseIds } from './purchaseStorage';

// Giỏ hàng nằm trong trình duyệt: khách chưa đăng nhập vẫn bỏ khóa vào giỏ được,
// đăng nhập xong vào giỏ thanh toán tiếp. Chỉ lưu khóa nào + gói nào; giá luôn
// đọc lại từ danh mục (và server tính lại lần nữa khi thanh toán).
const CART_STORAGE_KEY = 'learning-cart-v1';
export const CART_UPDATED_EVENT = 'cart-updated';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeItems(items) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  return items
    .filter((item) => item && item.courseId && !seen.has(item.courseId) && seen.add(item.courseId))
    .map((item) => ({
      courseId: String(item.courseId),
      withTutoring: Boolean(item.withTutoring),
      addedAt: item.addedAt || new Date().toISOString()
    }));
}

export function readCart() {
  try {
    return sanitizeItems(JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]'));
  } catch {
    return [];
  }
}

function writeCart(items) {
  const next = sanitizeItems(items);
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Trình duyệt chặn bộ nhớ: giỏ vẫn đúng trong phiên này qua sự kiện bên dưới.
  }
  window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT, { detail: next }));
  return next;
}

export function isInCart(courseId) {
  return readCart().some((item) => item.courseId === courseId);
}

/** Thêm khóa vào giỏ; khóa đã có trong giỏ thì chỉ cập nhật gói. */
export function addToCart(courseId, withTutoring = false) {
  const items = readCart();
  const existing = items.find((item) => item.courseId === courseId);
  if (existing) {
    return writeCart(items.map((item) => (item.courseId === courseId ? { ...item, withTutoring } : item)));
  }
  return writeCart([...items, { courseId, withTutoring }]);
}

export function removeFromCart(courseIds) {
  const drop = new Set([].concat(courseIds).map(String));
  return writeCart(readCart().filter((item) => !drop.has(item.courseId)));
}

export function setCartItemTutoring(courseId, withTutoring) {
  return writeCart(readCart().map((item) => (item.courseId === courseId ? { ...item, withTutoring } : item)));
}

export function clearCart() {
  return writeCart([]);
}

/** Giỏ hàng luôn đồng bộ giữa header, thẻ khóa học và trang giỏ (cả các tab khác). */
export function useCart() {
  const [items, setItems] = useState(readCart);

  useEffect(() => {
    const sync = () => setItems(readCart());
    const onStorage = (event) => {
      if (event.key === CART_STORAGE_KEY) sync();
    };
    window.addEventListener(CART_UPDATED_EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return items;
}

/**
 * Báo giá một dòng trong giỏ — cùng quy tắc với server (quoteCoursePurchase):
 * đã có khóa thì chỉ tính được phần nâng cấp dạy kèm; đã có cả dạy kèm thì bỏ.
 *
 * @param {object} course — khóa trong danh mục (priceValue, tutoringPriceValue)
 * @param {boolean} withTutoring
 * @param {'course'|'tutoring'|undefined} owned
 * @returns {{ amount: number, alreadyOwned: boolean, isUpgrade: boolean }}
 */
export function quoteCartLine(course, withTutoring, owned) {
  const price = Math.max(Math.round(Number(course?.priceValue) || 0), 0);
  const tutoringPrice = Math.max(Math.round(Number(course?.tutoringPriceValue) || 0), 0);

  if (!withTutoring || !tutoringPrice) {
    return { amount: price, alreadyOwned: Boolean(owned), isUpgrade: false };
  }
  if (owned === 'tutoring') {
    return { amount: 0, alreadyOwned: true, isUpgrade: false };
  }
  if (owned === 'course') {
    return { amount: Math.max(tutoringPrice - price, 0), alreadyOwned: false, isUpgrade: true };
  }
  return { amount: tutoringPrice, alreadyOwned: false, isUpgrade: false };
}

function cartTitle(lines) {
  if (lines.length === 1) {
    const [line] = lines;
    return line.withTutoring ? `${line.course.title} + dạy kèm` : line.course.title;
  }
  return `Giỏ hàng · ${lines.length} khóa học`;
}

/**
 * Thanh toán giỏ hàng: một đơn, một mã chuyển khoản cho mọi khóa trong giỏ.
 *
 * @param {{ lines: Array<{ course: object, withTutoring: boolean, amount: number }>,
 *   userId: string, accessToken: string, user: object }} params
 * @returns {Promise<{ order: object|null, requiresPayment: boolean, ownedCourseIds?: string[] }>}
 */
export async function checkoutCart({ lines, userId, accessToken, user }) {
  if (!lines?.length) {
    throw new Error('Giỏ hàng đang trống.');
  }

  const title = cartTitle(lines);
  // Khóa trong danh mục có 2 id (slug + uuid); lưu cả hai để trang nào cũng nhận ra.
  const unlockIdsFor = (databaseIds) =>
    lines
      .filter((line) => databaseIds.includes(String(line.course.databaseId || line.course.id)))
      .flatMap((line) => [line.course.id, line.course.databaseId].filter(Boolean));

  const canUseServer =
    isSupabaseReady() &&
    userId &&
    lines.every((line) => UUID_PATTERN.test(String(line.course.databaseId || line.course.id)));

  if (!canUseServer) {
    // Bản demo / khóa chưa đồng bộ lên server: đơn chỉ nằm trên máy, admin mở tay.
    const order = createLocalCartPaymentOrder({
      user: user || { id: userId || 'local' },
      title,
      amount: lines.reduce((sum, line) => sum + line.amount, 0),
      courseIds: lines.flatMap((line) => [line.course.id, line.course.databaseId].filter(Boolean)),
      lines: lines.map((line) => ({ id: line.course.id, withTutoring: line.withTutoring, amount: line.amount }))
    });
    return { order, requiresPayment: true };
  }

  if (!accessToken) {
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại trước khi thanh toán.');
  }

  const response = await apiFetch('/api/payments/checkout-cart', {
    method: 'POST',
    token: accessToken,
    body: {
      items: lines.map((line) => ({
        courseId: line.course.databaseId || line.course.id,
        withTutoring: line.withTutoring
      }))
    }
  });

  if (response.status === 'paid') {
    const ownedIds = Array.from(
      new Set([...getPurchasedCourseIds(userId), ...unlockIdsFor((response.courseIds || []).map(String))])
    );
    setPurchasedCourseIds(userId, ownedIds);
    return { order: null, requiresPayment: false, ownedCourseIds: ownedIds };
  }

  const paidLineIds = (response.courseIds || []).map(String);
  const order = upsertPaymentOrder({
    id: response.orderId,
    userId,
    studentEmail: user?.email || '',
    studentName: user?.user_metadata?.full_name || user?.email || 'Học viên',
    isCart: true,
    courseId: paidLineIds[0] || '',
    courseIds: unlockIdsFor(paidLineIds),
    lines: response.lines || [],
    courseTitle: title,
    amount: response.amount,
    status: response.status || 'pending',
    provider: 'sepay',
    transferCode: response.transferCode,
    qrImageUrl: response.qrImageUrl || '',
    bankCode: response.bankCode,
    accountNumber: response.accountNumber,
    accountName: response.accountName,
    createdAt: new Date().toISOString()
  });

  void logActivity(userId, 'purchase', response.orderId, title, {
    orderId: response.orderId,
    mode: response.mode,
    cart: true,
    status: order?.status
  });

  return { order, requiresPayment: true };
}
