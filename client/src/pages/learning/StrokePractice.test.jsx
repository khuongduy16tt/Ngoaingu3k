import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { StrokePractice } from './StrokePractice';
import { BASIC_STROKES, CHINESE_STROKES } from '../../lib/strokes';

describe('StrokePractice', () => {
  it('mở ở bảng nét, hiện đủ 8 nét cơ bản kèm tên Hán và ví dụ', () => {
    render(<StrokePractice />);

    expect(screen.getByRole('tab', { name: 'Bảng nét' })).toHaveAttribute('aria-selected', 'true');
    BASIC_STROKES.forEach((stroke) => {
      expect(screen.getByText(stroke.vi)).toBeInTheDocument();
    });
    expect(screen.getByText(/横 · héng/)).toBeInTheDocument();
    expect(screen.getAllByText(/^Ví dụ:/).length).toBe(BASIC_STROKES.length);
  });

  it('đổi phạm vi sang toàn bộ nét thì hiện thêm nét ghép', () => {
    render(<StrokePractice />);

    expect(screen.queryByText('Nét sổ gập gập móc')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Phạm vi'), { target: { value: 'all' } });
    expect(screen.getByText('Nét sổ gập gập móc')).toBeInTheDocument();
  });

  it('mỗi nét vẽ ra một hình SVG có path', () => {
    const { container } = render(<StrokePractice />);
    const paths = container.querySelectorAll('.stroke-glyph__path');
    expect(paths.length).toBe(BASIC_STROKES.length);
    paths.forEach((path) => expect(path.getAttribute('d')).toMatch(/^M /));
  });

  it('chuyển sang luyện tập thì ra 8 câu, mỗi câu 4 lựa chọn', () => {
    render(<StrokePractice />);
    fireEvent.click(screen.getByRole('tab', { name: 'Luyện tập' }));

    const items = document.querySelectorAll('.stroke-quiz__item');
    expect(items.length).toBe(BASIC_STROKES.length);
    items.forEach((item) => {
      expect(item.querySelectorAll('.stroke-option').length).toBe(4);
    });
    expect(screen.getByText(`0/${BASIC_STROKES.length} câu đã trả lời`)).toBeInTheDocument();
  });

  it('lựa chọn của mỗi câu luôn chứa đáp án đúng và không trùng nhau', () => {
    render(<StrokePractice />);
    fireEvent.click(screen.getByRole('tab', { name: 'Luyện tập' }));

    const names = new Set(CHINESE_STROKES.map((stroke) => stroke.vi));
    document.querySelectorAll('.stroke-quiz__item').forEach((item) => {
      const labels = [...item.querySelectorAll('.stroke-option')].map((b) => b.textContent.trim());
      expect(new Set(labels).size).toBe(labels.length);
      labels.forEach((label) => expect(names.has(label)).toBe(true));
    });
  });

  it('nút nộp bị khóa cho tới khi trả lời hết', () => {
    render(<StrokePractice />);
    fireEvent.click(screen.getByRole('tab', { name: 'Luyện tập' }));

    const submit = screen.getByRole('button', { name: 'Kiểm tra đáp án' });
    expect(submit).toBeDisabled();

    document.querySelectorAll('.stroke-quiz__item').forEach((item) => {
      fireEvent.click(item.querySelector('.stroke-option'));
    });
    expect(screen.getByRole('button', { name: 'Kiểm tra đáp án' })).not.toBeDisabled();
  });

  it('chấm đúng số câu và hiện đáp án sau khi nộp', () => {
    render(<StrokePractice />);
    fireEvent.click(screen.getByRole('tab', { name: 'Luyện tập' }));

    // Trả lời tất cả bằng lựa chọn đầu tiên rồi nộp.
    const items = [...document.querySelectorAll('.stroke-quiz__item')];
    items.forEach((item) => fireEvent.click(item.querySelector('.stroke-option')));
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra đáp án' }));

    const correctCount = document.querySelectorAll('.stroke-option.is-correct').length;
    expect(correctCount).toBe(items.length);
    expect(screen.getByText(new RegExp(`Kết quả: \\d+/${items.length} nét đúng`))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Làm bộ khác' })).toBeInTheDocument();
  });

  it('dạng "đọc tên chọn hình" hiện hình ở lựa chọn thay vì chữ', () => {
    render(<StrokePractice />);
    fireEvent.click(screen.getByRole('tab', { name: 'Luyện tập' }));
    fireEvent.change(screen.getByLabelText('Dạng hỏi'), { target: { value: 'glyph' } });

    const firstItem = document.querySelector('.stroke-quiz__item');
    expect(within(firstItem).getByText(/^Chọn hình đúng của/)).toBeInTheDocument();
    expect(firstItem.querySelectorAll('.stroke-option--glyph').length).toBe(4);
    expect(firstItem.querySelectorAll('.stroke-option--glyph .stroke-glyph__path').length).toBe(4);
  });
});
