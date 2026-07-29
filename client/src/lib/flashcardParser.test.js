import { describe, it, expect } from 'vitest';
import {
  detectTermSeparator,
  MAX_IMPORT_CARDS,
  normalizeFlashcards,
  parseFlashcardImport
} from './flashcardParser';

describe('parseFlashcardImport — tách thẻ kiểu Quizlet', () => {
  it('tách bằng Tab và xuống dòng (mặc định, dán từ Excel)', () => {
    const { cards } = parseFlashcardImport('你好\txin chào\n谢谢\tcảm ơn');
    expect(cards).toEqual([
      { term: '你好', definition: 'xin chào' },
      { term: '谢谢', definition: 'cảm ơn' }
    ]);
  });

  it('tách bằng dấu phẩy', () => {
    const { cards } = parseFlashcardImport('你好,xin chào\n谢谢,cảm ơn', {
      termSeparator: 'comma'
    });
    expect(cards).toHaveLength(2);
    expect(cards[0]).toEqual({ term: '你好', definition: 'xin chào' });
  });

  it('chỉ tách ở dấu phân cách ĐẦU TIÊN — định nghĩa có dấu phẩy vẫn nguyên', () => {
    const { cards } = parseFlashcardImport('你好,xin chào, chào bạn, hello', {
      termSeparator: 'comma'
    });
    expect(cards[0]).toEqual({ term: '你好', definition: 'xin chào, chào bạn, hello' });
  });

  it('tách bằng gạch ngang', () => {
    const { cards } = parseFlashcardImport('你好 - xin chào', { termSeparator: 'dash' });
    expect(cards[0]).toEqual({ term: '你好', definition: 'xin chào' });
  });

  it('tách các thẻ bằng chấm phẩy', () => {
    const { cards } = parseFlashcardImport('你好\txin chào;谢谢\tcảm ơn', {
      rowSeparator: 'semicolon'
    });
    expect(cards).toHaveLength(2);
    expect(cards[1]).toEqual({ term: '谢谢', definition: 'cảm ơn' });
  });

  it('nhận dấu phân cách tuỳ chỉnh cho cả thuật ngữ lẫn thẻ', () => {
    const { cards } = parseFlashcardImport('你好::xin chào||谢谢::cảm ơn', {
      termSeparator: 'custom',
      termCustomSeparator: '::',
      rowSeparator: 'custom',
      rowCustomSeparator: '||'
    });
    expect(cards).toEqual([
      { term: '你好', definition: 'xin chào' },
      { term: '谢谢', definition: 'cảm ơn' }
    ]);
  });

  it('báo lỗi khi chọn tuỳ chỉnh mà bỏ trống', () => {
    const result = parseFlashcardImport('你好\txin chào', {
      termSeparator: 'custom',
      termCustomSeparator: ''
    });
    expect(result.error).toMatch(/dấu phân cách tuỳ chỉnh/i);
    expect(result.cards).toHaveLength(0);
  });

  it('cắt khoảng trắng thừa và bỏ dòng trống', () => {
    const result = parseFlashcardImport('  你好  \t  xin chào  \n\n\n谢谢\tcảm ơn\n   \n');
    expect(result.cards).toEqual([
      { term: '你好', definition: 'xin chào' },
      { term: '谢谢', definition: 'cảm ơn' }
    ]);
    expect(result.emptyRows).toBe(4);
  });

  it('giữ dòng thiếu dấu phân cách để người dùng sửa, có đếm cảnh báo', () => {
    const result = parseFlashcardImport('你好\txin chào\n谢谢');
    expect(result.cards).toHaveLength(2);
    expect(result.cards[1]).toEqual({ term: '谢谢', definition: '' });
    expect(result.rowsWithoutSeparator).toBe(1);
  });

  it('xử lý được text dán từ Windows (CRLF)', () => {
    const { cards } = parseFlashcardImport('你好\txin chào\r\n谢谢\tcảm ơn');
    expect(cards).toHaveLength(2);
    expect(cards[1].definition).toBe('cảm ơn');
  });

  it('trả rỗng khi không có gì để nhập', () => {
    expect(parseFlashcardImport('').cards).toHaveLength(0);
    expect(parseFlashcardImport('   \n  ').cards).toHaveLength(0);
  });

  it('chặn ở giới hạn số thẻ và báo đã cắt bớt', () => {
    const rows = Array.from({ length: MAX_IMPORT_CARDS + 25 }, (_, i) => `t${i}\td${i}`);
    const result = parseFlashcardImport(rows.join('\n'));
    expect(result.cards).toHaveLength(MAX_IMPORT_CARDS);
    expect(result.truncated).toBe(true);
  });
});

describe('detectTermSeparator', () => {
  it('ưu tiên Tab khi dán từ bảng tính', () => {
    expect(detectTermSeparator('你好\txin chào, chào bạn\n谢谢\tcảm ơn')).toBe('tab');
  });

  it('nhận ra dấu phẩy khi không có Tab', () => {
    expect(detectTermSeparator('你好,xin chào\n谢谢,cảm ơn')).toBe('comma');
  });

  it('đếm số DÒNG có dấu, không đếm tổng số lần xuất hiện', () => {
    // Một định nghĩa nhiều dấu phẩy không được thắng Tab xuất hiện ở mọi dòng.
    expect(detectTermSeparator('a\tb, c, d, e, f\ng\th')).toBe('tab');
  });

  it('mặc định Tab khi text rỗng', () => {
    expect(detectTermSeparator('')).toBe('tab');
  });
});

describe('normalizeFlashcards', () => {
  it('bỏ thẻ rỗng và đánh lại thứ tự liên tục', () => {
    const cards = normalizeFlashcards([
      { term: '你好', definition: 'xin chào' },
      { term: '', definition: '' },
      { term: '谢谢', definition: 'cảm ơn' }
    ]);
    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.position)).toEqual([0, 1]);
  });
});
