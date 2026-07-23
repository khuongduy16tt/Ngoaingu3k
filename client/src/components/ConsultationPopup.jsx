import React, { useEffect, useState } from 'react';
import { ConsultationForm, hasSubmittedConsultation } from './ConsultationForm';

const DISMISSED_KEY = 'ngoaingu3k-consult-popup-dismissed';
const OPEN_DELAY_MS = 600;
const AUTO_CLOSE_AFTER_SUCCESS_MS = 1500;

function wasDismissedThisSession() {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

// Popup quảng cáo toàn màn hình: tự hiện khi vào web (che hết trang, có nút
// X để tắt) — giống 1 quảng cáo pop-up thường thấy, không phải banner mảnh
// trên đầu trang. Hiện 1 lần mỗi phiên trình duyệt; tắt rồi thì không hiện
// lại cho tới khi mở tab/trình duyệt mới. Không hiện lại nữa nếu người dùng
// đã từng đăng ký tư vấn thành công (ở đây hoặc form trên trang chủ).
export function ConsultationPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (wasDismissedThisSession() || hasSubmittedConsultation()) {
      return undefined;
    }

    const timer = setTimeout(() => setOpen(true), OPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        close();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function close() {
    setOpen(false);
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // ignore storage failures
    }
  }

  function handleFormSuccess() {
    setTimeout(close, AUTO_CLOSE_AFTER_SUCCESS_MS);
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="consult-popup"
      role="dialog"
      aria-modal="true"
      aria-label="Quảng cáo đăng ký tư vấn"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          close();
        }
      }}
    >
      <div className="consult-popup__card">
        <button type="button" className="consult-popup__close" onClick={close} aria-label="Đóng">
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
  );
}
