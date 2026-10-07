import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { useAuthModal } from '../providers/AuthModalProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import { getAuthModeFromSearch, needsProfileCompletion } from '../components/auth/authHelpers';
import HomePage from './HomePage';

// Route /auth không còn là trang đăng nhập 2 cột: nó hiện trang chủ phía sau và
// mở hộp thoại đăng nhập dùng chung (components/auth/LoginModal.jsx).
// Vẫn phải giữ route này vì:
//   - Google OAuth và email đặt lại mật khẩu quay về `${origin}/auth`
//     (AuthProvider) — có phiên rồi thì chuyển tiếp như trước;
//   - ProtectedRoute đẩy khách chưa đăng nhập về đây kèm state.from để đăng
//     nhập xong quay lại đúng trang;
//   - link /auth và /auth?mode=sign-up cũ (bookmark, tab mới) vẫn chạy.
export default function AuthPage() {
  usePageTitle('Đăng nhập');
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { openAuthModal, dismissAuthModal } = useAuthModal();
  const redirectTo = location.state?.from || '/dashboard';
  const mode = getAuthModeFromSearch(location.search);
  const profileIncomplete = needsProfileCompletion(auth);

  useEffect(() => {
    if (!auth.ready) return;

    if (auth.session) {
      // Vừa bấm link "đặt lại mật khẩu" trong email: cho đặt mật khẩu mới trước.
      if (auth.passwordRecovery) {
        openAuthModal('reset-password', { redirectTo, routeMode: true });
        return;
      }
      if (profileIncomplete) {
        openAuthModal('complete-profile', { redirectTo, routeMode: true });
        return;
      }
      // Đã đăng nhập (vừa quay về từ Google, hoặc vào /auth khi còn phiên).
      dismissAuthModal();
      navigate(redirectTo, { replace: true });
      return;
    }

    openAuthModal(mode, { redirectTo, routeMode: true });
    // openAuthModal/dismissAuthModal ổn định (useCallback).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.ready, auth.session, auth.passwordRecovery, profileIncomplete, mode, redirectTo]);

  return <HomePage />;
}
