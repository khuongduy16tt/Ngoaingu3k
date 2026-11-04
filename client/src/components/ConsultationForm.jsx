import React, { useState } from 'react';
import { submitConsultationRequest } from '../lib/leadService';
import { toFriendlyError } from '../lib/friendlyError';

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
      setMessage('Vui lòng nhập họ tên, số điện thoại và chọn IELTS hoặc HSK.');
      return;
    }

    setStatus('submitting');
    setMessage('');

    try {
      const result = await submitConsultationRequest(values);
      setStatus('success');
      setMessage(toFriendlyError(result, 'Đăng ký tư vấn thành công, chúng tôi sẽ liên hệ sớm.'));
      setValues(emptyConsultForm);
      try {
        localStorage.setItem(CONSULTATION_SUBMITTED_KEY, '1');
      } catch {
        // ignore storage failures
      }
      onSuccess?.();
    } catch (error) {
      setStatus('error');
      setMessage(toFriendlyError(error, 'Không thể gửi thông tin lúc này, vui lòng thử lại sau.'));
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
            autoComplete="name"
          />
        </label>

        <label className="auth-field">
          <span>Số điện thoại</span>
          <input
            type="tel"
            inputMode="tel"
            placeholder="0912345678"
            value={values.phone}
            onChange={updateField('phone')}
            autoComplete="tel"
          />
        </label>

        <fieldset className="auth-field consult-program hero__consult-span">
          <legend>Bạn muốn học</legend>
          <div className="consult-program__options">
            {['IELTS', 'HSK'].map((program) => (
              <label key={program} className={`consult-program__option ${values.program === program ? 'is-selected' : ''}`}>
                <input
                  type="radio"
                  name="consult-program"
                  value={program}
                  checked={values.program === program}
                  onChange={updateField('program')}
                />
                {program === 'IELTS' ? 'Tiếng Anh · IELTS' : 'Tiếng Trung · HSK'}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {message ? (
        <div
          role={status === 'error' ? 'alert' : 'status'}
          className={`auth-message hero__consult-message ${
            status === 'success' ? 'auth-message--success' : status === 'error' ? 'auth-message--error' : ''
          }`}
        >
          {message}
        </div>
      ) : null}

      <button type="submit" className="button auth-submit" disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Đang gửi...' : 'Nhận lộ trình miễn phí'}
      </button>
    </form>
  );
}
