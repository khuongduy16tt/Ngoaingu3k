import React, { useEffect, useState } from 'react';
import { ConsultationForm, hasSubmittedConsultation } from './ConsultationForm';

const DISMISSED_KEY = 'ngoaingu3k-consult-banner-dismissed';

function wasDismissedThisSession() {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

// Site-wide promo banner: "Đăng ký tư vấn" call-to-action shown once per
// browser session, dismissible with the X. Never shown again once the
// visitor has actually submitted a consultation request (from here or the
// homepage hero form) — no point nagging someone who already converted.
export function ConsultationBanner() {
  const [visible, setVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!wasDismissedThisSession() && !hasSubmittedConsultation()) {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!modalOpen) {
      return undefined;
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setModalOpen(false);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [modalOpen]);

  function dismissBanner() {
    setVisible(false);
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // ignore storage failures
    }
  }

  function handleFormSuccess() {
    setVisible(false);
    setTimeout(() => setModalOpen(false), 1500);
  }

  return (
    <>
      {visible ? (
        <div className="consult-banner" role="region" aria-label="Quảng cáo đăng ký tư vấn">
          <p className="consult-banner__copy">
            <strong>Đăng ký tư vấn miễn phí</strong>
            <span>Nhận lộ trình học IELTS/HSK phù hợp trong 24h.</span>
          </p>
          <div className="consult-banner__actions">
            <button type="button" className="button consult-banner__cta" onClick={() => setModalOpen(true)}>
              Đăng ký ngay
            </button>
            <button
              type="button"
              className="consult-banner__close"
              onClick={dismissBanner}
              aria-label="Đóng banner quảng cáo"
            >
              ✕
            </button>
          </div>
        </div>
      ) : null}

      {modalOpen ? (
        <div
          className="consult-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Đăng ký tư vấn"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setModalOpen(false);
            }
          }}
        >
          <div className="consult-modal__card">
            <button
              type="button"
              className="consult-modal__close"
              onClick={() => setModalOpen(false)}
              aria-label="Đóng"
            >
              ✕
            </button>
            <span className="eyebrow">Tư vấn miễn phí</span>
            <h2>Đăng ký nhận tư vấn</h2>
            <ConsultationForm onSuccess={handleFormSuccess} />
          </div>
        </div>
      ) : null}
    </>
  );
}
