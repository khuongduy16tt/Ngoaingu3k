import React from 'react';
import { Link } from 'react-router-dom';
// Giữ danh sách cấp ở đây để trang IELTS không phải tải cả đề HSK.
const HSK_LEVELS = [1, 2, 3, 4, 5];

// Thanh chọn bài test ở màn bắt đầu: IELTS hoặc HSK 1–5.
// `active` là 'ielts' hoặc số cấp HSK đang mở.
export function TestPicker({ active }) {
  const items = [
    { key: 'ielts', label: 'IELTS', to: '/test' },
    ...HSK_LEVELS.map((level) => ({ key: level, label: `HSK ${level}`, to: `/test/hsk/${level}` }))
  ];
  return (
    <nav className="pt-picker" aria-label="Chọn bài test">
      {items.map((item) => {
        const current = item.key === active;
        return (
          <Link
            key={item.key}
            to={item.to}
            className={`pt-picker__item ${current ? 'is-active' : ''}`}
            aria-current={current ? 'page' : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
