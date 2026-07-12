import { formatVnd, normalizeVndAmount } from './money';
import { grantPurchasedCourseId } from './purchaseStorage';

const PAYMENT_ORDERS_STORAGE_KEY = 'learning-payment-orders-v1';
const PAYMENT_QR_URL = import.meta.env.VITE_PAYMENT_QR_URL || '';

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

function makeTransferCode(orderId) {
  return `NN3K-${String(orderId || Date.now()).slice(-8).toUpperCase()}`;
}

export function readPaymentOrders() {
  const orders = readStoredJson(PAYMENT_ORDERS_STORAGE_KEY, []);
  return Array.isArray(orders) ? orders : [];
}

export function upsertPaymentOrder(order) {
  if (!order?.id) return null;
  const orders = readPaymentOrders();
  const nextOrder = {
    ...order,
    amount: normalizeVndAmount(order.amount),
    qrImageUrl: order.qrImageUrl || PAYMENT_QR_URL,
    transferCode: order.transferCode || makeTransferCode(order.id),
    updatedAt: new Date().toISOString()
  };

  writePaymentOrders([
    nextOrder,
    ...orders.filter((item) => item.id !== nextOrder.id)
  ]);

  return nextOrder;
}

export function createManualPaymentOrder({ course, user, remoteOrder = {} }) {
  const orderId = remoteOrder.orderId || remoteOrder.id || `local-payment-${Date.now()}`;
  return upsertPaymentOrder({
    id: orderId,
    userId: user?.id || 'local',
    studentEmail: user?.email || '',
    studentName: user?.user_metadata?.full_name || user?.email || 'Học viên',
    courseId: course.databaseId || course.id,
    localCourseId: course.id,
    courseTitle: course.title,
    amount: remoteOrder.amount ?? course.priceValue ?? course.price ?? 0,
    amountLabel: formatVnd(remoteOrder.amount ?? course.priceValue ?? course.price ?? 0),
    status: remoteOrder.status || 'pending_payment',
    provider: 'manual-bank-transfer',
    transferCode: remoteOrder.transferCode || makeTransferCode(orderId),
    qrImageUrl: remoteOrder.qrImageUrl || PAYMENT_QR_URL,
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

export function confirmManualPaymentTransfer(orderId, updates = {}) {
  const order = readPaymentOrders().find((item) => item.id === orderId);
  if (!order) return null;

  return upsertPaymentOrder({
    ...order,
    ...updates,
    status: 'awaiting_admin',
    confirmedAt: updates.confirmedAt || new Date().toISOString(),
    adminEmailQueuedAt: updates.adminEmailQueuedAt || new Date().toISOString()
  });
}

export function approveManualPaymentOrder(orderId) {
  const order = readPaymentOrders().find((item) => item.id === orderId);
  if (!order) return null;

  const nextOrder = upsertPaymentOrder({
    ...order,
    status: 'paid',
    approvedAt: new Date().toISOString()
  });

  grantPurchasedCourseId(nextOrder.userId, nextOrder.localCourseId || nextOrder.courseId);
  return nextOrder;
}
