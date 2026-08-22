import React, { useEffect, useState } from 'react';
import { formatVnd } from '../lib/money';

// ─── CẤU HÌNH QR & TÀI KHOẢN ─────────────────────────────────────────────────
//
//  1. Đặt file ảnh QR vào: client/public/payment-qr.png
//     rồi đổi dòng bên dưới thành: const STATIC_QR_URL = '/payment-qr.png';
//
//  2. Hoặc dùng URL CDN:   const STATIC_QR_URL = 'https://...';
//
//  Để trống → placeholder cho đến khi có ảnh thật.
//
const STATIC_QR_URL = '/payment-qr.png'; // ảnh đặt tại client/public/payment-qr.png

const BANK_INFO = {
  bankName:      'Vietcombank',
  accountNumber: '3227029999',
  accountName:   'CT TNHH GIAO DUC VA PHAT TRIEN HA NOI',
};
// ─────────────────────────────────────────────────────────────────────────────

const statusText = {
  pending_payment: 'Chờ admin xác nhận',
  pending: 'Chờ admin xác nhận',
  awaiting_admin: 'Chờ admin xác nhận',
  paid: 'Đã thanh toán — khóa học đã mở',
  failed: 'Thanh toán thất bại',
  cancelled: 'Đơn đã hủy',
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
      // Trình duyệt chặn clipboard → học viên vẫn đọc được số trên màn hình.
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
  // checking / onCheckNow vẫn nhận prop để không vỡ interface hiện tại.
  // eslint-disable-next-line no-unused-vars
  checking = false,
  // eslint-disable-next-line no-unused-vars
  onCheckNow,
  variant = 'card',
  open = true,
  onClose,
}) {
  const isOverlay = variant === 'overlay';

  useEffect(() => {
    if (!isOverlay || !open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose?.();
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
    <section
      className={`content-card content-card--enterprise payment-instructions${isOverlay ? ' payment-instructions--overlay' : ''
        }`}
    >
      {/* ── Header ── */}
      <div className="payment-instructions__head">
        <div>
          <span className="eyebrow">Thanh toán chuyển khoản</span>
          <h3>{order.courseTitle}</h3>
          <p>{statusText[order.status] || 'Chờ admin xác nhận'}</p>
        </div>
        {onClose ? (
          <button
            type="button"
            className="payment-instructions__close"
            onClick={onClose}
            aria-label="Đóng hướng dẫn thanh toán"
          >
            ×
          </button>
        ) : null}
      </div>

      {/* ── Body ── */}
      <div className="payment-instructions__body">
        {/* QR tĩnh */}
        <div className="payment-qr-box">
          {STATIC_QR_URL ? (
            <img src={STATIC_QR_URL} alt="Mã QR chuyển khoản" />
          ) : (
            <div
              style={{
                padding: '2rem 1.5rem',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                border: '2px dashed var(--border)',
                borderRadius: '0.75rem',
              }}
            >
              <strong style={{ display: 'block', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                QR
              </strong>
              <span style={{ fontSize: '0.85rem' }}>
                Ảnh QR sẽ được cập nhật sớm.
                <br />
                Vui lòng chuyển khoản theo thông tin bên dưới.
              </span>
            </div>
          )}
        </div>

        {/* Chi tiết tài khoản */}
        <div className="payment-detail-list">
          <div>
            <span>Số tiền</span>
            <strong>{formatVnd(order.amount)}</strong>
          </div>

          {order.transferCode ? (
            <CopyField
              label="Nội dung chuyển khoản (bắt buộc giữ nguyên)"
              value={order.transferCode}
            />
          ) : null}

          {BANK_INFO.accountNumber ? (
            <CopyField
              label={`Số tài khoản${BANK_INFO.bankName ? ` · ${BANK_INFO.bankName}` : ''}`}
              value={BANK_INFO.accountNumber}
            />
          ) : null}

          {BANK_INFO.accountName ? (
            <div>
              <span>Chủ tài khoản</span>
              <strong>{BANK_INFO.accountName}</strong>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Trạng thái ── */}
      {paid ? (
        <p className="empty-state">
          Đã xác nhận thanh toán. Khóa học đã mở, bạn vào học được ngay.
        </p>
      ) : (
        <div className="payment-instructions__waiting">
          <div className="payment-instructions__waiting-row">
            <span className="payment-waiting-dot" aria-hidden="true" />
            <span>
              Sau khi chuyển khoản, vui lòng chờ admin xác nhận
              (thường trong vài phút – vài giờ).
            </span>
          </div>
          <p
            style={{
              marginTop: '0.75rem',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
            }}
          >
            Khi admin xác nhận, khóa học sẽ tự động mở trong lần đăng nhập tiếp theo.
          </p>
        </div>
      )}
    </section>
  );

  if (!isOverlay) return content;

  return (
    <div
      className="payment-screen"
      role="dialog"
      aria-modal="true"
      aria-label="Thanh toán chuyển khoản"
    >
      <button
        type="button"
        className="payment-screen__backdrop"
        onClick={onClose}
        aria-label="Đóng hướng dẫn thanh toán"
      />
      <div className="payment-screen__panel">{content}</div>
    </div>
  );
}
