import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// StudentProgressPage chỉ đọc auth.session?.access_token — không có Supabase
// hay session thật ở đây nên component tự rơi về dữ liệu demo
// (buildDemoRoster trong studentProgressService.js), giống hệt cách các
// trang khác trong app tự demo khi chưa cấu hình Supabase.
vi.mock('../providers/AuthProvider', () => ({
  useAuth: () => ({ session: null, profile: null, user: null })
}));

import StudentProgressPage from './StudentProgressPage';

describe('StudentProgressPage (demo/mock mode)', () => {
  it('hiện thẻ thống kê, biểu đồ xu hướng, thanh lọc và bảng học sinh demo', async () => {
    render(
      <MemoryRouter initialEntries={['/student-progress']}>
        <StudentProgressPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Theo dõi tiến độ học sinh')).toBeInTheDocument();

    // Thẻ thống kê học sinh mới
    expect(screen.getByText('Học sinh mới hôm nay')).toBeInTheDocument();
    expect(screen.getByText('Lũy kế toàn thời gian')).toBeInTheDocument();
    expect(screen.getByText('Cần liên hệ gia hạn')).toBeInTheDocument();

    // Thanh tìm kiếm + lọc
    expect(screen.getByPlaceholderText(/Tìm theo tên, SĐT hoặc email/i)).toBeInTheDocument();

    // Bảng học sinh demo (từ buildDemoRoster)
    expect(await screen.findByText('Minh Anh')).toBeInTheDocument();
    expect(screen.getByText('minh.anh@ngoaingu3k.com')).toBeInTheDocument();

    // Có ít nhất 1 badge trạng thái gói (demo cố tình có case "Đã hết hạn")
    expect(await screen.findByText('Đã hết hạn')).toBeInTheDocument();

    // Nút xuất Excel
    expect(screen.getByText('Xuất Excel')).toBeInTheDocument();
  });
});
