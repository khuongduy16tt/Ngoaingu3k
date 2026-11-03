import React from 'react';
import { Link } from 'react-router-dom';

// Khối "Test trình độ miễn phí" ở trang chủ: mỗi ô dẫn thẳng vào một bài test.
const TESTS = [
  { to: '/test', name: 'IELTS', meta: '4 kỹ năng · 180 phút' },
  { to: '/test/hsk/1', name: 'HSK 1', meta: '10 câu · 15 phút' },
  { to: '/test/hsk/2', name: 'HSK 2', meta: '20 câu · 20 phút' },
  { to: '/test/hsk/3', name: 'HSK 3', meta: '30 câu · 30 phút' },
  { to: '/test/hsk/4', name: 'HSK 4', meta: '40 câu · 40 phút' },
  { to: '/test/hsk/5', name: 'HSK 5', meta: '45 câu · 45 phút' }
];

export function FreeTestBanner() {
  return (
    <section className="hv-freetest" aria-labelledby="hv-freetest-title">
      <div className="hv-freetest__copy">
        <span className="hv-freetest__badge">Miễn phí 100%</span>
        <h2 id="hv-freetest-title">Test trình độ miễn phí</h2>
        <p>
          Làm bài test chuẩn format IELTS hoặc HSK 1–5. Nộp bài là có điểm ngay, kèm đáp án chi tiết và gợi ý lộ trình
          học phù hợp.
        </p>
      </div>
      <ul className="hv-freetest__grid">
        {TESTS.map((test) => (
          <li key={test.to}>
            <Link to={test.to} className="hv-freetest__tile">
              <strong>{test.name}</strong>
              <span>{test.meta}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
