import React, { useState } from 'react';
import { submitConsultationRequest } from '../lib/leadService';

export const CONSULTATION_SUBMITTED_KEY = 'ngoaingu3k-consultation-submitted';

export function hasSubmittedConsultation() {
  try {
    return localStorage.getItem(CONSULTATION_SUBMITTED_KEY) === '1';
  } catch {
    return false;
  }
}

const emptyConsultForm = { fullName: '', phone: '', email: '', program: '', needs: '' };

// Shared by the homepage hero section and the site-wide consultation banner —
// same fields/validation/submit flow wherever it's rendered.
export function ConsultationForm({ className = '', onSuccess } = {}) {
  const [values, setValues] = useState(emptyConsultForm);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  function updateField(field) {
    return (event) => setValues((previous) => ({ ...previous, [field]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!values.fullName.trim() || !values.phone.trim() || !values.program) {
      setStatus('error');
      setMessage('Vui lòng nhập họ tên, số điện thoại và chọn chương trình quan tâm.');
      return;
    }

    setStatus('submitting');
    setMessage('');

    try {
      const result = await submitConsultationRequest(values);
      setStatus('success');
      setMessage(result?.message || 'Đăng ký tư vấn thành công, chúng tôi sẽ liên hệ sớm.');
      setValues(emptyConsultForm);
      try {
        localStorage.setItem(CONSULTATION_SUBMITTED_KEY, '1');
      } catch {
        // ignore storage failures
      }
      onSuccess?.();
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'Không thể gửi thông tin lúc này, vui lòng thử lại sau.');
    }
  }

  return (
    <form className={`hero__consult ${className}`.trim()} onSubmit={handleSubmit} noValidate>
      <div className="auth-fields">
        <label className="auth-field">
          <span>Họ và tên</span>
          <input
            type="text"
            placeholder="Nguyễn Văn A"
            value={values.fullName}
            onChange={updateField('fullName')}
          />
        </label>

        <label className="auth-field">
          <span>Số điện thoại</span>
          <input
            type="tel"
            placeholder="0912345678"
            value={values.phone}
            onChange={updateField('phone')}
            autoComplete="tel"
          />
        </label>

        <label className="auth-field">
          <span>Email</span>
          <input type="email" placeholder="ban@email.com" value={values.email} onChange={updateField('email')} />
        </label>

        <label className="auth-field">
          <span>Chương trình quan tâm</span>
          <select value={values.program} onChange={updateField('program')}>
            <option value="">-- Chọn chương trình --</option>
            <option value="IELTS">IELTS</option>
            <option value="HSK">HSK</option>
          </select>
        </label>

        <label className="auth-field hero__consult-span">
          <span>Nhu cầu học tập</span>
          <input
            type="text"
            placeholder="VD: mất gốc, luyện giao tiếp, luyện thi cấp tốc..."
            value={values.needs}
            onChange={updateField('needs')}
          />
        </label>
      </div>

      {message ? (
        <div
          className={`auth-message hero__consult-message ${
            status === 'success' ? 'auth-message--success' : status === 'error' ? 'auth-message--error' : ''
          }`}
        >
          {message}
        </div>
      ) : null}

      <button type="submit" className="button auth-submit" disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Đang gửi...' : 'ĐĂNG KÝ NHẬN ƯU ĐÃI'}
      </button>
    </form>
  );
}
