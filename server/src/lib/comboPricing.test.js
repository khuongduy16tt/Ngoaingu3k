import { describe, expect, it } from 'vitest';
import { allocateComboPrice, quoteComboPurchase, quoteCoursePurchase } from './comboPricing.js';

const HSK1 = { id: 'hsk1', price: 900000 };
const HSK2 = { id: 'hsk2', price: 900000 };
const HSK3 = { id: 'hsk3', price: 1199000 };

describe('allocateComboPrice', () => {
  it('chia theo tỉ lệ giá lẻ và tổng đúng bằng giá combo', () => {
    const shares = allocateComboPrice(2500000, [HSK1, HSK2, HSK3]);
    const sum = [...shares.values()].reduce((a, b) => a + b, 0);

    expect(sum).toBe(2500000);
    expect(shares.get('hsk3')).toBeGreaterThan(shares.get('hsk2'));
    [...shares.values()].forEach((share) => expect(Number.isInteger(share)).toBe(true));
  });

  it('khóa giá 0 hết thì chia đều', () => {
    const shares = allocateComboPrice(1000001, [
      { id: 'a', price: 0 },
      { id: 'b', price: 0 }
    ]);
    expect(shares.get('b')).toBe(500000);
    expect(shares.get('a')).toBe(500001);
  });

  it('combo rỗng không vỡ', () => {
    expect(allocateComboPrice(1000000, []).size).toBe(0);
  });
});

describe('quoteComboPurchase — chỉ khóa học', () => {
  const combo = { comboPrice: 1600000, courses: [HSK1, HSK2] };

  it('đã có HSK 1 → chỉ trả phần của HSK 2', () => {
    const quote = quoteComboPurchase({ ...combo, owned: new Map([['hsk1', 'course']]) });
    expect(quote.amount).toBe(800000);
    expect(quote.lines.map((line) => line.id)).toEqual(['hsk2']);
  });

  it('đã có đủ → không tạo đơn', () => {
    const quote = quoteComboPurchase({ ...combo, owned: new Map([['hsk1', 'course'], ['hsk2', 'course']]) });
    expect(quote.lines).toHaveLength(0);
  });
});

describe('quoteComboPurchase — có dạy kèm', () => {
  // Số theo bảng giá: HSK 1/2 lẻ 900k, kèm dạy kèm 1.2tr. Combo HSK 1-2: 1.8tr / 2.4tr.
  const T1 = { id: 'hsk1', price: 900000, tutoringPrice: 1200000 };
  const T2 = { id: 'hsk2', price: 900000, tutoringPrice: 1200000 };
  const combo = { comboPrice: 1800000, comboTutoringPrice: 2400000, courses: [T1, T2] };

  it('chỉ khóa học, chưa có gì → giá combo', () => {
    expect(quoteComboPurchase(combo).amount).toBe(1800000);
  });

  it('kèm dạy kèm, chưa có gì → giá combo dạy kèm', () => {
    const quote = quoteComboPurchase({ ...combo, withTutoring: true });
    expect(quote.amount).toBe(2400000);
    expect(quote.lines).toHaveLength(2);
  });

  it('đã mua HSK 1 (chỉ khóa) rồi mua combo dạy kèm → HSK 1 chỉ trả phần chênh', () => {
    const quote = quoteComboPurchase({ ...combo, withTutoring: true, owned: new Map([['hsk1', 'course']]) });
    expect(quote.amount).toBe(300000 + 1200000);
  });

  it('đã có HSK 1 kèm dạy kèm → không tính lại HSK 1', () => {
    const quote = quoteComboPurchase({ ...combo, withTutoring: true, owned: new Map([['hsk1', 'tutoring']]) });
    expect(quote.amount).toBe(1200000);
    expect(quote.lines.map((line) => line.id)).toEqual(['hsk2']);
  });

  it('đã có khóa dạy kèm mà mua chỉ khóa học → không tạo đơn cho khóa đó', () => {
    const quote = quoteComboPurchase({ ...combo, owned: new Map([['hsk1', 'tutoring']]) });
    expect(quote.amount).toBe(900000);
  });
});

describe('quoteCoursePurchase', () => {
  const course = { price: 900000, tutoringPrice: 1200000 };

  it('mua lẻ thường / kèm dạy kèm', () => {
    expect(quoteCoursePurchase({ ...course }).amount).toBe(900000);
    expect(quoteCoursePurchase({ ...course, withTutoring: true }).amount).toBe(1200000);
  });

  it('đã có khóa, nâng cấp dạy kèm → trả phần chênh', () => {
    expect(quoteCoursePurchase({ ...course, owned: 'course', withTutoring: true })).toEqual({ alreadyOwned: false, amount: 300000 });
  });

  it('đã có đủ', () => {
    expect(quoteCoursePurchase({ ...course, owned: 'course' }).alreadyOwned).toBe(true);
    expect(quoteCoursePurchase({ ...course, owned: 'tutoring', withTutoring: true }).alreadyOwned).toBe(true);
  });
});
