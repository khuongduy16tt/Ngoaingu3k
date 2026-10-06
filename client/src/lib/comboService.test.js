import { describe, expect, it } from 'vitest';
import { buildComboSuggestions, getIeltsBand } from './comboService';

// Đúng tên khóa đang có trên web (10/2026).
const courses = [
  { databaseId: 'h1', title: 'HSK 1 - Tiếng Trung Nền Tảng' },
  { databaseId: 'h2', title: 'HSK 2' },
  { databaseId: 'h3', title: 'HSK 3' },
  { databaseId: 'h4', title: 'HSK 4' },
  { databaseId: 'h5a', title: 'HSK 5 - Ngữ pháp' },
  { databaseId: 'h5b', title: 'HSK 5 - Từ vựng' },
  { databaseId: 'i2', title: 'IELTS Cơ bản' },
  { databaseId: 'i1', title: 'IELTS Nền tảng' },
  { databaseId: 'i3', title: 'IELTS Trung cấp' }
];

describe('buildComboSuggestions', () => {
  const suggestions = buildComboSuggestions(courses);
  const byTitle = Object.fromEntries(suggestions.map((s) => [s.title, s.courses.map((c) => c.databaseId)]));

  it('HSK lũy tiến, HSK 5 gồm cả Ngữ pháp và Từ vựng', () => {
    expect(byTitle['Combo HSK 1-2']).toEqual(['h1', 'h2']);
    expect(byTitle['Combo HSK 1-2-3-4']).toEqual(['h1', 'h2', 'h3', 'h4']);
    expect(byTitle['Combo HSK 1-2-3-4-5']).toEqual(['h1', 'h2', 'h3', 'h4', 'h5a', 'h5b']);
  });

  it('IELTS theo bậc: Nền tảng (0-3.5) → Cơ bản (4.0-4.5) → Trung cấp (5.0-5.5)', () => {
    expect(byTitle['Combo IELTS 0-4.5']).toEqual(['i1', 'i2']);
    expect(byTitle['Combo IELTS 0-5.5']).toEqual(['i1', 'i2', 'i3']);
    expect(suggestions).toHaveLength(6);
  });

  it('tên có số band vẫn đọc được', () => {
    expect(getIeltsBand({ title: 'IELTS 6.0-6.5' })).toBe(6);
  });
});
