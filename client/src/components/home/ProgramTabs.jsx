import React, { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

// Khối tab chương trình: hàng tab dạng pill có "viên" nền đen trượt giữa các
// tab (đo offsetLeft/offsetWidth rồi animate transform — không cần thư viện),
// nội dung crossfade 200ms khi đổi tab. Phím ←/→/Home/End chuyển tab theo
// chuẩn WAI-ARIA Tabs.
export function ProgramTabs({ programs }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [indicator, setIndicator] = useState(null);
  const listRef = useRef(null);
  const tabRefs = useRef([]);
  const active = programs[activeIndex];

  useLayoutEffect(() => {
    function measure() {
      const tab = tabRefs.current[activeIndex];
      if (!tab) return;
      setIndicator({ x: tab.offsetLeft, width: tab.offsetWidth });
    }
    measure();
    // Font web nạp xong làm bề rộng chữ đổi → đo lại.
    document.fonts?.ready.then(measure).catch(() => {});
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [activeIndex]);

  function select(index, focus = false) {
    setActiveIndex(index);
    const tab = tabRefs.current[index];
    if (!tab) return;
    if (focus) tab.focus();
    // Trên điện thoại hàng tab cuộn ngang: kéo tab vừa chọn vào giữa tầm nhìn.
    const list = listRef.current;
    if (list && list.scrollWidth > list.clientWidth) {
      list.scrollTo({ left: tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2, behavior: 'smooth' });
    }
  }

  function onKeyDown(event) {
    const last = programs.length - 1;
    const next = {
      ArrowRight: activeIndex === last ? 0 : activeIndex + 1,
      ArrowLeft: activeIndex === 0 ? last : activeIndex - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next, true);
  }

  return (
    <div className="hv-programs__tabs-wrap">
      <div className="hv-tabs" role="tablist" aria-label="Chương trình đào tạo" ref={listRef} onKeyDown={onKeyDown}>
        {indicator ? (
          <span
            className="hv-tabs__indicator"
            style={{ width: indicator.width, transform: `translateX(${indicator.x}px)` }}
            aria-hidden="true"
          />
        ) : null}
        {programs.map((program, i) => (
          <button
            key={program.id}
            ref={(node) => {
              tabRefs.current[i] = node;
            }}
            id={`hv-tab-${program.id}`}
            type="button"
            role="tab"
            aria-selected={i === activeIndex}
            aria-controls={`hv-panel-${program.id}`}
            tabIndex={i === activeIndex ? 0 : -1}
            className={`hv-tabs__tab ${i === activeIndex ? 'is-active' : ''} ${indicator ? '' : 'is-fallback'}`}
            onClick={() => select(i)}
          >
            {program.label}
          </button>
        ))}
      </div>

      <div
        key={active.id}
        id={`hv-panel-${active.id}`}
        role="tabpanel"
        aria-labelledby={`hv-tab-${active.id}`}
        className="hv-program"
        tabIndex={0}
      >
        <span className="hv-program__glyph" aria-hidden="true" lang={active.glyph === '汉' ? 'zh' : undefined}>
          {active.glyph}
        </span>
        <div className="hv-program__topics">
          <h3>Chủ đề học</h3>
          <ul>
            {active.topics.map((topic) => (
              <li key={topic}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
                {topic}
              </li>
            ))}
          </ul>
        </div>
        <article className="hv-program__card">
          <div className="hv-program__media">
            <img src={active.image} alt={`Khoá học ${active.title}`} width="640" height="400" loading="lazy" decoding="async" />
          </div>
          <div className="hv-program__body">
            <span className="hv-program__meta">{active.meta}</span>
            <h3>{active.title}</h3>
            <p>{active.description}</p>
            <Link to={active.to} className="hv-btn hv-btn--dark hv-btn--sm">
              Xem khoá học <span aria-hidden="true">→</span>
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}
