import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { ConsultationPopup } from './ConsultationPopup';
import { CONSULTATION_SUBMITTED_KEY } from './ConsultationForm';

// Popup phải hiện đúng 3 lần mỗi lượt vào trang chủ, mỗi lần gắn với một mốc
// đọc: đầu trang · khối "Vì sao chọn Ngoaingu3k" · gần cuối trang. Trước đây
// nó hẹn giờ bật lại vô hạn, đóng bao nhiêu lần cũng hiện lại.

let batQuanSat; // giữ callback của IntersectionObserver để bắn tay

function gaLapIntersectionObserver() {
  class FakeIO {
    constructor(cb) {
      batQuanSat = cb;
    }
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal('IntersectionObserver', FakeIO);
}

function dungTrangCoKhoiViSao() {
  const section = document.createElement('section');
  section.className = 'reasons-section';
  document.body.appendChild(section);
}

function datChieuCaoTrang({ scrollHeight, scrollY, innerHeight = 800 }) {
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    value: scrollHeight,
    configurable: true
  });
  window.innerHeight = innerHeight;
  window.scrollY = scrollY;
}

const dangMo = () => screen.queryByRole('dialog', { name: /Quảng cáo đăng ký tư vấn/i });

describe('ConsultationPopup — 3 mốc thay cho hẹn giờ lặp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    batQuanSat = null;
    gaLapIntersectionObserver();
    dungTrangCoKhoiViSao();
    datChieuCaoTrang({ scrollHeight: 8000, scrollY: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  function dong() {
    act(() => {
      screen.getByLabelText('Đóng').click();
    });
  }

  it('mốc 1: hiện khi vừa vào trang', () => {
    render(<ConsultationPopup />);
    expect(dangMo()).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(600));
    expect(dangMo()).toBeInTheDocument();
  });

  it('đóng rồi KHÔNG tự bật lại theo thời gian', () => {
    render(<ConsultationPopup />);
    act(() => vi.advanceTimersByTime(600));
    dong();

    act(() => vi.advanceTimersByTime(120000));
    expect(dangMo()).not.toBeInTheDocument();
  });

  it('mốc 2: hiện khi khối "Vì sao chọn Ngoaingu3k" lọt vào màn hình', () => {
    render(<ConsultationPopup />);
    act(() => vi.advanceTimersByTime(600));
    dong();

    act(() => batQuanSat([{ isIntersecting: true }]));
    expect(dangMo()).toBeInTheDocument();
  });

  it('mốc 3: hiện khi cuộn gần hết trang', () => {
    render(<ConsultationPopup />);
    act(() => vi.advanceTimersByTime(600));
    dong();
    act(() => batQuanSat([{ isIntersecting: true }]));
    dong();

    // còn cách đáy 1000px — chưa tới ngưỡng 600px
    datChieuCaoTrang({ scrollHeight: 8000, scrollY: 6200 });
    act(() => window.dispatchEvent(new Event('scroll')));
    expect(dangMo()).not.toBeInTheDocument();

    // còn cách đáy 200px
    datChieuCaoTrang({ scrollHeight: 8000, scrollY: 7000 });
    act(() => window.dispatchEvent(new Event('scroll')));
    expect(dangMo()).toBeInTheDocument();
  });

  it('mỗi mốc chỉ bắn đúng một lần', () => {
    render(<ConsultationPopup />);
    act(() => vi.advanceTimersByTime(600));
    dong();

    act(() => batQuanSat([{ isIntersecting: true }]));
    dong();
    // vào lại khối đó lần nữa: không hiện thêm
    act(() => batQuanSat([{ isIntersecting: true }]));
    expect(dangMo()).not.toBeInTheDocument();

    datChieuCaoTrang({ scrollHeight: 8000, scrollY: 7000 });
    act(() => window.dispatchEvent(new Event('scroll')));
    dong();
    act(() => window.dispatchEvent(new Event('scroll')));
    expect(dangMo()).not.toBeInTheDocument();
  });

  it('đã gửi form tư vấn thì không mốc nào bắn', () => {
    localStorage.setItem(CONSULTATION_SUBMITTED_KEY, '1');
    render(<ConsultationPopup />);

    act(() => vi.advanceTimersByTime(600));
    expect(dangMo()).not.toBeInTheDocument();

    datChieuCaoTrang({ scrollHeight: 8000, scrollY: 7000 });
    act(() => window.dispatchEvent(new Event('scroll')));
    expect(dangMo()).not.toBeInTheDocument();
  });
});
