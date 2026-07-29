import React from 'react';

// Vẽ một nét chữ Hán bằng SVG. Dùng currentColor nên nét tự đổi màu theo chủ đề
// sáng/tối mà không cần hai bộ ảnh. Khung có ô kẻ mờ như vở tập viết để thấy rõ
// nét nằm ở phần nào của ô chữ.
export function StrokeGlyph({ stroke, size = 120, showGuide = true, showStart = true, className = '' }) {
  if (!stroke?.path) {
    return null;
  }

  return (
    <svg
      className={`stroke-glyph ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`Nét ${stroke.vi}`}
    >
      {showGuide ? (
        <g className="stroke-glyph__guide">
          <rect x="4" y="4" width="92" height="92" rx="6" />
          <line x1="50" y1="4" x2="50" y2="96" />
          <line x1="4" y1="50" x2="96" y2="50" />
        </g>
      ) : null}

      <path className="stroke-glyph__path" d={stroke.path} />

      {showStart && Array.isArray(stroke.start) ? (
        <circle className="stroke-glyph__start" cx={stroke.start[0]} cy={stroke.start[1]} r="5" />
      ) : null}
    </svg>
  );
}
