import { useEffect, useRef } from 'react';

// NOTE: Luồng SePay tự động tạm thời bị tắt. Admin duyệt tay là luồng chính.
// Hook này được giữ lại để tương thích với các trang đang import — không làm gì.

/**
 * @param {{ order: object|null, active: boolean, onCheck: (order: object) => void }} params
 */
// eslint-disable-next-line no-unused-vars
export function usePaymentStatusPolling({ order, active, onCheck }) {
  // Giữ ref để tránh warning "unused vars" từ ESLint khi codebase tham chiếu hook này.
  const orderRef = useRef(order);
  const checkRef = useRef(onCheck);

  useEffect(() => { orderRef.current = order; }, [order]);
  useEffect(() => { checkRef.current = onCheck; }, [onCheck]);

  // Polling bị vô hiệu hoá — không setInterval, không gọi server.
}
