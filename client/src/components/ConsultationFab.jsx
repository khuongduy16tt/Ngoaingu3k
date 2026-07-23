import React, { useEffect, useState } from 'react';
import { ConsultationForm } from './ConsultationForm';

const AUTO_CLOSE_AFTER_SUCCESS_MS = 1500;

// Nút nổi "Đăng ký tư vấn" ở góc dưới bên phải (ngay trên cụm nút liên hệ/Zalo).
// Thay cho popup tư vấn tự bật trước đây: form chỉ mở khi người dùng bấm nút,
// hiển thị trong cùng modal .consult-popup dùng chung toàn site.
export function ConsultationFab() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function handleFormSuccess() {
    setTimeout(() => setOpen(false), AUTO_CLOSE_AFTER_SUCCESS_MS);
  }

  return (
    <>
      <button
        type="button"
        className="consult-fab"
        onClick={() => setOpen(true)}
        aria-label="Đăng ký nhận tư vấn lộ trình học"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-4.5 3.2V17.5H4A1.5 1.5 0 0 1 2.5 16V7A1.5 1.5 0 0 1 4 5.5Z" />
          <path d="M7.5 10.5h9M7.5 13.5h6" />
        </svg>
        <span className="consult-fab__label">Tư vấn</span>
      </button>

      {open ? (
        <div
          className="consult-popup"
          role="dialog"
          aria-modal="true"
          aria-label="Đăng ký tư vấn"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <div className="consult-popup__card">
            <button
              type="button"
              className="consult-popup__close"
              onClick={() => setOpen(false)}
              aria-label="Đóng"
            >
              ✕
            </button>
            <span className="eyebrow">Ưu đãi tư vấn miễn phí</span>
            <h2>Đăng ký nhận tư vấn lộ trình học</h2>
            <p className="consult-popup__lead">
              Nhận lộ trình học IELTS/HSK phù hợp trong 24h — hoàn toàn{' '}
              <span className="consult-popup__free">MIỄN PHÍ</span>.
            </p>
            <ConsultationForm onSuccess={handleFormSuccess} />
          </div>
        </div>
      ) : null}
    </>
  );
}
