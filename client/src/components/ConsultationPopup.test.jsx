import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import {
  ConsultationPopup,
  POPUP_SESSION_KEY,
  POPUP_TIME_TRIGGER_MS
} from './ConsultationPopup';
import { CONSULTATION_SUBMITTED_KEY } from './ConsultationForm';

// Popup KHÔNG bật khi vừa tải trang; chỉ bật ở tín hiệu đầu tiên trong 3 tín
// hiệu (exit-intent · cuộn ≥ 60% · ở lại 45s), tối đa 1 lần mỗi phiên.

function datChieuCaoTrang({ scrollHeight, scrollY, innerHeight = 800 }) {
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    value: scrollHeight,
    configurable: true
  });
  window.innerHeight = innerHeight;
  window.scrollY = scrollY;
}

function coChuot(fine) {
  vi.stubGlobal('matchMedia', (query) => ({
    matches: query === '(pointer: fine)' ? fine : false,
    addEventListener() {},
    removeEventListener() {}
  }));
}

const dangMo = () => screen.queryByRole('dialog', { name: /Quảng cáo đăng ký tư vấn/i });

function cuonToi(scrollY) {
  datChieuCaoTrang({ scrollHeight: 8800, scrollY });
  act(() => window.dispatchEvent(new Event('scroll')));
}

function roiMepTren() {
  act(() => {
    document.dispatchEvent(new MouseEvent('mouseout', { clientY: -2, relatedTarget: null, bubbles: true }));
  });
}

describe('ConsultationPopup — chỉ bật khi khách đã đọc trang', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
    coChuot(true);
    datChieuCaoTrang({ scrollHeight: 8800, scrollY: 0 });
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

  it('không mở khi vừa tải trang', () => {
    render(<ConsultationPopup />);
    act(() => vi.advanceTimersByTime(5000));
    expect(dangMo()).not.toBeInTheDocument();
  });

  it('mở sau 45 giây', () => {
    render(<ConsultationPopup />);
    act(() => vi.advanceTimersByTime(POPUP_TIME_TRIGGER_MS - 1));
    expect(dangMo()).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(dangMo()).toBeInTheDocument();
  });

  it('mở khi cuộn ≥ 60% trang', () => {
    render(<ConsultationPopup />);
    // cuộn được 8000px; 4000px = 50% → chưa
    cuonToi(4000);
    expect(dangMo()).not.toBeInTheDocument();
    cuonToi(4800);
    expect(dangMo()).toBeInTheDocument();
  });

  it('mở khi chuột rời mép trên cửa sổ (exit-intent)', () => {
    render(<ConsultationPopup />);
    roiMepTren();
    expect(dangMo()).toBeInTheDocument();
  });

  it('máy cảm ứng (không có chuột): bỏ qua exit-intent', () => {
    coChuot(false);
    render(<ConsultationPopup />);
    roiMepTren();
    expect(dangMo()).not.toBeInTheDocument();
  });

  it('chỉ mở 1 lần mỗi phiên, kể cả khi dựng lại', () => {
    const { unmount } = render(<ConsultationPopup />);
    roiMepTren();
    dong();
    cuonToi(8000);
    act(() => vi.advanceTimersByTime(POPUP_TIME_TRIGGER_MS));
    expect(dangMo()).not.toBeInTheDocument();
    expect(sessionStorage.getItem(POPUP_SESSION_KEY)).toBe('1');

    unmount();
    render(<ConsultationPopup />);
    roiMepTren();
    act(() => vi.advanceTimersByTime(POPUP_TIME_TRIGGER_MS));
    expect(dangMo()).not.toBeInTheDocument();
  });

  it('đóng bằng Esc và bằng cách bấm ra ngoài', () => {
    render(<ConsultationPopup />);
    roiMepTren();
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(dangMo()).not.toBeInTheDocument();

    sessionStorage.clear();
    document.body.innerHTML = '';
    render(<ConsultationPopup />);
    roiMepTren();
    act(() => dangMo().click());
    expect(dangMo()).not.toBeInTheDocument();
  });

  it('sessionStorage bị chặn: không lỗi, vẫn mở đúng 1 lần', () => {
    vi.stubGlobal('sessionStorage', {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
      clear() {}
    });
    render(<ConsultationPopup />);
    roiMepTren();
    expect(dangMo()).toBeInTheDocument();
    dong();
    roiMepTren();
    expect(dangMo()).not.toBeInTheDocument();
  });

  it('người đã đăng nhập: không bật', () => {
    render(<ConsultationPopup isSignedIn />);
    roiMepTren();
    act(() => vi.advanceTimersByTime(POPUP_TIME_TRIGGER_MS));
    expect(dangMo()).not.toBeInTheDocument();
  });

  it('đã gửi form tư vấn thì không bật', () => {
    localStorage.setItem(CONSULTATION_SUBMITTED_KEY, '1');
    render(<ConsultationPopup />);
    roiMepTren();
    cuonToi(8000);
    act(() => vi.advanceTimersByTime(POPUP_TIME_TRIGGER_MS));
    expect(dangMo()).not.toBeInTheDocument();
  });
});
