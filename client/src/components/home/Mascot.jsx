import React from 'react';

// "Bạn 3K" — linh vật riêng của Ngoaingu3k: bong bóng chat xanh lá (màu logo)
// kẹp một trang sách, có mắt chớp và nhịp "thở". Dựng hoàn toàn bằng SVG nên
// không tốn request ảnh. Hoạt ảnh nằm trong home-v2.css (.hv-mascot*).
export function Mascot({ className = '', mood = 'happy' }) {
  return (
    <svg className={`hv-mascot mood-${mood} ${className}`} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <g className="hv-mascot__body">
        {/* bóng đổ mềm dưới chân */}
        <ellipse cx="60" cy="112" rx="30" ry="5" fill="currentColor" opacity="0.08" />
        {/* trang sách phía sau */}
        <path d="M24 34 L60 26 L96 34 L96 84 L60 76 L24 84 Z" fill="#ffffff" stroke="#15803D" strokeWidth="3" strokeLinejoin="round" />
        <path d="M60 26 V76" stroke="#15803D" strokeWidth="3" />
        {/* thân bong bóng */}
        <path
          d="M30 44c0-11 9-20 20-20h22c11 0 20 9 20 20v22c0 11-9 20-20 20H58l-13 12v-12c-8-2-15-10-15-20V44Z"
          fill="#22C55E"
          stroke="#15803D"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d="M39 35c3-5 9-8 15-8" fill="none" stroke="#bbf7d0" strokeWidth="4" strokeLinecap="round" opacity="0.75" />
        <g className="hv-mascot__paw hv-mascot__paw--left">
          <path d="M30 65c-8-1-11-7-13-11" fill="none" stroke="#15803D" strokeWidth="7" strokeLinecap="round" />
          <circle cx="16" cy="52" r="5" fill="#22C55E" stroke="#15803D" strokeWidth="2" />
        </g>
        <g className="hv-mascot__paw hv-mascot__paw--right">
          <path d="M91 63c9-2 12-8 13-13" fill="none" stroke="#15803D" strokeWidth="7" strokeLinecap="round" />
          <circle cx="104" cy="48" r="5" fill="#22C55E" stroke="#15803D" strokeWidth="2" />
        </g>
        {/* mắt */}
        <g className="hv-mascot__eyes">
          <ellipse cx="50" cy="52" rx="6" ry="7" fill="#ffffff" />
          <ellipse cx="72" cy="52" rx="6" ry="7" fill="#ffffff" />
          <circle cx="51.5" cy="53.5" r="3.2" fill="#0B1F12" />
          <circle cx="73.5" cy="53.5" r="3.2" fill="#0B1F12" />
        </g>
        {/* má hồng + miệng */}
        <circle cx="42" cy="64" r="3.5" fill="#FDA4AF" opacity="0.7" />
        <circle cx="80" cy="64" r="3.5" fill="#FDA4AF" opacity="0.7" />
        <circle cx="40" cy="62" r="1" fill="#fff" opacity="0.8" />
        <circle cx="78" cy="62" r="1" fill="#fff" opacity="0.8" />
        {mood === 'wow' || mood === 'encourage' ? (
          <ellipse cx="61" cy="67" rx="4" ry="5" fill="#0B1F12" />
        ) : mood === 'celebrate' ? (
          <path d="M52 63c2 10 16 10 18 0" fill="#0B1F12" stroke="#0B1F12" strokeWidth="2" strokeLinecap="round" />
        ) : (
          <path d="M54 64c2.5 4 11.5 4 14 0" fill="none" stroke="#0B1F12" strokeWidth="3" strokeLinecap="round" />
        )}
      </g>
      <g className="hv-mascot__sparkles" fill="#facc15">
        <path d="m13 27 2-6 2 6 6 2-6 2-2 6-2-6-6-2Z" />
        <path d="m103 20 1.5-4 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5Z" />
      </g>
    </svg>
  );
}
