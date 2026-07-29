import React, { useEffect, useRef, useState } from 'react';

// Trình phát cho bài nghe tua được: giữ nguyên <audio controls> của trình duyệt
// và thêm hàng nút chỉnh tốc độ. Không dùng cho loại "bấm để nghe" (phát bằng
// giọng đọc của trình duyệt qua speechSynthesis) vì loại đó không có thanh tua.

export const LISTENING_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5];
const STORAGE_KEY = 'listening-playback-rate-v1';
const RATE_CHANGE_EVENT = 'ngoaingu3k:listening-rate';

function readStoredRate() {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    return LISTENING_SPEEDS.includes(stored) ? stored : 1;
  } catch {
    return 1;
  }
}

function writeStoredRate(rate) {
  try {
    localStorage.setItem(STORAGE_KEY, String(rate));
  } catch {
    // Bỏ qua khi trình duyệt chặn localStorage.
  }
}

// Đổi tốc độ ở một câu thì mọi câu nghe khác đổi theo — học viên chỉ phải chọn
// "chậm" một lần cho cả bài thay vì chỉnh lại ở từng câu.
function broadcastRate(rate) {
  writeStoredRate(rate);
  window.dispatchEvent(new CustomEvent(RATE_CHANGE_EVENT, { detail: rate }));
}

function formatRate(rate) {
  return `${String(rate).replace('.', ',')}×`;
}

export function ListeningAudio({ src, label = '', preload = 'auto', className = '' }) {
  const audioRef = useRef(null);
  const [rate, setRate] = useState(readStoredRate);

  useEffect(() => {
    function handleRateChange(event) {
      setRate(event.detail);
    }

    window.addEventListener(RATE_CHANGE_EVENT, handleRateChange);
    return () => window.removeEventListener(RATE_CHANGE_EVENT, handleRateChange);
  }, []);

  // Trình duyệt đặt lại playbackRate mỗi khi nạp nguồn mới, nên phải gán lại cả
  // khi src đổi lẫn khi audio vừa nạp xong metadata.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return undefined;
    }

    function applyRate() {
      // Giữ cao độ giọng khi đổi tốc độ — chậm lại mà méo tiếng thì luyện nghe vô nghĩa.
      audio.preservesPitch = true;
      audio.mozPreservesPitch = true;
      audio.webkitPreservesPitch = true;
      audio.playbackRate = rate;
    }

    applyRate();
    audio.addEventListener('loadedmetadata', applyRate);
    return () => audio.removeEventListener('loadedmetadata', applyRate);
  }, [rate, src]);

  if (!src) {
    return null;
  }

  return (
    <div className={`listening-audio ${className}`.trim()}>
      <audio ref={audioRef} controls src={src} preload={preload} />

      <div className="listening-audio__speed">
        <span className="listening-audio__speed-label">Tốc độ</span>
        <div className="listening-audio__speed-buttons" role="group" aria-label={`Tốc độ phát${label ? ` — ${label}` : ''}`}>
          {LISTENING_SPEEDS.map((speed) => (
            <button
              key={speed}
              type="button"
              className={`listening-audio__speed-button ${speed === rate ? 'is-active' : ''}`}
              aria-pressed={speed === rate}
              onClick={() => broadcastRate(speed)}
            >
              {formatRate(speed)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
