import { formatVnd, normalizeVndAmount } from './money';
import { grantPurchasedCourseId, revokePurchasedCourseId } from './purchaseStorage';

const PAYMENT_ORDERS_STORAGE_KEY = 'learning-payment-orders-v1';

// Dùng khi chạy bản demo không có server (không gọi được /api/payments) — server
// thật trả sẵn qrImageUrl nên không cần tới mấy biến này.
const SEPAY_ACCOUNT_NUMBER = import.meta.env.VITE_SEPAY_ACCOUNT_NUMBER || '';
const SEPAY_BANK_CODE = import.meta.env.VITE_SEPAY_BANK_CODE || '';
const SEPAY_ACCOUNT_NAME = import.meta.env.VITE_SEPAY_ACCOUNT_NAME || '';
const SEPAY_CODE_PREFIX = (import.meta.env.VITE_SEPAY_CODE_PREFIX || 'NN3K').toUpperCase();

// Bỏ I, O, S cho khỏi lẫn với 1, 0, 5 khi đọc mã.
const CODE_ALPHABET = '0123456789ABCDEFGHJKLMNPQRTUVWXYZ';

function readStoredJson(key, fallback) {
  try {
    const rawValue = localStorage.getItem(key);
    if (!rawValue) return fallback;
    return JSON.parse(rawValue) ?? fallback;
  } catch {
    return fallback;
  }
}

function writePaymentOrders(orders) {
  const nextOrders = Array.isArray(orders) ? orders : [];

  try {
    localStorage.setItem(PAYMENT_ORDERS_STORAGE_KEY, JSON.stringify(nextOrders));
    window.dispatchEvent(new CustomEvent('payment-orders-updated', { detail: nextOrders }));
  } catch {
    // ignore storage failures
  }

  return nextOrders;
}

function makeTransferCode() {
  let body = '';
  for (let index = 0; index < 6; index += 1) {
    body += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `${SEPAY_CODE_PREFIX}${body}`;
}

export function buildSepayQrUrl({ amount, transferCode }) {
  if (!SEPAY_ACCOUNT_NUMBER || !SEPAY_BANK_CODE || !transferCode) {
    return '';
  }

  const params = new URLSearchParams({
    acc: SEPAY_ACCOUNT_NUMBER,
    bank: SEPAY_BANK_CODE,
    amount: String(Math.round(Number(amount) || 0)),
    des: transferCode,
    template: 'compact'
  });

  return `https://qr.sepay.vn/img?${params.toString()}`;
}

export function readPaymentOrders() {
  const orders = readStoredJson(PAYMENT_ORDERS_STORAGE_KEY, []);
  return Array.isArray(orders) ? orders : [];
}

export function upsertPaymentOrder(order) {
  if (!order?.id) return null;
  const orders = readPaymentOrders();
  const amount = normalizeVndAmount(order.amount);
  // Không tự bịa mã ở đây: mã là do server (hoặc createSepayPaymentOrder cho
  // bản demo) cấp, upsert chỉ giữ nguyên mã sẵn có.
  const transferCode = order.transferCode || '';
  const nextOrder = {
    ...order,
    amount,
    amountLabel: formatVnd(amount),
    transferCode,
    qrImageUrl: order.qrImageUrl || buildSepayQrUrl({ amount, transferCode }),
    updatedAt: new Date().toISOString()
  };

  writePaymentOrders([
    nextOrder,
    ...orders.filter((item) => item.id !== nextOrder.id)
  ]);

  return nextOrder;
}

export function createSepayPaymentOrder({ course, user, remoteOrder = {} }) {
  const orderId = remoteOrder.orderId || remoteOrder.id || `local-payment-${Date.now()}`;
  const amount = remoteOrder.amount ?? course.priceValue ?? course.price ?? 0;

  return upsertPaymentOrder({
    id: orderId,
    userId: user?.id || 'local',
    studentEmail: user?.email || '',
    studentName: user?.user_metadata?.full_name || user?.email || 'Học viên',
    courseId: course.databaseId || course.id,
    localCourseId: course.id,
    courseTitle: course.title,
    amount,
    status: remoteOrder.status || 'pending',
    provider: 'sepay',
    transferCode: remoteOrder.transferCode || makeTransferCode(),
    qrImageUrl: remoteOrder.qrImageUrl || '',
    bankCode: remoteOrder.bankCode || SEPAY_BANK_CODE,
    accountNumber: remoteOrder.accountNumber || SEPAY_ACCOUNT_NUMBER,
    accountName: remoteOrder.accountName || SEPAY_ACCOUNT_NAME,
    createdAt: remoteOrder.createdAt || new Date().toISOString()
  });
}

export function findPaymentOrderForCourse(userId, courseId) {
  return readPaymentOrders().find(
    (order) =>
      order.userId === (userId || 'local') &&
      (order.localCourseId === courseId || order.courseId === courseId) &&
      order.status !== 'paid' &&
      order.status !== 'failed' &&
      order.status !== 'cancelled'
  );
}

/**
 * Ghi nhận đơn đã có tiền về (webhook SePay báo, hoặc admin mở khóa tay) và mở
 * khóa khóa học ngay trên máy học viên.
 */
export function markPaymentOrderPaid(orderId, updates = {}) {
  const order = readPaymentOrders().find((item) => item.id === orderId);
  if (!order) return null;

  const nextOrder = upsertPaymentOrder({
    ...order,
    ...updates,
    status: 'paid',
    paidAt: updates.paidAt || new Date().toISOString()
  });

  grantPurchasedCourseId(nextOrder.userId, nextOrder.localCourseId || nextOrder.courseId);
  return nextOrder;
}

export function approveManualPaymentOrder(orderId) {
  return markPaymentOrderPaid(orderId, { approvedAt: new Date().toISOString() });
}

export function revokeManualPaymentOrder(orderId) {
  const order = readPaymentOrders().find((item) => item.id === orderId);
  if (!order) return null;

  const nextOrder = upsertPaymentOrder({
    ...order,
    status: 'failed',
    revokedAt: new Date().toISOString()
  });

  revokePurchasedCourseId(nextOrder.userId, nextOrder.localCourseId || nextOrder.courseId);
  return nextOrder;
}
