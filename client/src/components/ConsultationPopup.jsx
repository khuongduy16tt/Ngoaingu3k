import React, { useEffect, useRef, useState } from 'react';
import { ConsultationForm, hasSubmittedConsultation } from './ConsultationForm';

const AUTO_CLOSE_AFTER_SUCCESS_MS = 1500;
export const POPUP_TIME_TRIGGER_MS = 45000;
export const POPUP_SCROLL_TRIGGER_RATIO = 0.6;
export const POPUP_SESSION_KEY = 'ngoaingu3k-consult-popup-shown';

function wasShownThisSession() {
  try {
    return sessionStorage.getItem(POPUP_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function markShownThisSession() {
  try {
    sessionStorage.setItem(POPUP_SESSION_KEY, '1');
  } catch {
    // Trình duyệt chặn storage: vẫn chỉ hiện 1 lần trong lượt xem này (shownRef).
  }
}

// Popup mời đăng ký tư vấn — KHÔNG bật khi vừa tải trang. Chỉ bật ở lần đầu
// gặp một trong ba tín hiệu cho thấy khách đã thật sự đọc trang:
//   - exit-intent: chuột rời mép trên cửa sổ (chỉ máy có chuột);
//   - đã cuộn ≥ 60% trang;
//   - đã ở trang ≥ 45 giây.
// Tối đa 1 lần mỗi phiên (sessionStorage). Không bật với người đã đăng nhập,
// người đã gửi form tư vấn, hoặc khi đang có hộp thoại .consult-popup khác mở
// (nút "Tư vấn" nổi) — trường hợp cuối chỉ bỏ qua nhịp đó, chưa tiêu lượt.
// CHỈ dựng ở trang chủ (xem AppLayout).
export function ConsultationPopup({ isSignedIn = false }) {
  const [open, setOpen] = useState(false);
  const shownRef = useRef(false);
  const closeButtonRef = useRef(null);
  const returnFocusRef = useRef(null);

  useEffect(() => {
    if (isSignedIn) {
      setOpen(false);
      return undefined;
    }
    if (shownRef.current || wasShownThisSession() || hasSubmittedConsultation()) {
      return undefined;
    }

    function trigger() {
      if (shownRef.current || hasSubmittedConsultation()) return;
      if (document.querySelector('.consult-popup')) return;
      shownRef.current = true;
      markShownThisSession();
      cleanup();
      returnFocusRef.current = document.activeElement;
      setOpen(true);
    }

    function onScroll() {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable > 0 && window.scrollY / scrollable >= POPUP_SCROLL_TRIGGER_RATIO) trigger();
    }

    function onMouseOut(event) {
      if (!event.relatedTarget && event.clientY <= 0) trigger();
    }

    const timer = setTimeout(trigger, POPUP_TIME_TRIGGER_MS);
    window.addEventListener('scroll', onScroll, { passive: true });
    const hasMouse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches;
    if (hasMouse) document.addEventListener('mouseout', onMouseOut);

    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('mouseout', onMouseOut);
    }
    return cleanup;
  }, [isSignedIn]);

  useEffect(() => {
    if (!open) return undefined;
    closeButtonRef.current?.focus();

    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      returnFocusRef.current?.focus?.();
    };
  }, [open]);

  function handleFormSuccess() {
    setTimeout(() => setOpen(false), AUTO_CLOSE_AFTER_SUCCESS_MS);
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
          setOpen(false);
        }
      }}
    >
      <div className="consult-popup__card">
        <button
          ref={closeButtonRef}
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
  );
}
