import { describe, expect, it } from 'vitest';
import { priceAfterDiscount, quoteCombo, savingsPercent, sumListPrice } from './comboPricing';

const HSK1 = { id: 'hsk1', price: 900000 };
const HSK2 = { id: 'hsk2', price: 900000 };
const HSK3 = { id: 'hsk3', price: 1199000 };

describe('comboPricing (client)', () => {
  it('tổng giá lẻ và % tiết kiệm', () => {
    const total = sumListPrice([HSK1, HSK2, HSK3]);
    expect(total).toBe(2999000);
    expect(savingsPercent(2500000, total)).toBe(16);
    expect(savingsPercent(3000000, total)).toBe(0);
  });

  it('giá sau giảm làm tròn xuống tới nghìn đồng', () => {
    expect(priceAfterDiscount(2999000, 10)).toBe(2699000);
    expect(priceAfterDiscount(1800000, 15)).toBe(1530000);
  });

  it('đã có HSK 1 thì chỉ trả phần còn lại, khớp server', () => {
    const quote = quoteCombo(1600000, [HSK1, HSK2], ['hsk1']);
    expect(quote.amount).toBe(800000);
  });
});
