import React, { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../lib/scrollMotion';

// "Bạn 3K" đu bám mép dưới khung header: lúc thò đầu ra ngó nghiêng, lúc rụt
// vào trốn sau khung. Rê chuột vào → ngại, trốn ngay rồi lén ló lại. Bấm vào →
// nhảy cẫng lên và nói một câu. Chỉ là trang trí (aria-hidden, không nhận
// focus); hoạt ảnh là transform trong site-v2.css, JS chỉ đổi pha.
//
// Pha: hidden → peek (ló đầu) → look (ngó trái/phải) → hidden …
// Giảm chuyển động: đứng yên ở trạng thái ló đầu, không lặp.
const LINES = [
  'Chào bạn nha!',
  'Học 15 phút mỗi ngày nhé!',
  'Ơ, bị phát hiện rồi…',
  'Hôm nay học từ mới chưa?',
  'Cố lên, sắp giỏi rồi!',
  '加油! Cố lên!',
  "Let's learn together!",
];

function random(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

export function HeaderMascot({ hidden = false }) {
  const [reduced] = useState(prefersReducedMotion);
  const [phase, setPhase] = useState('peek');
  const [look, setLook] = useState('center'); // left | center | right
  const [line, setLine] = useState('');
  const [jumping, setJumping] = useState(false);
  const [waving, setWaving] = useState(false);
  const timers = useRef([]);
  const lineIndex = useRef(random(0, LINES.length - 1));

  function later(fn, ms) {
    timers.current.push(setTimeout(fn, ms));
  }

  function clearAll() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  useEffect(() => clearAll, []);

  // Vòng ẩn hiện tự chạy.
  useEffect(() => {
    if (reduced || hidden || line) return undefined;
    let timer;
    if (phase === 'hidden') {
      timer = setTimeout(() => setPhase('peek'), 300);
    } else if (phase === 'peek') {
      timer = setTimeout(() => setPhase('look'), random(2400, 4200));
    } else if (phase === 'look') {
      const steps = [
        () => setLook(Math.random() > 0.5 ? 'left' : 'right'),
        () => setLook((current) => (current === 'left' ? 'right' : 'left')),
        () => setLook('center'),
      ];
      steps.forEach((step, i) => later(step, 500 + i * 750));
      timer = setTimeout(() => setPhase('peek'), random(2200, 3400));
    }
    return () => clearTimeout(timer);
  }, [phase, reduced, hidden, line]);

  useEffect(() => {
    if (hidden) {
      clearAll();
      setLine('');
      setPhase('hidden');
    }
  }, [hidden]);

  function onHello() {
    if (line) return;
    clearAll();
    setPhase('peek');
    setLine('Chào bạn! Bấm mình nhé 👋');
    setWaving(true);
    later(() => setWaving(false), 900);
    later(() => setLine(''), 1900);
  }

  function onMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const position = (event.clientX - rect.left) / rect.width;
    setLook(position < 0.4 ? 'left' : position > 0.6 ? 'right' : 'center');
  }

  function onPoke() {
    clearAll();
    lineIndex.current = (lineIndex.current + 1) % LINES.length;
    setLine(LINES[lineIndex.current]);
    setPhase('peek');
    setLook('center');
    setJumping(true);
    setWaving(true);
    later(() => setJumping(false), 520);
    later(() => setWaving(false), 900);
    later(() => {
      setLine('');
      setPhase('peek');
    }, 2400);
  }

  return (
    <span className={`header-mascot is-${hidden ? 'gone' : phase} look-${look} ${waving ? 'is-waving' : ''}`}>
      <span className="header-mascot__clip">
        <button
          type="button"
          className={`header-mascot__buddy ${jumping ? 'is-jumping' : ''}`}
          aria-label="Chạm vào bạn 3K để nghe lời cổ vũ"
          onMouseEnter={onHello}
          onMouseMove={onMove}
          onMouseLeave={() => setLook('center')}
          onFocus={() => setPhase('peek')}
          onClick={onPoke}
        >
          <svg viewBox="0 0 80 76" focusable="false">
            {/* hai tay vươn lên, bàn tay ôm qua mép khung (2 ngón cong) */}
            <path className="header-mascot__arm" d="M24 20c-2-5-3-9-3-13" />
            <path className="header-mascot__arm" d="M56 20c2-5 3-9 3-13" />
            <g className="header-mascot__hand">
              <ellipse cx="21" cy="6" rx="8.5" ry="4.8" fill="#59B3E1" stroke="#385791" strokeWidth="2.5" />
              <path d="M17.5 2.5v4M21 1.5v4.5M24.5 2.5v4" stroke="#385791" strokeWidth="1.6" strokeLinecap="round" />
            </g>
            <g className="header-mascot__hand">
              <ellipse cx="59" cy="6" rx="8.5" ry="4.8" fill="#59B3E1" stroke="#385791" strokeWidth="2.5" />
              <path d="M55.5 2.5v4M59 1.5v4.5M62.5 2.5v4" stroke="#385791" strokeWidth="1.6" strokeLinecap="round" />
            </g>
            {/* thân bong bóng chat */}
            <path
              d="M14 30c0-9 7-16 16-16h20c9 0 16 7 16 16v16c0 9-7 16-16 16H44l-10 10V62h-4c-9 0-16-7-16-16V30Z"
              fill="#59B3E1"
              stroke="#385791"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {/* mắt — nhóm .header-mascot__eyes dịch trái/phải khi ngó */}
            <g className="header-mascot__eyes">
              <ellipse cx="31" cy="36" rx="5.5" ry="6.5" fill="#fff" />
              <ellipse cx="49" cy="36" rx="5.5" ry="6.5" fill="#fff" />
              <g className="header-mascot__pupils">
                <circle cx="32" cy="37.5" r="3" fill="#0F2140" />
                <circle cx="50" cy="37.5" r="3" fill="#0F2140" />
              </g>
            </g>
            <circle cx="24" cy="46" r="3" fill="#FDA4AF" opacity="0.75" />
            <circle cx="56" cy="46" r="3" fill="#FDA4AF" opacity="0.75" />
            <circle cx="21" cy="43" r="1.2" fill="#fff" opacity="0.85" />
            <circle cx="53" cy="43" r="1.2" fill="#fff" opacity="0.85" />
            <path className="header-mascot__mouth" d="M35 46c2 3.5 8 3.5 10 0" fill="none" stroke="#0F2140" strokeWidth="2.6" strokeLinecap="round" />
            <path className="header-mascot__sparkle" d="m8 33 1.5-4L11 33l4 1.5-4 1.5-1.5 4L8 36l-4-1.5Z" fill="#facc15" />
          </svg>
        </button>
      </span>
      {line ? <span className="header-mascot__bubble" role="status">{line}</span> : null}
    </span>
  );
}
