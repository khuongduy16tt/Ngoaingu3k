import React, { useEffect, useState } from 'react';
import { prefersReducedMotion } from '../../lib/scrollMotion';
import { CountUp } from './CountUp';

// Ba minh hoạ động cho các section tính năng trên trang chủ. Mỗi minh hoạ nhận
// `active` — chỉ bắt đầu chạy khi panel đã lọt vào màn hình (xem FeatureRow).
// Hoạt ảnh thuần CSS (home-v2.css), JS chỉ bật class/đổi bước.

// ── a) Lộ trình cá nhân hoá: 5 bước tự điền dần, checkmark pop-in ───────────
export function PathTimeline({ steps, active }) {
  const [done, setDone] = useState(() => (prefersReducedMotion() ? steps.length : 0));

  useEffect(() => {
    if (!active || done >= steps.length) return undefined;
    const timer = setTimeout(() => setDone((count) => count + 1), done === 0 ? 350 : 520);
    return () => clearTimeout(timer);
  }, [active, done, steps.length]);

  return (
    <ol className="hv-timeline" aria-label="5 nhóm lộ trình">
      {steps.map((step, i) => {
        const state = i < done ? 'is-done' : i === done ? 'is-current' : '';
        return (
          <li key={step.title} className={`hv-timeline__step ${state}`}>
            <span className="hv-timeline__dot" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            </span>
            <span className="hv-timeline__copy">
              <strong>{step.title}</strong>
              <span>{step.short}</span>
            </span>
            <span className="hv-timeline__num" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// ── b) Luyện phát âm/giao tiếp: sóng âm nhấp nhô + bong bóng chat lần lượt ──
const WAVE_BARS = [0.35, 0.6, 0.9, 0.55, 0.75, 1, 0.65, 0.4, 0.8, 0.95, 0.5, 0.7, 0.45, 0.85, 0.6, 0.3, 0.7, 0.5];

export function SpeakingDemo({ active }) {
  return (
    <div className={`hv-speak ${active ? 'is-active' : ''}`}>
      <div className="hv-speak__chat">
        <p className="hv-bubble hv-bubble--mentor" style={{ '--i': 0 }}>
          <span className="hv-bubble__who">Mentor</span>
          How was your weekend?
        </p>
        <p className="hv-bubble hv-bubble--me" style={{ '--i': 1 }}>
          <span className="hv-bubble__who">Bạn</span>
          It was great! I went hiking.
        </p>
        <p className="hv-bubble hv-bubble--mentor" style={{ '--i': 2 }}>
          <span className="hv-bubble__who">Mentor</span>
          Nice! Nhấn âm <b>/ˈhaɪ.kɪŋ/</b> rõ hơn nhé.
        </p>
      </div>
      <div className="hv-speak__mic">
        <span className="hv-speak__mic-btn" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
          </svg>
        </span>
        <span className="hv-wave" aria-hidden="true">
          {WAVE_BARS.map((height, i) => (
            <span key={i} style={{ '--h': height, '--d': `${(i % 6) * 110}ms` }} />
          ))}
        </span>
        <span className="hv-speak__score">
          Phát âm <b>chuẩn</b>
        </span>
      </div>
    </div>
  );
}

// ── c) Theo dõi tiến độ: biểu đồ cột mọc từ 0, % count-up, tab học viên ────
// Số liệu minh hoạ cho giao diện bảng tiến độ — không phải dữ liệu thật.
const LEARNERS = [
  { name: 'Minh An', accuracy: '86%', weeks: [42, 55, 61, 70, 78, 86] },
  { name: 'Thu Hà', accuracy: '91%', weeks: [58, 64, 72, 75, 84, 91] },
  { name: 'Gia Bảo', accuracy: '79%', weeks: [30, 41, 52, 60, 71, 79] },
];
const WEEK_LABELS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];
const ROTATE_MS = 3600;

export function ProgressDashboard({ active }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const learner = LEARNERS[index];

  useEffect(() => {
    if (!active || paused || prefersReducedMotion()) return undefined;
    const timer = setInterval(() => setIndex((current) => (current + 1) % LEARNERS.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, [active, paused]);

  return (
    <div className={`hv-dash ${active ? 'is-active' : ''}`}>
      <div className="hv-dash__tabs" role="tablist" aria-label="Chọn học viên minh hoạ">
        {LEARNERS.map((item, i) => (
          <button
            key={item.name}
            type="button"
            role="tab"
            aria-selected={i === index}
            className={i === index ? 'is-active' : ''}
            onClick={() => {
              setIndex(i);
              setPaused(true);
            }}
          >
            {item.name}
          </button>
        ))}
      </div>

      <div className="hv-dash__body">
        <div className="hv-dash__stat">
          <span>Độ chính xác</span>
          <CountUp key={learner.name} value={learner.accuracy} start={active} duration={900} className="hv-dash__pct" />
          <span className="hv-dash__trend">▲ tăng đều 6 tuần</span>
        </div>
        <div className="hv-dash__chart" aria-hidden="true">
          {learner.weeks.map((value, i) => (
            <span key={WEEK_LABELS[i]} className="hv-dash__col">
              <span className="hv-dash__bar" style={{ '--v': active ? value / 100 : 0, '--d': `${i * 70}ms` }} />
              <span className="hv-dash__label">{WEEK_LABELS[i]}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
