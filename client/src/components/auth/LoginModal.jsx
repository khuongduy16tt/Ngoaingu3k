import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../providers/AuthProvider';
import {
  isValidEmail,
  isValidPhone,
  needsProfileCompletion,
  normalizePhone,
  toVietnameseAuthError
} from './authHelpers';

// Hộp thoại đăng nhập dùng chung cho cả site (mở qua AuthModalProvider).
// Logic xác thực giữ nguyên như trang /auth cũ: cùng các hàm của AuthProvider
// (signInWithEmail, signUpWithEmail, signInWithGoogle, sendPasswordReset), cùng
// RPC update_own_contact_profile để bổ sung hồ sơ. Chỉ đổi cách trình bày.

const LOGO_SRC = '/images/imported/logo-ngoaingu3k-clean.webp';
// Khớp thời lượng hiệu ứng đóng trong login-modal.css.
const EXIT_DURATION_MS = 180;
// Sau khi đăng nhập, chờ AuthProvider nạp xong hồ sơ để biết có cần bổ sung
// họ tên/SĐT không. Quá thời gian này thì coi như đủ và đóng hộp thoại.
const PROFILE_WAIT_MS = 4000;
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const VIEW_COPY = {
  'sign-in': {
    title: 'Chào mừng bạn trở lại',
    subtitle: 'Tiếp tục học tập cùng Ngoaingu3K'
  },
  'sign-up': {
    title: 'Tạo tài khoản',
    subtitle: 'Thiết lập hồ sơ học viên và bắt đầu lộ trình của bạn'
  },
  forgot: {
    title: 'Khôi phục mật khẩu',
    subtitle: 'Nhập email để nhận liên kết đặt lại mật khẩu'
  },
  'complete-profile': {
    title: 'Bổ sung thông tin liên hệ',
    subtitle: 'Tài khoản cần có họ tên và số điện thoại trước khi vào khu học tập'
  },
  'reset-password': {
    title: 'Đặt mật khẩu mới',
    subtitle: 'Chọn mật khẩu mới cho tài khoản của bạn'
  }
};

function GoogleLogo() {
  return (
    <svg className="login-modal__google-logo" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.78-.07-1.53-.2-2.23H12v4.22h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.52Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.25l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.05v2.59A9.99 9.99 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 14.08A6 6 0 0 1 6.08 12c0-.72.12-1.42.32-2.08V7.33H3.05A9.99 9.99 0 0 0 2 12c0 1.61.38 3.13 1.05 4.67l3.35-2.59Z" />
      <path fill="#EA4335" d="M12 5.8c1.47 0 2.8.51 3.84 1.5l2.86-2.86C16.96 2.82 14.7 2 12 2a9.99 9.99 0 0 0-8.95 5.33L6.4 9.92C7.19 7.56 9.4 5.8 12 5.8Z" />
    </svg>
  );
}

function EyeIcon({ open }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
      {open ? null : <path d="M4 20 20 4" />}
    </svg>
  );
}

function Spinner() {
  return <span className="login-modal__spinner" aria-hidden="true" />;
}

// Thuộc tính a11y cho ô nhập: id khớp nhãn, lỗi gắn qua aria-describedby.
function inputA11y(id, error) {
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : undefined
  };
}

