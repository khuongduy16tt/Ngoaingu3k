import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LoginModal } from '../components/auth/LoginModal';

// Một hộp thoại đăng nhập duy nhất cho cả site. Mọi nút "Đăng nhập/Đăng ký"
// gọi openAuthModal() thay vì chuyển sang trang /auth — trang đang xem vẫn nằm
// nguyên phía sau. Route /auth vẫn còn (Google OAuth, email đặt lại mật khẩu và
// ProtectedRoute đều dẫn về đó) và chỉ mở cùng hộp thoại này trên trang chủ.

const AuthModalContext = createContext(null);

export function AuthModalProvider({ children }) {
  const navigate = useNavigate();
  const [modal, setModal] = useState({ open: false, view: 'sign-in', redirectTo: null, routeMode: false });
  const modalRef = useRef(modal);
  modalRef.current = modal;
  const returnFocusRef = useRef(null);

  // options.redirectTo: trang cần tới sau khi đăng nhập (mặc định ở nguyên).
  // options.routeMode: mở từ route /auth — đóng mà chưa đăng nhập thì về trang chủ.
  const openAuthModal = useCallback((view = 'sign-in', options = {}) => {
    if (!modalRef.current.open) {
      returnFocusRef.current = document.activeElement;
    }
    setModal({
      open: true,
      view,
      redirectTo: options.redirectTo ?? null,
      routeMode: Boolean(options.routeMode)
    });
  }, []);

  const finish = useCallback(
    (succeeded) => {
      const { open, redirectTo, routeMode } = modalRef.current;
      if (!open) return;
      setModal((previous) => ({ ...previous, open: false }));

      if (succeeded && redirectTo) {
        navigate(redirectTo, { replace: routeMode });
      } else if (!succeeded && routeMode) {
        navigate('/home', { replace: true });
      }
    },
    [navigate]
  );

  const closeAuthModal = useCallback(() => finish(false), [finish]);
  const handleSuccess = useCallback(() => finish(true), [finish]);

  // Đóng mà không điều hướng (route /auth tự chuyển trang khi đã có phiên).
  const dismissAuthModal = useCallback(() => {
    setModal((previous) => (previous.open ? { ...previous, open: false } : previous));
  }, []);

  const value = useMemo(
    () => ({ isOpen: modal.open, openAuthModal, closeAuthModal, dismissAuthModal }),
    [modal.open, openAuthModal, closeAuthModal, dismissAuthModal]
  );

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      <LoginModal
        open={modal.open}
        view={modal.view}
        onClose={closeAuthModal}
        onSuccess={handleSuccess}
        returnFocusRef={returnFocusRef}
      />
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const context = useContext(AuthModalContext);
  if (!context) {
    throw new Error('AuthModalProvider is missing');
  }
  return context;
}

// Link tới /auth (giữ được mở tab mới, chuột giữa, không JS) nhưng bấm thường
// thì mở hộp thoại tại chỗ, không rời trang.
export function AuthModalLink({ mode = 'sign-in', redirectTo, onClick, children, ...rest }) {
  const { openAuthModal } = useAuthModal();

  function handleClick(event) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    openAuthModal(mode, { redirectTo });
  }

  return (
    <Link to={mode === 'sign-up' ? '/auth?mode=sign-up' : '/auth'} onClick={handleClick} {...rest}>
      {children}
    </Link>
  );
}
