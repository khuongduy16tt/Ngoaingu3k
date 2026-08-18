import { randomInt, timingSafeEqual } from 'node:crypto';

// Bỏ I, O, S để nhân viên không đọc nhầm thành 1, 0, 5 khi đối soát tay.
const CODE_ALPHABET = '0123456789ABCDEFGHJKLMNPQRTUVWXYZ';
const CODE_BODY_LENGTH = 6;
const DEFAULT_PREFIX = 'NN3K';
const QR_ENDPOINT = 'https://qr.sepay.vn/img';

function sanitizePrefix(value) {
  const cleaned = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return cleaned || DEFAULT_PREFIX;
}

export function getSepayConfig() {
  return {
    accountNumber: String(process.env.SEPAY_ACCOUNT_NUMBER || '').trim(),
    bankCode: String(process.env.SEPAY_BANK_CODE || '').trim(),
    accountName: String(process.env.SEPAY_ACCOUNT_NAME || '').trim(),
    apiKey: String(process.env.SEPAY_WEBHOOK_API_KEY || '').trim(),
    template: String(process.env.SEPAY_QR_TEMPLATE || 'compact').trim(),
    prefix: sanitizePrefix(process.env.SEPAY_CODE_PREFIX)
  };
}

/** Đủ thông tin tài khoản để dựng QR hay chưa. */
export function isSepayReady() {
  const { accountNumber, bankCode } = getSepayConfig();
  return Boolean(accountNumber && bankCode);
}

/**
 * Mã chuyển khoản của một đơn, vd `NN3K8F2K1P`. Chỉ chữ và số vì ngân hàng
 * hay cắt dấu gạch và ký tự lạ khỏi nội dung chuyển khoản.
 */
export function makeTransferCode() {
  const { prefix } = getSepayConfig();
  let body = '';

  for (let index = 0; index < CODE_BODY_LENGTH; index += 1) {
    body += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }

  return `${prefix}${body}`;
}

/**
 * Dò mã chuyển khoản trong một chuỗi bất kỳ (nội dung giao dịch, mã code SePay
 * tự tách...). Bỏ hết ký tự không phải chữ/số trước khi dò vì ngân hàng chèn
 * thêm khoảng trắng, dấu chấm giữa nội dung.
 */
export function extractTransferCode(rawText) {
  const normalized = String(rawText || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  if (!normalized) {
    return '';
  }

  const { prefix } = getSepayConfig();
  const matched = normalized.match(new RegExp(`${prefix}[A-Z0-9]{${CODE_BODY_LENGTH}}`));
  return matched ? matched[0] : '';
}

/** Ảnh VietQR động của SePay — quét là điền sẵn số tiền và nội dung. */
export function buildQrImageUrl({ amount, transferCode }) {
  const { accountNumber, bankCode, template } = getSepayConfig();

  if (!accountNumber || !bankCode || !transferCode) {
    return '';
  }

  const params = new URLSearchParams({
    acc: accountNumber,
    bank: bankCode,
    amount: String(Math.round(Number(amount) || 0)),
    des: transferCode,
    template
  });

  return `${QR_ENDPOINT}?${params.toString()}`;
}

/**
 * SePay gửi header `Authorization: Apikey <key>`. So sánh theo kiểu
 * timing-safe để header không thành kênh dò key.
 */
export function verifySepayApiKey(authorizationHeader) {
  const { apiKey } = getSepayConfig();

  if (!apiKey) {
    // Chưa cấu hình key thì từ chối, tránh mở khóa đơn bằng request giả.
    return false;
  }

  const header = String(authorizationHeader || '').trim();
  const receivedKey = header.replace(/^Apikey\s+/i, '').trim();

  if (!receivedKey || receivedKey.length !== apiKey.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(receivedKey), Buffer.from(apiKey));
}

/** Thông tin chuyển khoản trả về cho client dựng màn thanh toán. */
export function buildPaymentTarget({ amount, transferCode }) {
  const { accountNumber, bankCode, accountName } = getSepayConfig();

  return {
    provider: 'sepay',
    transferCode,
    qrImageUrl: buildQrImageUrl({ amount, transferCode }),
    bankCode,
    accountNumber,
    accountName
  };
}
