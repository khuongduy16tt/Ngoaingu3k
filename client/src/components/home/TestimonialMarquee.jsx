import React from 'react';
import { getInitials } from '../../lib/avatar';

function TestimonialCard({ item, hidden }) {
  return (
    <figure className="hv-quote" aria-hidden={hidden || undefined}>
      <span className="hv-quote__badge">{item.result || item.course}</span>
      <blockquote>
        <p>“{item.quote}”</p>
      </blockquote>
      <figcaption className="hv-quote__who">
        {item.avatar ? (
          <img src={item.avatar} alt="" width="44" height="44" loading="lazy" decoding="async" />
        ) : (
          <span className="hv-quote__avatar" aria-hidden="true">
            {getInitials(item.name)}
          </span>
        )}
        <span>
          <strong>{item.name}</strong>
          <span>{item.role}</span>
        </span>
      </figcaption>
    </figure>
  );
}

// Marquee 2 hàng chạy ngược chiều nhau, dừng khi rê chuột/focus vào. Mỗi hàng
// nhân đôi danh sách để vòng lặp liền mạch (translateX 0 → -50%); bản sao ẩn
// với trình đọc màn hình. Giảm chuyển động: CSS tắt marquee, hàng thành dải
// cuộn ngang bình thường và bản sao bị ẩn hẳn.
export function TestimonialMarquee({ items }) {
  const rows = [items, [...items].reverse()];

  return (
    <div className="hv-marquee">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className={`hv-marquee__row ${rowIndex ? 'hv-marquee__row--reverse' : ''}`}>
          <div className="hv-marquee__track">
            {row.map((item) => (
              <TestimonialCard key={item.name} item={item} hidden={rowIndex === 1} />
            ))}
            {row.map((item) => (
              <TestimonialCard key={`${item.name}-copy`} item={item} hidden />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
