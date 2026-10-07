import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthModalLink, AuthModalProvider, useAuthModal } from '../../providers/AuthModalProvider';
import { toVietnameseAuthError } from './authHelpers';

// Đăng nhập chuyển từ trang /auth 2 cột thành hộp thoại dùng chung. Test khóa
// lại: mở/đóng đúng cách, giữ nguyên các lời gọi AuthProvider, lỗi tiếng Việt,
// trạng thái chờ chống bấm lặp, và các màn Đăng ký / Quên mật khẩu.

const authState = {
  ready: true,
  session: null,
  profile: null,
  user: null,
  isMockMode: false,
  deviceKickedOut: false,
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  sendPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
  clearPasswordRecovery: vi.fn(),
  supabase: null
};

vi.mock('../../providers/AuthProvider', () => ({
  useAuth: () => authState
}));

function OpenResetButton() {
  const { openAuthModal } = useAuthModal();
  return (
    <button type="button" onClick={() => openAuthModal('reset-password')}>
      Mở đặt lại mật khẩu
    </button>
  );
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="path">{location.pathname}</output>;
}

function renderWithLink(initialPath = '/home') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthModalProvider>
        <AuthModalLink className="site-header__login">Đăng nhập</AuthModalLink>
        <AuthModalLink mode="sign-up">Đăng ký</AuthModalLink>
        <input aria-label="Ô ngoài hộp thoại" />
        <OpenResetButton />
        <Routes>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </AuthModalProvider>
    </MemoryRouter>
  );
}

function openModal(label = 'Đăng nhập') {
  fireEvent.click(screen.getByRole('link', { name: label }));
  return screen.getByRole('dialog');
}

async function waitForClosed() {
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.session = null;
  authState.profile = null;
  authState.deviceKickedOut = false;
});

