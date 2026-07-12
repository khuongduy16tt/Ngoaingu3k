import React, { useEffect } from 'react';
import { formatVnd } from '../lib/money';

const statusText = {
  pending_payment: 'Chờ học viên chuyển khoản',
  pending: 'Chờ học viên chuyển khoản',
  awaiting_admin: 'Đã xác nhận chuyển khoản, chờ admin mở khóa',
  paid: 'Đã mở khóa',
  failed: 'Thanh toán thất bại'
};

export function PaymentInstructions({
  order,
  confirming = false,
  onConfirm,
  variant = 'card',
  open = true,
  onClose
}) {
  const isOverlay = variant === 'overlay';

  useEffect(() => {
    if (!isOverlay || !open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose?.();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOverlay, onClose, open]);

  if (!order) return null;
  if (isOverlay && !open) return null;

  const awaitingAdmin = order.status === 'awaiting_admin';
  const paid = order.status === 'paid';

  const content = (
    <section className={`content-card content-card--enterprise payment-instructions ${isOverlay ? 'payment-instructions--overlay' : ''}`}>
      <div className="payment-instructions__head">
        <div>
          <span className="eyebrow">Thanh toán chuyển khoản</span>
          <h3>{order.courseTitle}</h3>
          <p>{statusText[order.status] || 'Chờ thanh toán'}</p>
        </div>
        {onClose ? (
          <button type="button" className="payment-instructions__close" onClick={onClose} aria-label="Đóng hướng dẫn thanh toán">
            ×
          </button>
        ) : null}
      </div>

      <div className="payment-instructions__body">
        <div className="payment-qr-box">
          {order.qrImageUrl ? (
            <img src={order.qrImageUrl} alt="Mã QR thanh toán" />
          ) : (
            <div>
              <strong>QR</strong>
              <span>Sẽ cập nhật ảnh QR tại biến VITE_PAYMENT_QR_URL</span>
            </div>
          )}
        </div>

        <div className="payment-detail-list">
          <div>
            <span>Số tiền</span>
            <strong>{formatVnd(order.amount)}</strong>
          </div>
          <div>
            <span>Nội dung chuyển khoản</span>
            <strong>{order.transferCode}</strong>
          </div>
          <div>
            <span>Học viên</span>
            <strong>{order.studentEmail || order.studentName || 'Tài khoản hiện tại'}</strong>
          </div>
        </div>
      </div>

      {paid ? (
        <p className="empty-state">Khóa học đã được mở, học viên có thể vào phòng học.</p>
      ) : awaitingAdmin ? (
        <p className="empty-state">Admin đã nhận yêu cầu. Khóa học sẽ được mở sau khi kế toán kiểm tra giao dịch.</p>
      ) : (
        <button type="button" className="button" onClick={onConfirm} disabled={confirming}>
          {confirming ? 'Đang gửi xác nhận...' : 'Tôi đã chuyển khoản'}
        </button>
      )}
    </section>
  );

  if (!isOverlay) {
    return content;
  }

  return (
    <div className="payment-screen" role="dialog" aria-modal="true" aria-label="Thanh toán chuyển khoản">
      <button type="button" className="payment-screen__backdrop" onClick={onClose} aria-label="Đóng hướng dẫn thanh toán" />
      <div className="payment-screen__panel">
        {content}
      </div>
    </div>
  );
}
