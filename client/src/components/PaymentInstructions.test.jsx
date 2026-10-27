import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PaymentInstructions } from './PaymentInstructions';

const baseOrder = {
  id: 'order-1',
  courseTitle: 'HSK 1',
  amount: 500000,
  transferCode: 'NN3K123',
  status: 'pending'
};

function renderPayment(props) {
  return render(
    <MemoryRouter>
      <PaymentInstructions order={baseOrder} {...props} />
    </MemoryRouter>
  );
}

describe('PaymentInstructions', () => {
  it('đang chờ: có link Zalo/điện thoại và hiện kết quả lần kiểm tra tay', () => {
    renderPayment({ onCheckNow: vi.fn(), checkNote: 'Chưa thấy tiền về.' });
    expect(screen.getByRole('link', { name: 'Zalo' })).toHaveAttribute('href', expect.stringContaining('zalo.me'));
    expect(screen.getByRole('link', { name: /0949/ })).toHaveAttribute('href', expect.stringContaining('tel:'));
    expect(screen.getByText('Chưa thấy tiền về.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kiểm tra ngay' })).toBeEnabled();
  });

  it('đã trả tiền: có nút Vào học ngay dẫn tới khóa học', () => {
    const onClose = vi.fn();
    renderPayment({ order: { ...baseOrder, status: 'paid' }, learnHref: '/learn/hsk-1', onClose });
    const learn = screen.getByRole('link', { name: 'Vào học ngay' });
    expect(learn).toHaveAttribute('href', '/learn/hsk-1');
    fireEvent.click(screen.getByRole('button', { name: 'Để sau' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('đã trả tiền combo (không có link học): chỉ có nút xem khóa đã mua', () => {
    renderPayment({ order: { ...baseOrder, status: 'paid' }, onClose: vi.fn() });
    expect(screen.queryByRole('link', { name: 'Vào học ngay' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xem khóa đã mua' })).toBeInTheDocument();
  });

  it("đang tạo đơn: hiện ngay tên khóa + số tiền, chưa có nút kiểm tra", () => {
    renderPayment({ order: { status: "creating", courseTitle: "HSK 2", amount: 900000 }, onCheckNow: vi.fn() });
    expect(screen.getByText("HSK 2")).toBeInTheDocument();
    expect(screen.getByText(/900.000/)).toBeInTheDocument();
    expect(screen.getByText("Đang tạo mã thanh toán...")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kiểm tra ngay" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Mã QR chuyển khoản" })).not.toBeInTheDocument();
  });

  it("tạo đơn lỗi: báo lỗi và bấm Thử lại được", () => {
    const onRetry = vi.fn();
    renderPayment({ order: { status: "error", courseTitle: "HSK 2", error: "Mất mạng." }, onRetry, onClose: vi.fn() });
    expect(screen.getByRole("alert")).toHaveTextContent("Mất mạng.");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(onRetry).toHaveBeenCalled();
  });
});