describe('LoginModal', () => {
  it('bấm "Đăng nhập" mở hộp thoại tại chỗ, không đổi URL', () => {
    renderWithLink();
    const dialog = openModal();

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Chào mừng bạn trở lại');
    expect(screen.getByTestId('path')).toHaveTextContent('/home');
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Mật khẩu')).toBeInTheDocument();
  });

  it('đóng bằng nút X, phím ESC và bấm ra nền tối', async () => {
    renderWithLink();

    openModal();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    await waitForClosed();

    openModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitForClosed();

    const dialog = openModal();
    const scroller = dialog.parentElement;
    fireEvent.pointerDown(scroller);
    fireEvent.click(scroller);
    await waitForClosed();
  });

  it('bấm bên trong hộp thoại (hoặc nhấn trong, thả ngoài) không đóng', async () => {
    renderWithLink();
    const dialog = openModal();

    fireEvent.pointerDown(dialog);
    fireEvent.click(dialog);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.vn' } });

    // Kéo chọn chữ trong ô rồi thả ra nền: pointerdown ở trong, click ở nền.
    fireEvent.pointerDown(screen.getByLabelText('Email'));
    fireEvent.click(dialog.parentElement);

    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('a@b.vn');
  });

  it('báo lỗi ngay dưới ô khi bỏ trống, không gọi máy chủ', () => {
    renderWithLink();
    openModal();

    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(screen.getByText('Vui lòng nhập email.')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập mật khẩu.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(authState.signInWithEmail).not.toHaveBeenCalled();
  });

  it('sai mật khẩu: giữ hộp thoại, hiện lỗi tiếng Việt, không lộ lỗi kỹ thuật', async () => {
    authState.signInWithEmail.mockResolvedValue({
      data: { session: null },
      error: new Error('Invalid login credentials')
    });
    renderWithLink();
    openModal();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'hocvien@ngoaingu3k.vn' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'sai-mat-khau' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Email hoặc mật khẩu không chính xác.');
    expect(alert).not.toHaveTextContent(/Invalid|AuthApiError/);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(authState.signInWithEmail).toHaveBeenCalledWith('hocvien@ngoaingu3k.vn', 'sai-mat-khau');
  });

  it('đang gửi: nút chuyển "Đang đăng nhập..." và khóa, bấm lặp không gửi thêm', async () => {
    let resolveSignIn;
    authState.signInWithEmail.mockReturnValue(
      new Promise((resolve) => {
        resolveSignIn = resolve;
      })
    );
    renderWithLink();
    openModal();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'hocvien@ngoaingu3k.vn' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'matkhau123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    const busyButton = screen.getByRole('button', { name: /Đang đăng nhập/ });
    expect(busyButton).toBeDisabled();
    fireEvent.click(busyButton);
    fireEvent.submit(busyButton.closest('form'));
    expect(authState.signInWithEmail).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSignIn({ data: { session: null }, error: new Error('Invalid login credentials') });
    });
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).not.toBeDisabled();
  });

  it('đăng nhập đúng: hộp thoại tự đóng khi phiên và hồ sơ đã sẵn sàng', async () => {
    authState.signInWithEmail.mockImplementation(async () => {
      const session = { user: { id: 'u-1', email: 'hocvien@ngoaingu3k.vn' } };
      authState.session = session;
      authState.user = session.user;
      authState.profile = { id: 'u-1', full_name: 'Học Viên', phone: '0912345678' };
      return { data: { session }, error: null };
    });
    renderWithLink();
    openModal();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'hocvien@ngoaingu3k.vn' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'matkhau123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitForClosed();
    expect(screen.getByTestId('path')).toHaveTextContent('/home');
  });

  it('chuyển sang Đăng ký và quay lại trong cùng hộp thoại', () => {
    renderWithLink();
    openModal();

    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Tạo tài khoản');
    expect(screen.getByLabelText('Họ và tên')).toBeInTheDocument();
    expect(screen.getByLabelText('Số điện thoại')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Chào mừng bạn trở lại');
  });

  it('nút "Đăng ký" trên header mở thẳng màn tạo tài khoản; kiểm tra SĐT trước khi gửi', () => {
    renderWithLink();
    openModal('Đăng ký');

    fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: 'Học Viên' } });
    fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '123' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'moi@ngoaingu3k.vn' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'matkhau123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    expect(screen.getByText('Số điện thoại hợp lệ có từ 9 đến 15 chữ số.')).toBeInTheDocument();
    expect(authState.signUpWithEmail).not.toHaveBeenCalled();
  });

  it('Quên mật khẩu: gửi liên kết trong hộp thoại rồi báo đã gửi', async () => {
    authState.sendPasswordReset.mockResolvedValue({ data: {}, error: null });
    renderWithLink();
    openModal();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'hocvien@ngoaingu3k.vn' } });
    fireEvent.click(screen.getByRole('button', { name: 'Quên mật khẩu?' }));
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Khôi phục mật khẩu');
    // Email đã gõ ở màn đăng nhập được giữ lại.
    expect(screen.getByLabelText('Email')).toHaveValue('hocvien@ngoaingu3k.vn');

    fireEvent.click(screen.getByRole('button', { name: 'Gửi liên kết' }));
    expect(await screen.findByText(/liên kết đặt lại mật khẩu đã được gửi/)).toBeInTheDocument();
    expect(authState.sendPasswordReset).toHaveBeenCalledWith('hocvien@ngoaingu3k.vn');

    fireEvent.click(screen.getByRole('button', { name: 'Quay lại đăng nhập' }));
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Chào mừng bạn trở lại');
  });

  it('Google: hiện trạng thái đang chuyển và khóa nút', async () => {
    authState.signInWithGoogle.mockResolvedValue({ data: {}, error: null });
    renderWithLink();
    openModal();

    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục với Google' }));
    const googleButton = await screen.findByRole('button', { name: /Đang chuyển đến Google/ });
    expect(googleButton).toBeDisabled();
    expect(authState.signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('khóa cuộn trang phía sau khi mở và trả lại khi đóng', async () => {
    renderWithLink();
    openModal();
    expect(document.documentElement.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitForClosed();
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('đóng xong trả con trỏ về nút đã mở hộp thoại', async () => {
    renderWithLink();
    const trigger = screen.getByRole('link', { name: 'Đăng nhập' });
    trigger.focus();
    fireEvent.click(trigger);

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitForClosed();
    expect(document.activeElement).toBe(trigger);
  });
});

describe('Đặt mật khẩu mới (từ link trong email)', () => {
  it('kiểm tra độ dài và hai lần nhập khớp nhau trước khi gửi', () => {
    renderWithLink();
    fireEvent.click(screen.getByRole('button', { name: 'Mở đặt lại mật khẩu' }));
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Đặt mật khẩu mới');

    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }));
    expect(screen.getByText('Mật khẩu cần ít nhất 6 ký tự.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'matkhaumoi1' } });
    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), { target: { value: 'matkhaumoi2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }));
    expect(screen.getByText('Hai mật khẩu chưa khớp nhau.')).toBeInTheDocument();
    expect(authState.updatePassword).not.toHaveBeenCalled();
  });

  it('lưu thành công: báo đã đổi, bấm Tiếp tục học thì tắt cờ khôi phục và đóng', async () => {
    authState.updatePassword.mockResolvedValue({ data: {}, error: null });
    renderWithLink();
    fireEvent.click(screen.getByRole('button', { name: 'Mở đặt lại mật khẩu' }));

    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'matkhaumoi1' } });
    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), { target: { value: 'matkhaumoi1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }));

    expect(await screen.findByText(/Đã đổi mật khẩu/)).toBeInTheDocument();
    expect(authState.updatePassword).toHaveBeenCalledWith('matkhaumoi1');

    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục học' }));
    expect(authState.clearPasswordRecovery).toHaveBeenCalled();
    await waitForClosed();
  });

  it('mật khẩu mới trùng mật khẩu cũ: báo lỗi tiếng Việt, giữ hộp thoại', async () => {
    authState.updatePassword.mockResolvedValue({
      data: null,
      error: new Error('New password should be different from the old password.')
    });
    renderWithLink();
    fireEvent.click(screen.getByRole('button', { name: 'Mở đặt lại mật khẩu' }));
    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'matkhaucu1' } });
    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), { target: { value: 'matkhaucu1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Mật khẩu mới phải khác mật khẩu cũ.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('toVietnameseAuthError', () => {
  it('dịch lỗi Supabase quen thuộc, lỗi lạ dùng câu mặc định', () => {
    expect(toVietnameseAuthError(new Error('Invalid login credentials'), 'x')).toMatch(/không chính xác/);
    expect(toVietnameseAuthError({ message: 'Password should be at least 6 characters' }, 'x')).toBe(
      'Mật khẩu quá ngắn — cần ít nhất 6 ký tự.'
    );
    expect(toVietnameseAuthError(new Error('AuthApiError: something odd'), 'Câu mặc định')).toBe('Câu mặc định');
    // Supabase từ chối tên miền email (VD gõ nhầm, hoặc .local): trước đây rơi về câu chung chung.
    expect(
      toVietnameseAuthError(new Error('Email address "ban@gmail.con" is invalid'), 'x')
    ).toMatch(/Địa chỉ email không hợp lệ/);
  });
});
