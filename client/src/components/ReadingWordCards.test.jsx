import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReadingWordCards } from './ReadingWordCards';

// jsdom không có speechSynthesis nên phải giả lập — cùng cách soundEffects.test.js
// giả lập AudioContext.
const speak = vi.fn();

beforeEach(() => {
  speak.mockClear();
  window.speechSynthesis = { speak, cancel: vi.fn(), getVoices: () => [] };
  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
    }
  };
});

afterEach(() => {
  delete window.speechSynthesis;
  delete window.SpeechSynthesisUtterance;
});

const words = [
  { text: '你好', pinyin: 'nǐ hǎo', meaning: 'xin chào' },
  { text: '不忙', pinyin: '', meaning: '' }
];

describe('ReadingWordCards', () => {
  it('hiện chữ Hán kèm phiên âm và nghĩa', () => {
    render(<ReadingWordCards words={words} />);

    expect(screen.getByText('你好')).toBeInTheDocument();
    expect(screen.getByText('nǐ hǎo')).toBeInTheDocument();
    expect(screen.getByText('xin chào')).toBeInTheDocument();
    expect(screen.getByText('不忙')).toBeInTheDocument();
  });

  it('bấm vào ô thì đọc đúng từ của ô đó', () => {
    render(<ReadingWordCards words={words} />);

    fireEvent.click(screen.getByRole('button', { name: /你好/ }));

    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0][0].text).toBe('你好');
    expect(speak.mock.calls[0][0].lang).toBe('zh-CN');
  });

  it('không có từ nào thì báo rỗng thay vì lưới trống', () => {
    render(<ReadingWordCards words={[]} />);
    expect(screen.getByText(/chưa có từ nào để luyện đọc/i)).toBeInTheDocument();
  });
});
