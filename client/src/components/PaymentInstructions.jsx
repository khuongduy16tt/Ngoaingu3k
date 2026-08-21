import React, { useEffect, useState } from 'react';
import { formatVnd } from '../lib/money';

const statusText = {
  pending_payment: 'Đang chờ chuyển khoản',
  pending: 'Đang chờ chuyển khoản',
  paid: 'Đã thanh toán — khóa học đã mở',
  failed: 'Thanh toán thất bại',
  cancelled: 'Đơn đã hủy'
};

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
    } catch {
      // Trình duyệt chặn clipboard thì học viên vẫn đọc được số trên màn hình.
    }
  }

  return (
    <div>
      <span>{label}</span>
      <div className="payment-copy-row">
        <strong>{value}</strong>
        <button type="button" className="payment-copy-button" onClick={handleCopy}>
          {copied ? 'Đã chép' : 'Chép'}
        </button>
      </div>
    </div>
  );
}

export function PaymentInstructions({
  order,
  checking = false,
  onCheckNow,
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

  const paid = order.status === 'paid';

  const content = (
    <section className={`content-card content-card--enterprise payment-instructions ${isOverlay ? 'payment-instructions--overlay' : ''}`}>
      <div className="payment-instructions__head">
        <div>
          <span className="eyebrow">Thanh toán tự động qua SePay</span>
          <h3>{order.courseTitle}</h3>
          <p>{statusText[order.status] || 'Đang chờ chuyển khoản'}</p>
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
            <img src={order.qrImageUrl} alt="Mã QR thanh toán SePay" />
          ) : (
            <div>
              <strong>QR</strong>
              <span>Chưa cấu hình tài khoản SePay (SEPAY_ACCOUNT_NUMBER, SEPAY_BANK_CODE)</span>
            </div>
          )}
        </div>

        <div className="payment-detail-list">
          <div>
            <span>Số tiền</span>
            <strong>{formatVnd(order.amount)}</strong>
          </div>
          <CopyField label="Nội dung chuyển khoản (bắt buộc giữ nguyên)" value={order.transferCode} />
          {order.accountNumber ? (
            <CopyField label={`Số tài khoản${order.bankCode ? ` · ${order.bankCode}` : ''}`} value={order.accountNumber} />
          ) : null}
          {order.accountName ? (
            <div>
              <span>Chủ tài khoản</span>
              <strong>{order.accountName}</strong>
            </div>
          ) : null}
        </div>
      </div>

      {paid ? (
        <p className="empty-state">Đã nhận được tiền. Khóa học đã mở, học viên vào phòng học được ngay.</p>
      ) : (
        <div className="payment-instructions__waiting">
          <div className="payment-instructions__waiting-row">
            <span className="payment-waiting-dot" aria-hidden="true" />
            <span>{checking ? 'Đang kiểm tra giao dịch...' : 'Đang chờ tiền về'}</span>
            {onCheckNow ? (
              <button type="button" className="button-ghost" onClick={onCheckNow} disabled={checking}>
                Kiểm tra ngay
              </button>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );

  if (!isOverlay) {
    return content;
  }

  return (
    <div className="payment-screen" role="dialog" aria-modal="true" aria-label="Thanh toán qua SePay">
      <button type="button" className="payment-screen__backdrop" onClick={onClose} aria-label="Đóng hướng dẫn thanh toán" />
      <div className="payment-screen__panel">
        {content}
      </div>
    </div>
  );
}
