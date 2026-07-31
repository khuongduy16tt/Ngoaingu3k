import React, { useEffect, useRef, useState } from 'react';
import { ConsultationForm, hasSubmittedConsultation } from './ConsultationForm';

const FIRST_OPEN_DELAY_MS = 600;
const AUTO_CLOSE_AFTER_SUCCESS_MS = 1500;
// Coi như đã tới cuối trang khi còn cách đáy dưới một màn hình — bắt đúng lúc
// người đọc sắp hết nội dung, không phải chờ chạm đáy tuyệt đối.
const BOTTOM_THRESHOLD_PX = 600;

// Popup quảng cáo toàn màn hình, hiện ĐÚNG 3 LẦN mỗi lượt vào trang chủ, mỗi
// lần gắn với một mốc đọc thay vì hẹn giờ lặp:
//   1. 'dau'   — vừa vào trang;
//   2. 'vi-sao'— khi khối "Vì sao chọn Ngoaingu3k" (.reasons-section) lọt vào
//                màn hình;
//   3. 'cuoi'  — khi cuộn gần hết trang.
// Mỗi mốc chỉ bắn một lần cho tới khi rời trang chủ. Trước đây popup bật lại
// sau mỗi 10s vô hạn, đóng bao nhiêu lần cũng hiện lại.
// CHỈ dựng ở trang chủ (xem AppLayout) — rời trang chủ là component unmount.
// Hai trường hợp KHÔNG bật:
//   - người dùng đã gửi form tư vấn thành công (ở đây hoặc form hero trang
//     chủ) — đã có lead rồi thì không spam tiếp. Cờ nằm ở localStorage nên
//     giữ qua cả lần mở trình duyệt sau;
//   - đang có modal .consult-popup khác mở (nút "Tư vấn" nổi ở góc phải) — bật
//     chồng lên sẽ cướp focus form họ đang gõ dở, nên bỏ qua nhịp đó. Mốc chưa
//     bị tiêu, cuộn qua lại vẫn còn cơ hội bắn.
export function ConsultationPopup() {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const firedRef = useRef(new Set());

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    if (hasSubmittedConsultation()) {
      return undefined;
    }

    function moc(ten) {
      if (firedRef.current.has(ten) || openRef.current || hasSubmittedConsultation()) {
        return;
      }

      // Modal khác đang mở: bỏ qua lần này nhưng KHÔNG đánh dấu đã bắn.
      if (document.querySelector('.consult-popup')) {
        return;
      }

      firedRef.current.add(ten);
      setOpen(true);
    }

    // 1. Đầu trang — chờ một nhịp cho trang vẽ xong rồi mới che.
    const timer = setTimeout(() => moc('dau'), FIRST_OPEN_DELAY_MS);

    // 2. Khối "Vì sao chọn Ngoaingu3k".
    let observer;
    const reasons = document.querySelector('.reasons-section');
    if (reasons && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => entries.forEach((entry) => entry.isIntersecting && moc('vi-sao')),
        { threshold: 0.35 }
      );
      observer.observe(reasons);
    }

    // 3. Gần cuối trang.
    function onScroll() {
      const conLai = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      if (conLai <= BOTTOM_THRESHOLD_PX) {
        moc('cuoi');
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      clearTimeout(timer);
      observer?.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

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
