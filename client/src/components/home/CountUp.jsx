import React, { useEffect, useState } from 'react';
import { prefersReducedMotion } from '../../lib/scrollMotion';

// "15.000+" → 15000 + "+" · "98,2%" → 98.2 (1 số lẻ) + "%" · "24/7" → 24 + "/7".
// Kiểu số Việt: dấu chấm ngăn nghìn, dấu phẩy là thập phân.
export function parseCountValue(value) {
  const match = /^(\d[\d.,]*)(.*)$/.exec(String(value).trim());
  if (!match) return null;
  const [, raw, suffix] = match;
  const decimalMatch = /,(\d{1,2})$/.exec(raw);
  const decimals = decimalMatch ? decimalMatch[1].length : 0;
  const target = Number(raw.replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(target)) return null;
  return { target, decimals, suffix };
}

export function formatCountValue(number, decimals) {
  return number.toLocaleString('vi-VN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// Đếm từ 0 lên khi `start` bật (một lần). Trình đọc màn hình chỉ nghe giá trị
// cuối (bản ẩn), không nghe từng nhịp đếm.
export function CountUp({ value, start, duration = 1400, className }) {
  const parsed = parseCountValue(value);
  const animate = Boolean(parsed) && !prefersReducedMotion();
  const [display, setDisplay] = useState(() => (animate ? formatCountValue(0, parsed.decimals) + parsed.suffix : value));

  useEffect(() => {
    if (!animate || !start) return undefined;
    let frame = 0;
    const begin = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - begin) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(progress < 1 ? formatCountValue(parsed.target * eased, parsed.decimals) + parsed.suffix : value);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // parsed suy ra từ value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, start, value, duration]);

  return (
    <span className={className}>
      <span aria-hidden="true">{display}</span>
      <span className="home-visually-hidden">{value}</span>
    </span>
  );
}
