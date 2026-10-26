import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Hồ sơ: họ tên/số điện thoại kiểm tra như form đăng ký, đổi được mật khẩu
// (trừ tài khoản Google), không còn ô "ngày hoạt động" và "ID người dùng".

vi.mock('../lib/supabase', async (importOriginal) => ({
  ...(await importOriginal()),
  supabase: null,
  isSupabaseReady: () => false
}));

const authState = {};

vi.mock('../providers/AuthProvider', () => ({
  useAuth: () => authState
}));

import ProfilePage from './ProfilePage';

function renderPage() {
  return render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  Object.assign(authState, {
    ready: true,
    session: { access_token: 'token' },
    user: { id: 'u1', email: 'hv@ngoaingu3k.local', app_metadata: { provider: 'email' }, created_at: '2026-01-01' },
    profile: { full_name: 'Học Viên', phone: '0912345678', role: 'student' },
    updateProfile: vi.fn(async () => ({ error: null })),
    updatePassword: vi.fn(async () => ({ data: {}, error: null })),
    signOut: vi.fn()
  });
});

describe('ProfilePage', () => {
  it('chặn lưu khi họ tên trống hoặc số điện thoại sai', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: '  ' } });
    fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }));

    expect(await screen.findByText('Vui lòng nhập họ và tên.')).toBeInTheDocument();
    expect(screen.getByText('Số điện thoại hợp lệ có từ 9 đến 15 chữ số.')).toBeInTheDocument();
    expect(authState.updateProfile).not.toHaveBeenCalled();
  });

  it('lưu số điện thoại đã bỏ khoảng trắng', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0912 345 679' } });
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }));
    await waitFor(() =>
      expect(authState.updateProfile).toHaveBeenCalledWith({ full_name: 'Học Viên', phone: '0912345679' })
    );
  });

  it('đổi mật khẩu: kiểm tra độ dài và khớp nhau rồi mới gọi', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'abc' } });
    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), { target: { value: 'abd' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    expect(await screen.findByText('Mật khẩu cần ít nhất 6 ký tự.')).toBeInTheDocument();
    expect(screen.getByText('Hai mật khẩu chưa khớp nhau.')).toBeInTheDocument();
    expect(authState.updatePassword).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'matkhaumoi1' } });
    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), { target: { value: 'matkhaumoi1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    expect(await screen.findByText(/Đã đổi mật khẩu/)).toBeInTheDocument();
    expect(authState.updatePassword).toHaveBeenCalledWith('matkhaumoi1');
  });

  it('tài khoản Google không có form đổi mật khẩu', () => {
    authState.user = { ...authState.user, app_metadata: { provider: 'google' } };
    renderPage();
    expect(screen.queryByRole('button', { name: 'Đổi mật khẩu' })).not.toBeInTheDocument();
    expect(screen.getByText(/đăng nhập bằng Google/)).toBeInTheDocument();
  });

  it('không còn ô "ngày hoạt động" và "ID người dùng"', () => {
    renderPage();
    expect(screen.queryByText(/ngày hoạt động/)).not.toBeInTheDocument();
    expect(screen.queryByText('ID người dùng')).not.toBeInTheDocument();
    expect(screen.getAllByText('Học viên').length).toBeGreaterThan(0);
  });
});
