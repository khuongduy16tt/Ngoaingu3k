import { useEffect, useRef } from 'react';

const POLL_INTERVAL_MS = 5000;
// Khách bỏ tab mở suốt buổi thì đừng hỏi server mãi — quá hạn này chỉ còn nút
// "Kiểm tra ngay" chạy tay.
const MAX_POLL_MS = 15 * 60 * 1000;

/**
 * Hỏi lại trạng thái đơn SePay theo nhịp trong lúc màn thanh toán đang mở, để
 * khóa học tự mở ngay sau khi tiền về mà học viên không phải bấm gì.
 *
 * @param {{ order: object|null, active: boolean, onCheck: (order: object) => void }} params
 */
export function usePaymentStatusPolling({ order, active, onCheck }) {
  // Nhịp hỏi phải nhìn thấy đơn mới nhất mà không phải dựng lại interval sau mỗi lần hỏi.
  const orderRef = useRef(order);
  const checkRef = useRef(onCheck);

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  useEffect(() => {
    checkRef.current = onCheck;
  }, [onCheck]);

  const orderId = order?.id;
  const status = order?.status;

  useEffect(() => {
    // Đơn tạo offline (bản demo không có server) không có gì để hỏi — hỏi vòng
    // vòng chỉ làm dòng "đang kiểm tra" nhấp nháy vô ích.
    const isLocalOnlyOrder = String(orderId || '').startsWith('local-payment-');

    if (!active || !orderId || isLocalOnlyOrder || status === 'paid' || status === 'failed') {
      return undefined;
    }

    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - startedAt > MAX_POLL_MS) {
        clearInterval(timer);
        return;
      }

      void checkRef.current?.(orderRef.current);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [active, orderId, status]);
}
