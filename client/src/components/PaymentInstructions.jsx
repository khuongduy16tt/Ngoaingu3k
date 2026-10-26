import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { contact } from '../config/contact';
import { formatVnd } from '../lib/money';

// ─── TÀI KHOẢN DỰ PHÒNG ───────────────────────────────────────────────────────
// Server đã cấu hình SePay (SEPAY_ACCOUNT_NUMBER, SEPAY_BANK_CODE...) thì đơn
// trả về sẵn QR động + số tài khoản và các giá trị dưới đây không được dùng.
// Chưa cấu hình thì vẫn dựng QR VietQR động từ tài khoản này (quét là điền sẵn
// số tiền và nội dung), chỉ là phải chờ admin mở khóa tay.
const STATIC_QR_URL = '/payment-qr.png'; // dùng khi đơn không có mã chuyển khoản

const BANK_INFO = {
  bankName:      'Vietcombank',
  accountNumber: '3227029999',
  accountName:   'CT TNHH GIAO DUC VA PHAT TRIEN HA NOI',
};
// ─────────────────────────────────────────────────────────────────────────────

function buildFallbackQrUrl(order) {
  if (!order?.transferCode) return '';
  const params = new URLSearchParams({
    acc: BANK_INFO.accountNumber,
    bank: BANK_INFO.bankName,
    amount: String(Math.round(Number(order.amount) || 0)),
    des: order.transferCode,
    template: 'compact',
  });
  return `https://qr.sepay.vn/img?${params.toString()}`;
}

const statusText = {
  pending_payment: 'Đang chờ chuyển khoản',
  pending: 'Đang chờ chuyển khoản',
  awaiting_admin: 'Chờ xác nhận thanh toán',
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
  checking = false,
  checkNote = '',
  onCheckNow,
  learnHref = '',
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
  // Ưu tiên thông tin server trả về (tài khoản đã nối SePay → tự mở khóa).
  const fromServer = Boolean(order.accountNumber);
  const qrUrl = order.qrImageUrl || buildFallbackQrUrl(order) || STATIC_QR_URL;
  const accountNumber = fromServer ? order.accountNumber : BANK_INFO.accountNumber;
  const bankName = fromServer ? order.bankCode || '' : BANK_INFO.bankName;
  const accountName = fromServer ? order.accountName || '' : BANK_INFO.accountName;

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
          <p>{statusText[order.status] || 'Đang chờ chuyển khoản'}</p>
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
        <div className="payment-qr-box">
          <img src={qrUrl} alt="Mã QR chuyển khoản" />
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

          {accountNumber ? (
            <CopyField
              label={`Số tài khoản${bankName ? ` · ${bankName}` : ''}`}
              value={accountNumber}
            />
          ) : null}

          {accountName ? (
            <div>
              <span>Chủ tài khoản</span>
              <strong>{accountName}</strong>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Trạng thái ── */}
      {paid ? (
        <div className="payment-instructions__paid" role="status">
          <p>Đã nhận được tiền. Khóa học đã mở, bạn vào học được ngay.</p>
          <div className="payment-instructions__paid-actions">
            {learnHref ? (
              <Link className="button" to={learnHref} onClick={onClose}>
                Vào học ngay
              </Link>
            ) : null}
            {onClose ? (
              <button type="button" className={learnHref ? 'button-ghost' : 'button'} onClick={onClose}>
                {learnHref ? 'Để sau' : 'Xem khóa đã mua'}
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="payment-instructions__waiting">
          <div className="payment-instructions__waiting-row">
            <span className="payment-waiting-dot" aria-hidden="true" />
            <span>
              {checking
                ? 'Đang kiểm tra giao dịch...'
                : 'Quét QR bằng app ngân hàng. Khóa học tự mở khi tiền về, thường trong 1–2 phút.'}
            </span>
            {onCheckNow ? (
              <button type="button" className="button-ghost" onClick={onCheckNow} disabled={checking}>
                Kiểm tra ngay
              </button>
            ) : null}
          </div>
          {checkNote ? (
            <p className="payment-instructions__check-note" role="status">
              {checkNote}
            </p>
          ) : null}
          <p>
            Giữ nguyên nội dung chuyển khoản. Quá 15 phút chưa mở, gửi ảnh giao dịch cho trung tâm qua{' '}
            <a href={contact.zaloUrl} target="_blank" rel="noreferrer">
              Zalo
            </a>{' '}
            hoặc gọi <a href={`tel:${contact.phone}`}>{contact.phoneDisplay}</a>.
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
