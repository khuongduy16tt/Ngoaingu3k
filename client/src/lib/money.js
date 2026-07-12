export function normalizeVndAmount(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return 0;
    return value > 0 && value < 10000 ? value * 10000 : Math.round(value);
  }

  const rawValue = String(value || '').trim();
  if (!rawValue) return 0;

  const digits = rawValue.replace(/[^\d]/g, '');
  const amount = Number(digits || 0);

  if (!Number.isFinite(amount) || amount < 0) return 0;
  return amount > 0 && amount < 10000 ? amount * 10000 : amount;
}

export function formatVnd(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(normalizeVndAmount(value));
}
