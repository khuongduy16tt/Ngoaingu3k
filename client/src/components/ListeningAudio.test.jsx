import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ListeningAudio, LISTENING_SPEEDS } from './ListeningAudio';

// jsdom không phát audio nhưng vẫn giữ playbackRate như một thuộc tính thường,
// đủ để kiểm tra component có gán đúng tốc độ vào thẻ <audio> hay không.

describe('ListeningAudio', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('không render gì khi thiếu src', () => {
    const { container } = render(<ListeningAudio src="" />);
    expect(container.firstChild).toBeNull();
  });

  it('render thanh phát tua được kèm đủ các mức tốc độ', () => {
    const { container } = render(<ListeningAudio src="/audio/q1.mp3" />);

    const audio = container.querySelector('audio');
    expect(audio).toBeInTheDocument();
    expect(audio).toHaveAttribute('controls');
    expect(audio).toHaveAttribute('src', '/audio/q1.mp3');

    LISTENING_SPEEDS.forEach((speed) => {
      const label = `${String(speed).replace('.', ',')}×`;
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });
  });

  it('mặc định 1× và đánh dấu nút đang chọn', () => {
    const { container } = render(<ListeningAudio src="/audio/q1.mp3" />);

    expect(container.querySelector('audio').playbackRate).toBe(1);
    expect(screen.getByRole('button', { name: '1×' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '0,5×' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('bấm chậm lại thì đổi playbackRate của audio', () => {
    const { container } = render(<ListeningAudio src="/audio/q1.mp3" />);

    fireEvent.click(screen.getByRole('button', { name: '0,5×' }));
    expect(container.querySelector('audio').playbackRate).toBe(0.5);
    expect(screen.getByRole('button', { name: '0,5×' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: '1,5×' }));
    expect(container.querySelector('audio').playbackRate).toBe(1.5);
  });

  it('giữ cao độ giọng khi đổi tốc độ', () => {
    const { container } = render(<ListeningAudio src="/audio/q1.mp3" />);
    fireEvent.click(screen.getByRole('button', { name: '0,75×' }));
    expect(container.querySelector('audio').preservesPitch).toBe(true);
  });

  it('đổi tốc độ ở một câu thì mọi câu nghe khác đổi theo', () => {
    render(
      <>
        <div data-testid="q1">
          <ListeningAudio src="/audio/q1.mp3" label="Câu 1" />
        </div>
        <div data-testid="q2">
          <ListeningAudio src="/audio/q2.mp3" label="Câu 2" />
        </div>
      </>
    );

    const q1 = screen.getByTestId('q1');
    const q2 = screen.getByTestId('q2');

    fireEvent.click(within(q1).getByRole('button', { name: '0,5×' }));

    expect(q1.querySelector('audio').playbackRate).toBe(0.5);
    expect(q2.querySelector('audio').playbackRate).toBe(0.5);
    expect(within(q2).getByRole('button', { name: '0,5×' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('nhớ tốc độ đã chọn cho lần vào sau', () => {
    const first = render(<ListeningAudio src="/audio/q1.mp3" />);
    fireEvent.click(screen.getByRole('button', { name: '0,75×' }));
    first.unmount();

    const second = render(<ListeningAudio src="/audio/q2.mp3" />);
    expect(second.container.querySelector('audio').playbackRate).toBe(0.75);
  });

  it('bỏ qua tốc độ lạ đã lưu và quay về 1×', () => {
    localStorage.setItem('listening-playback-rate-v1', '9');
    const { container } = render(<ListeningAudio src="/audio/q1.mp3" />);
    expect(container.querySelector('audio').playbackRate).toBe(1);
  });

  it('gán lại tốc độ khi đổi sang file nghe khác', () => {
    const { container, rerender } = render(<ListeningAudio src="/audio/q1.mp3" />);
    fireEvent.click(screen.getByRole('button', { name: '0,5×' }));

    // Trình duyệt đặt lại playbackRate khi nạp nguồn mới — component phải gán lại.
    container.querySelector('audio').playbackRate = 1;
    rerender(<ListeningAudio src="/audio/q2.mp3" />);

    expect(container.querySelector('audio').playbackRate).toBe(0.5);
  });
});