// Ô nhập có nhãn thật (không chỉ placeholder) và dòng lỗi ngay dưới ô.
function Field({ id, label, error, aside, children }) {
  const errorId = `${id}-error`;
  return (
    <div className={`login-modal__field ${error ? 'has-error' : ''}`}>
      <div className="login-modal__label-row">
        <label htmlFor={id}>{label}</label>
        {aside}
      </div>
      {children}
      {error ? (
        <p id={errorId} className="login-modal__field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function LoginDialog({ initialView, closing, onClose, onSuccess, returnFocusRef }) {
  const auth = useAuth();
  const ids = useId();
  const titleId = `${ids}-title`;
  const descId = `${ids}-desc`;
  const panelRef = useRef(null);
  const scrollerRef = useRef(null);
  const pointerDownOnBackdropRef = useRef(false);

  const [view, setView] = useState(initialView);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState(auth.profile?.full_name || '');
  const [phone, setPhone] = useState(auth.profile?.phone || '');
  const [passwordVisible, setPasswordVisible] = useState(false);
  // '' | 'submit' | 'google' | 'reset' | 'profile' — nút nào đang chờ máy chủ.
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [resetSentTo, setResetSentTo] = useState('');
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  // Đã đăng nhập xong, đang chờ hồ sơ để quyết định đóng hay bổ sung hồ sơ.
  const [awaitingUserId, setAwaitingUserId] = useState('');
  const [profileWaitExpired, setProfileWaitExpired] = useState(false);

  const isBusy = Boolean(busy) || Boolean(awaitingUserId);
  const copy = VIEW_COPY[view] || VIEW_COPY['sign-in'];

  // Nhà cung cấp mở lại hộp thoại ở chế độ khác (VD bấm "Đăng ký" trên header).
  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  // Đổi màn: xóa thông báo cũ, đưa con trỏ vào ô nhập đầu tiên của màn mới.
  function switchView(nextView, nextMessage = null) {
    setView(nextView);
    setMessage(nextMessage);
    setFieldErrors({});
    setPasswordVisible(false);
  }

  // ── Khóa nền: không cuộn, không tab/đọc được nội dung phía sau ───────────
  useLayoutEffect(() => {
    if (closing) return undefined;
    const root = document.getElementById('root');
    const html = document.documentElement;
    const previous = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: document.body.style.overflow,
      bodyPaddingRight: document.body.style.paddingRight
    };
    // Ẩn thanh cuộn thì nội dung rộng thêm đúng bề rộng thanh cuộn và giật
    // sang phải — bù lại bằng padding (điện thoại thanh cuộn nổi nên = 0).
    const scrollbarWidth = window.innerWidth - html.clientWidth;
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    root?.setAttribute('inert', '');

    return () => {
      html.style.overflow = previous.htmlOverflow;
      document.body.style.overflow = previous.bodyOverflow;
      document.body.style.paddingRight = previous.bodyPaddingRight;
      root?.removeAttribute('inert');
    };
  }, [closing]);

  // Đã đổi mật khẩu rồi đóng bằng X/ESC: tắt cờ khôi phục, không hỏi lại nữa.
  useEffect(() => {
    if (closing && passwordUpdated) {
      auth.clearPasswordRecovery?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing, passwordUpdated]);

  // Đóng xong thì trả con trỏ về nút đã mở hộp thoại (nút đó có thể đã biến mất
  // vì header đổi sang avatar — khi đó về vùng nội dung chính).
  useEffect(() => {
    if (!closing) return;
    const target = returnFocusRef?.current;
    const fallback = document.getElementById('main-content');
    const next = target && target.isConnected && target !== document.body ? target : fallback;
    next?.focus?.({ preventScroll: true });
  }, [closing, returnFocusRef]);

  // ── Con trỏ vào ô đầu tiên mỗi khi mở / đổi màn ─────────────────────────
  useEffect(() => {
    if (closing) return undefined;
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target =
        panel.querySelector('[data-autofocus]') ||
        panel.querySelector('input:not([disabled]):not([readonly])') ||
        panel.querySelector(FOCUSABLE);
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [view, closing, resetSentTo, passwordUpdated]);

  // ── ESC đóng, Tab xoay vòng trong hộp thoại ─────────────────────────────
  useEffect(() => {
    if (closing) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusables = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter(
        (element) => element.offsetParent !== null || element === document.activeElement
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panelRef.current.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closing, onClose]);

  // ── Sau khi đăng nhập: đợi hồ sơ rồi đóng hoặc chuyển sang bổ sung hồ sơ ──
  useEffect(() => {
    if (!awaitingUserId) return undefined;
    const timer = setTimeout(() => setProfileWaitExpired(true), PROFILE_WAIT_MS);
    return () => clearTimeout(timer);
  }, [awaitingUserId]);

  useEffect(() => {
    if (!awaitingUserId || !auth.ready || auth.session?.user?.id !== awaitingUserId) return;
    const profileLoaded = auth.isMockMode || auth.profile?.id === awaitingUserId || profileWaitExpired;
    if (!profileLoaded) return;

    setAwaitingUserId('');
    setBusy('');
    if (auth.profile?.id === awaitingUserId && needsProfileCompletion(auth)) {
      setFullName(auth.profile?.full_name || fullName);
      setPhone(auth.profile?.phone || phone);
      switchView('complete-profile', {
        type: 'info',
        text: 'Đăng nhập thành công. Bổ sung họ tên và số điện thoại để tiếp tục.'
      });
      return;
    }
    onSuccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingUserId, auth.ready, auth.session, auth.profile, profileWaitExpired]);

  // ── Kiểm tra dữ liệu nhập ───────────────────────────────────────────────
  function validate(target) {
    const errors = {};
    if (target !== 'complete-profile' && target !== 'reset-password') {
      if (!email.trim()) errors.email = 'Vui lòng nhập email.';
      else if (!isValidEmail(email)) errors.email = 'Email chưa đúng định dạng (ví dụ: ban@gmail.com).';
    }
    if (target === 'reset-password') {
      if (!password) errors.password = 'Vui lòng nhập mật khẩu mới.';
      else if (password.length < 6) errors.password = 'Mật khẩu cần ít nhất 6 ký tự.';
      if (!errors.password && confirmPassword !== password) errors.confirmPassword = 'Hai mật khẩu chưa khớp nhau.';
    }
    if (target === 'sign-in' || target === 'sign-up') {
      if (!password) errors.password = 'Vui lòng nhập mật khẩu.';
      else if (target === 'sign-up' && password.length < 6) errors.password = 'Mật khẩu cần ít nhất 6 ký tự.';
    }
    if (target === 'sign-up' || target === 'complete-profile') {
      if (!fullName.trim()) errors.fullName = 'Vui lòng nhập họ và tên.';
      if (!isValidPhone(phone)) errors.phone = 'Số điện thoại hợp lệ có từ 9 đến 15 chữ số.';
    }
    setFieldErrors(errors);
    const firstInvalid = Object.keys(errors)[0];
    if (firstInvalid) {
      panelRef.current?.querySelector(`[data-field="${firstInvalid}"]`)?.focus();
      return false;
    }
    return true;
  }

  async function handleSignIn(event) {
    event.preventDefault();
    if (isBusy || !validate('sign-in')) return;

    setBusy('submit');
    setMessage(null);
    try {
      const result = await auth.signInWithEmail(email.trim(), password);
      if (result?.error) throw result.error;
      const userId = result?.data?.session?.user?.id;
      if (userId) {
        setAwaitingUserId(userId);
        return;
      }
      setBusy('');
    } catch (error) {
      setBusy('');
      setMessage({
        type: 'error',
        text: toVietnameseAuthError(error, 'Đăng nhập chưa thành công. Vui lòng thử lại.')
      });
    }
  }

  async function handleSignUp(event) {
    event.preventDefault();
    if (isBusy || !validate('sign-up')) return;

    setBusy('submit');
    setMessage(null);
    try {
      const result = await auth.signUpWithEmail(email.trim(), password, {
        full_name: fullName.trim(),
        phone: normalizePhone(phone),
        role: 'student'
      });
      if (result?.error) throw result.error;

      const userId = result?.data?.session?.user?.id;
      if (userId) {
        setAwaitingUserId(userId);
        return;
      }

      // Supabase bật xác nhận email: chưa có phiên, quay về màn đăng nhập.
      setBusy('');
      setPassword('');
      switchView('sign-in', {
        type: 'success',
        text: 'Tài khoản đã được tạo. Vui lòng kiểm tra email để xác nhận tài khoản, rồi đăng nhập.'
      });
    } catch (error) {
      setBusy('');
      setMessage({ type: 'error', text: toVietnameseAuthError(error, 'Chưa tạo được tài khoản. Vui lòng thử lại.') });
    }
  }

  async function handleGoogle() {
    if (isBusy) return;
    setBusy('google');
    setMessage(null);

    const result = await auth.signInWithGoogle();
    if (result?.error) {
      setBusy('');
      setMessage({
        type: 'error',
        text: toVietnameseAuthError(result.error, 'Chưa kết nối được với Google. Vui lòng thử lại.')
      });
      return;
    }

    // Chế độ mock (không có Supabase) đăng nhập ngay, không chuyển trang.
    const userId = result?.data?.session?.user?.id;
    if (userId) {
      setAwaitingUserId(userId);
    }
    // Chế độ thật: trình duyệt đang chuyển sang Google — giữ trạng thái chờ.
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    if (isBusy || !validate('forgot')) return;

    setBusy('reset');
    setMessage(null);
    const result = await auth.sendPasswordReset(email.trim());
    setBusy('');
    if (result?.error) {
      setMessage({
        type: 'error',
        text: toVietnameseAuthError(result.error, 'Chưa gửi được email đặt lại mật khẩu. Vui lòng thử lại.')
      });
      return;
    }
    setResetSentTo(email.trim());
  }

  async function handleUpdatePassword(event) {
    event.preventDefault();
    if (isBusy || !validate('reset-password')) return;

    setBusy('password');
    setMessage(null);
    const result = await auth.updatePassword(password);
    setBusy('');
    if (result?.error) {
      setMessage({
        type: 'error',
        text: toVietnameseAuthError(result.error, 'Chưa đổi được mật khẩu. Vui lòng thử lại.')
      });
      return;
    }
    setPasswordUpdated(true);
  }

  async function handleCompleteProfile(event) {
    event.preventDefault();
    if (isBusy || !validate('complete-profile')) return;

    setBusy('profile');
    setMessage(null);
    try {
      const normalizedPhone = normalizePhone(phone);
      const { error: profileError } = await auth.supabase.rpc('update_own_contact_profile', {
        profile_full_name: fullName.trim(),
        profile_phone: normalizedPhone
      });
      if (profileError) throw profileError;

      const result = await auth.supabase.auth.updateUser({
        data: { full_name: fullName.trim(), phone: normalizedPhone }
      });
      if (result?.error) throw result.error;

      setBusy('');
      onSuccess();
    } catch (error) {
      setBusy('');
      setMessage({ type: 'error', text: toVietnameseAuthError(error, 'Chưa thể cập nhật hồ sơ. Vui lòng thử lại.') });
    }
  }

  // Bấm ra ngoài: chỉ đóng khi cả lúc nhấn lẫn lúc thả đều ở nền tối — kéo chọn
  // chữ trong ô nhập rồi thả chuột ra ngoài không làm mất form đang gõ.
  function handleBackdropPointerDown(event) {
    pointerDownOnBackdropRef.current = event.target === scrollerRef.current;
  }

  function handleBackdropClick(event) {
    if (pointerDownOnBackdropRef.current && event.target === scrollerRef.current) {
      onClose();
    }
    pointerDownOnBackdropRef.current = false;
  }

  function clearFieldError(name) {
    if (fieldErrors[name]) {
      setFieldErrors((previous) => ({ ...previous, [name]: undefined }));
    }
  }

  const submitLabel = {
    'sign-in': busy === 'submit' || (awaitingUserId && busy !== 'google') ? 'Đang đăng nhập...' : 'Đăng nhập',
    'sign-up': busy === 'submit' || awaitingUserId ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'
  };

  const emailField = (
    <Field id={`${ids}-email`} label="Email" error={fieldErrors.email}>
      <input
        {...inputA11y(`${ids}-email`, fieldErrors.email)}
        data-field="email"
        className="login-modal__input"
        type="email"
        inputMode="email"
        placeholder="student@example.com"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          clearFieldError('email');
        }}
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        disabled={isBusy}
      />
    </Field>
  );

  const passwordField = (
    <Field
      id={`${ids}-password`}
      label="Mật khẩu"
      error={fieldErrors.password}
      aside={
        view === 'sign-in' ? (
          <button
            type="button"
            className="login-modal__text-button"
            onClick={() => switchView('forgot')}
            disabled={isBusy}
          >
            Quên mật khẩu?
          </button>
        ) : null
      }
    >
      <div className="login-modal__password">
        <input
          {...inputA11y(`${ids}-password`, fieldErrors.password)}
          data-field="password"
          className="login-modal__input"
          type={passwordVisible ? 'text' : 'password'}
          placeholder={view === 'sign-up' ? 'Ít nhất 6 ký tự' : '••••••••'}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            clearFieldError('password');
          }}
          autoComplete={view === 'sign-up' ? 'new-password' : 'current-password'}
          disabled={isBusy}
        />
        <button
          type="button"
          className="login-modal__eye"
          onClick={() => setPasswordVisible((visible) => !visible)}
          aria-label={passwordVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          aria-pressed={passwordVisible}
        >
          <EyeIcon open={passwordVisible} />
        </button>
      </div>
    </Field>
  );

  const nameField = (
    <Field id={`${ids}-name`} label="Họ và tên" error={fieldErrors.fullName}>
      <input
        {...inputA11y(`${ids}-name`, fieldErrors.fullName)}
        data-field="fullName"
        className="login-modal__input"
        type="text"
        placeholder="Nguyễn Văn A"
        value={fullName}
        onChange={(event) => {
          setFullName(event.target.value);
          clearFieldError('fullName');
        }}
        autoComplete="name"
        disabled={isBusy}
      />
    </Field>
  );

  const phoneField = (
    <Field id={`${ids}-phone`} label="Số điện thoại" error={fieldErrors.phone}>
      <input
        {...inputA11y(`${ids}-phone`, fieldErrors.phone)}
        data-field="phone"
        className="login-modal__input"
        type="tel"
        inputMode="tel"
        placeholder="0912345678"
        value={phone}
        onChange={(event) => {
          setPhone(event.target.value);
          clearFieldError('phone');
        }}
        autoComplete="tel"
        disabled={isBusy}
      />
    </Field>
  );

  const messageBox = message ? (
    <div
      className={`login-modal__message login-modal__message--${message.type}`}
      role={message.type === 'error' ? 'alert' : 'status'}
    >
      {message.text}
    </div>
  ) : null;

  let body;
  if (view === 'reset-password') {
    body = passwordUpdated ? (
      <div className="login-modal__sent" role="status">
        <span className="login-modal__sent-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        </span>
        <p>Đã đổi mật khẩu. Lần sau hãy đăng nhập bằng mật khẩu mới.</p>
        <button
          type="button"
          className="login-modal__submit"
          data-autofocus
          onClick={() => {
            auth.clearPasswordRecovery?.();
            onSuccess();
          }}
        >
          Tiếp tục học
        </button>
      </div>
    ) : (
      <form className="login-modal__form" onSubmit={handleUpdatePassword} noValidate>
        {messageBox}
        <Field id={`${ids}-new-password`} label="Mật khẩu mới" error={fieldErrors.password}>
          <div className="login-modal__password">
            <input
              {...inputA11y(`${ids}-new-password`, fieldErrors.password)}
              data-field="password"
              className="login-modal__input"
              type={passwordVisible ? 'text' : 'password'}
              placeholder="Ít nhất 6 ký tự"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                clearFieldError('password');
              }}
              autoComplete="new-password"
              disabled={isBusy}
            />
            <button
              type="button"
              className="login-modal__eye"
              onClick={() => setPasswordVisible((visible) => !visible)}
              aria-label={passwordVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              aria-pressed={passwordVisible}
            >
              <EyeIcon open={passwordVisible} />
            </button>
          </div>
        </Field>
        <Field id={`${ids}-confirm-password`} label="Nhập lại mật khẩu mới" error={fieldErrors.confirmPassword}>
          <input
            {...inputA11y(`${ids}-confirm-password`, fieldErrors.confirmPassword)}
            data-field="confirmPassword"
            className="login-modal__input"
            type={passwordVisible ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              clearFieldError('confirmPassword');
            }}
            autoComplete="new-password"
            disabled={isBusy}
          />
        </Field>
        <button type="submit" className="login-modal__submit" disabled={isBusy} aria-busy={busy === 'password'}>
          {busy === 'password' ? <Spinner /> : null}
          {busy === 'password' ? 'Đang lưu...' : 'Lưu mật khẩu mới'}
        </button>
      </form>
    );
  } else if (view === 'forgot') {
    body = resetSentTo ? (
      <div className="login-modal__sent" role="status">
        <span className="login-modal__sent-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M3.5 6.5h17v11h-17z" />
            <path d="m4 7 8 6 8-6" />
          </svg>
        </span>
        <p>
          Nếu <strong>{resetSentTo}</strong> đã có tài khoản, liên kết đặt lại mật khẩu đã được gửi tới hộp thư. Kiểm
          tra cả mục Spam/Quảng cáo nếu chưa thấy.
        </p>
        <button type="button" className="login-modal__submit" data-autofocus onClick={() => switchView('sign-in')}>
          Quay lại đăng nhập
        </button>
      </div>
    ) : (
      <form className="login-modal__form" onSubmit={handleResetPassword} noValidate>
        {messageBox}
        {emailField}
        <button type="submit" className="login-modal__submit" disabled={isBusy} aria-busy={busy === 'reset'}>
          {busy === 'reset' ? <Spinner /> : null}
          {busy === 'reset' ? 'Đang gửi...' : 'Gửi liên kết'}
        </button>
      </form>
    );
  } else if (view === 'complete-profile') {
    body = (
      <form className="login-modal__form" onSubmit={handleCompleteProfile} noValidate>
        {messageBox}
        {nameField}
        <div className="login-modal__field">
          <div className="login-modal__label-row">
            <label htmlFor={`${ids}-account-email`}>Email</label>
          </div>
          <input
            id={`${ids}-account-email`}
            className="login-modal__input"
            type="email"
            value={auth.user?.email || ''}
            readOnly
          />
        </div>
        {phoneField}
        <button type="submit" className="login-modal__submit" disabled={isBusy} aria-busy={busy === 'profile'}>
          {busy === 'profile' ? <Spinner /> : null}
          {busy === 'profile' ? 'Đang lưu...' : 'Lưu hồ sơ'}
        </button>
      </form>
    );
  } else {
    const isSignUp = view === 'sign-up';
    body = (
      <>
        <form className="login-modal__form" onSubmit={isSignUp ? handleSignUp : handleSignIn} noValidate>
          {/* Máy này vừa bị đăng xuất vì tài khoản đăng nhập ở thiết bị khác. */}
          {!isSignUp && auth.deviceKickedOut ? (
            <div className="login-modal__message login-modal__message--error" role="alert">
              Tài khoản của bạn vừa đăng nhập trên một thiết bị khác nên thiết bị này đã đăng xuất. Mỗi tài khoản chỉ
              học được trên một thiết bị — đăng nhập lại để tiếp tục.
            </div>
          ) : null}
          {messageBox}
          {isSignUp ? nameField : null}
          {isSignUp ? phoneField : null}
          {emailField}
          {passwordField}
          <button
            type="submit"
            className="login-modal__submit"
            disabled={isBusy}
            aria-busy={busy === 'submit' || Boolean(awaitingUserId && busy !== 'google')}
          >
            {busy === 'submit' || (awaitingUserId && busy !== 'google') ? <Spinner /> : null}
            {submitLabel[view]}
          </button>
        </form>

        {isSignUp ? null : (
          <>
            <div className="login-modal__divider" aria-hidden="true">
              <span>Hoặc tiếp tục với</span>
            </div>
            <button
              type="button"
              className="login-modal__google"
              onClick={handleGoogle}
              disabled={isBusy}
              aria-busy={busy === 'google'}
            >
              {busy === 'google' ? <Spinner /> : <GoogleLogo />}
              <span>{busy === 'google' ? 'Đang chuyển đến Google...' : 'Tiếp tục với Google'}</span>
            </button>
          </>
        )}

        <p className="login-modal__switch">
          {isSignUp ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}{' '}
          <button
            type="button"
            className="login-modal__text-button"
            onClick={() => switchView(isSignUp ? 'sign-in' : 'sign-up')}
            disabled={isBusy}
          >
            {isSignUp ? 'Đăng nhập' : 'Tạo tài khoản'}
          </button>
        </p>
      </>
    );
  }

  return (
    <div className="login-modal" data-state={closing ? 'closed' : 'open'}>
      <div className="login-modal__backdrop" aria-hidden="true" />
      <div
        ref={scrollerRef}
        className="login-modal__scroller"
        onPointerDown={handleBackdropPointerDown}
        onClick={handleBackdropClick}
      >
        <div
          ref={panelRef}
          className="login-modal__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
        >
          <div className="login-modal__topbar">
            {view === 'forgot' ? (
              <button
                type="button"
                className="login-modal__back"
                onClick={() => {
                  setResetSentTo('');
                  switchView('sign-in');
                }}
                disabled={isBusy}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M14.5 6 8.5 12l6 6" />
                </svg>
                Quay lại
              </button>
            ) : (
              <span />
            )}
            <button type="button" className="login-modal__close" onClick={onClose} aria-label="Đóng">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          {/* key theo màn → khối được dựng lại và chạy hiệu ứng chuyển nhẹ. */}
          <div key={view} className="login-modal__view">
            <header className="login-modal__head">
              {view === 'forgot' ? null : (
                <img className="login-modal__logo" src={LOGO_SRC} alt="Ngoaingu3K" width="120" height="86" />
              )}
              <h2 id={titleId}>{copy.title}</h2>
              <p id={descId}>{copy.subtitle}</p>
            </header>
            {body}
          </div>
        </div>
      </div>
    </div>
  );
}

// Giữ hộp thoại trong DOM thêm một nhịp khi đóng để chạy hiệu ứng thu nhỏ/mờ.
export function LoginModal({ open, view = 'sign-in', onClose, onSuccess, returnFocusRef }) {
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      setClosing(false);
      return undefined;
    }
    if (!rendered) return undefined;
    setClosing(true);
    const timer = setTimeout(() => {
      setRendered(false);
      setClosing(false);
    }, EXIT_DURATION_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!rendered || typeof document === 'undefined') return null;

  return createPortal(
    <LoginDialog
      initialView={view}
      closing={closing}
      onClose={onClose}
      onSuccess={onSuccess}
      returnFocusRef={returnFocusRef}
    />,
    document.body
  );
}
