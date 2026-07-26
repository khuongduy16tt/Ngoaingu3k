import React, { useEffect, useRef, useState } from 'react';
import { ConsultationForm, hasSubmittedConsultation } from './ConsultationForm';

const FIRST_OPEN_DELAY_MS = 600;
const REPEAT_DELAY_MS = 10000;
const AUTO_CLOSE_AFTER_SUCCESS_MS = 1500;

// Popup quảng cáo toàn màn hình: tự hiện khi vào web (che hết trang, có nút
// X để tắt) — giống 1 quảng cáo pop-up thường thấy, không phải banner mảnh
// trên đầu trang. Đóng rồi thì 10s sau tự bật lại, lặp vô hạn.
// CHỈ dựng ở trang chủ (xem AppLayout) — rời trang chủ là component unmount,
// effect cleanup xoá luôn hẹn giờ đang chờ.
// Hai trường hợp KHÔNG bật lại:
//   - người dùng đã gửi form tư vấn thành công (ở đây hoặc form hero trang
//     chủ) — đã có lead rồi thì không spam tiếp. Cờ nằm ở localStorage nên
//     giữ qua cả lần mở trình duyệt sau;
//   - đang có modal .consult-popup khác mở (nút "Tư vấn" nổi ở góc phải) — bật
//     chồng lên sẽ cướp focus form họ đang gõ dở, nên hoãn thêm một nhịp 10s.
export function ConsultationPopup() {
  const [open, setOpen] = useState(false);
  // Tăng lên để ép lịch hẹn chạy lại khi lần bật trước bị hoãn.
  const [attempt, setAttempt] = useState(0);
  const shownOnceRef = useRef(false);

  useEffect(() => {
    if (open || hasSubmittedConsultation()) {
      return undefined;
    }

    const delay = shownOnceRef.current ? REPEAT_DELAY_MS : FIRST_OPEN_DELAY_MS;
    const timer = setTimeout(() => {
      shownOnceRef.current = true;

      // Kiểm tra lại lúc bật, không chỉ lúc hẹn giờ: người dùng có thể đã gửi
      // form tư vấn ở hero trang chủ trong lúc 10s này đang đếm.
      if (hasSubmittedConsultation()) {
        return;
      }

      if (document.querySelector('.consult-popup')) {
        setAttempt((value) => value + 1);
        return;
      }

      setOpen(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [open, attempt]);

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
        <button type="button" className="consult-popup__close" onClick={() => setOpen(false)} aria-label="Đóng">
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
