import React from 'react';
import { formatVnd } from '../lib/money';

const statusText = {
  pending_payment: 'Chờ học viên chuyển khoản',
  pending: 'Chờ học viên chuyển khoản',
  awaiting_admin: 'Đã xác nhận chuyển khoản, chờ admin mở khóa',
  paid: 'Đã mở khóa',
  failed: 'Thanh toán thất bại'
};

export function PaymentInstructions({ order, confirming = false, onConfirm }) {
  if (!order) return null;

  const awaitingAdmin = order.status === 'awaiting_admin';
  const paid = order.status === 'paid';

  return (
    <section className="content-card content-card--enterprise payment-instructions">
      <div>
        <span className="eyebrow">Thanh toán chuyển khoản</span>
        <h3>{order.courseTitle}</h3>
        <p>{statusText[order.status] || 'Chờ thanh toán'}</p>
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
}
