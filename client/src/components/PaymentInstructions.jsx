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
  creating: 'Đang tạo đơn',
  error: 'Chưa tạo được đơn',
  pending_payment: 'Chờ chuyển khoản',
  pending: 'Chờ chuyển khoản',
  awaiting_admin: 'Chờ xác nhận',
  paid: 'Đã thanh toán',
  failed: 'Thất bại',
  cancelled: 'Đã hủy',
};

function CopyField({ label, value, highlight = false }) {
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
    <div className={`payment-field${highlight ? ' is-highlight' : ''}`}>
      <span className="payment-field__label">{label}</span>
      <strong className="payment-field__value">{value}</strong>
      <button type="button" className="payment-copy-button" onClick={handleCopy}>
        {copied ? 'Đã chép' : 'Chép'}
      </button>
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
  onRetry,
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
  // Vừa bấm mua, server chưa trả mã: hiện khung màn QR ngay, chỗ nào chưa có thì
  // để khung xám nhấp nháy. Tạo đơn lỗi thì báo ngay trong màn này.
  const creating = order.status === 'creating';
  const failed = order.status === 'error';
  const hasAmount = order.amount !== undefined && order.amount !== null;
  // Ưu tiên thông tin server trả về (tài khoản đã nối SePay → tự mở khóa).
  const fromServer = Boolean(order.accountNumber);
  const qrUrl = order.qrImageUrl || buildFallbackQrUrl(order) || STATIC_QR_URL;
  const accountNumber = fromServer ? order.accountNumber : BANK_INFO.accountNumber;
  const bankName = fromServer ? order.bankCode || '' : BANK_INFO.bankName;
  const accountName = fromServer ? order.accountName || '' : BANK_INFO.accountName;

  const content = (
    <section
      className={`payment-instructions${isOverlay ? ' payment-instructions--overlay' : ''}`}
      aria-busy={creating || undefined}
    >
      <header className="payment-instructions__head">
        <div className="payment-instructions__title">
          <span className={`payment-status${paid ? ' is-paid' : ''}${failed ? ' is-error' : ''}`}>
            {statusText[order.status] || 'Chờ chuyển khoản'}
          </span>
          <h3>{order.courseTitle}</h3>
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
      </header>

      {failed ? (
        <div className="payment-instructions__error" role="alert">
          <p>{order.error || 'Chưa tạo được đơn thanh toán. Vui lòng thử lại.'}</p>
          <div className="payment-instructions__paid-actions">
            {onRetry ? (
              <button type="button" className="button" onClick={onRetry}>
                Thử lại
              </button>
            ) : null}
            {onClose ? (
              <button type="button" className={onRetry ? 'button-ghost' : 'button'} onClick={onClose}>
                Đóng
              </button>
            ) : null}
          </div>
        </div>
      ) : paid ? (
        <div className="payment-instructions__paid" role="status">
          <span className="payment-instructions__paid-icon" aria-hidden="true">✓</span>
          <p>Đã nhận {formatVnd(order.amount)}. Khóa học đã mở, bạn vào học được ngay.</p>
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
        <>
          <div className="payment-instructions__body">
            <div className={`payment-qr-box${creating ? ' is-loading' : ''}`}>
              {creating ? (
                <span className="payment-skeleton payment-skeleton--qr" aria-label="Đang tạo mã QR" />
              ) : (
                <img src={qrUrl} alt="Mã QR chuyển khoản" width="220" height="220" />
              )}
            </div>

            <div className="payment-instructions__info">
              <div className="payment-amount">
                <span>Số tiền</span>
                {hasAmount ? (
                  <strong>{formatVnd(order.amount)}</strong>
                ) : (
                  <span className="payment-skeleton payment-skeleton--amount" />
                )}
              </div>

              {creating ? (
                <>
                  <div className="payment-field is-highlight">
                    <span className="payment-field__label">Nội dung CK</span>
                    <span className="payment-skeleton payment-skeleton--value" />
                  </div>
                  <div className="payment-field">
                    <span className="payment-field__label">Số tài khoản</span>
                    <span className="payment-skeleton payment-skeleton--value" />
                  </div>
                </>
              ) : (
                <>
                  {order.transferCode ? (
                    <CopyField label="Nội dung CK" value={order.transferCode} highlight />
                  ) : null}

                  {accountNumber ? (
                    <CopyField label={bankName ? `STK · ${bankName}` : 'Số tài khoản'} value={accountNumber} />
                  ) : null}

                  {accountName ? <p className="payment-account-name">{accountName}</p> : null}
                </>
              )}
            </div>
          </div>

          <footer className="payment-instructions__waiting">
            <div className="payment-instructions__waiting-row">
              <span className="payment-waiting-dot" aria-hidden="true" />
              <span>
                {creating
                  ? 'Đang tạo mã thanh toán...'
                  : checking
                    ? 'Đang kiểm tra giao dịch...'
                    : 'Quét QR — khóa tự mở sau 1–2 phút.'}
              </span>
              {onCheckNow && !creating ? (
                <button type="button" className="payment-check-button" onClick={onCheckNow} disabled={checking}>
                  Kiểm tra ngay
                </button>
              ) : null}
            </div>
            {checkNote && !creating ? (
              <p className="payment-instructions__check-note" role="status">
                {checkNote}
              </p>
            ) : null}
            <p className="payment-instructions__help">
              Giữ nguyên nội dung CK. Cần hỗ trợ:{' '}
              <a href={contact.zaloUrl} target="_blank" rel="noreferrer">
                Zalo
              </a>{' '}
              · <a href={`tel:${contact.phone}`}>{contact.phoneDisplay}</a>
            </p>
          </footer>
        </>
      )}
    </section>
  );

  if (!isOverlay) return content;

  return (
    <div className="payment-screen" role="dialog" aria-modal="true" aria-label="Thanh toán chuyển khoản">
      <button
        type="button"
        className="payment-screen__backdrop"
        onClick={onClose}
        aria-label="Đóng hướng dẫn thanh toán"
        tabIndex={-1}
      />
      <div className="payment-screen__panel">{content}</div>
    </div>
  );
}
