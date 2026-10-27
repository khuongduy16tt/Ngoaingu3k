import { beforeEach, describe, expect, it } from 'vitest';
import { addToCart, cartKeyOf, clearCart, quoteCartLine, readCart, removeFromCart, setCartItemTutoring } from './cartService';

const course = { id: 'hsk-1', priceValue: 1000000, tutoringPriceValue: 2500000 };

describe('quoteCartLine', () => {
  it('tính giá khóa hoặc giá gói dạy kèm khi chưa sở hữu', () => {
    expect(quoteCartLine(course, false)).toEqual({ amount: 1000000, alreadyOwned: false, isUpgrade: false });
    expect(quoteCartLine(course, true)).toEqual({ amount: 2500000, alreadyOwned: false, isUpgrade: false });
  });

  it('đã có khóa: mua lại khóa thì bỏ, thêm dạy kèm chỉ tính phần chênh', () => {
    expect(quoteCartLine(course, false, 'course').alreadyOwned).toBe(true);
    expect(quoteCartLine(course, true, 'course')).toEqual({ amount: 1500000, alreadyOwned: false, isUpgrade: true });
  });

  it('đã có dạy kèm thì không tính gì', () => {
    expect(quoteCartLine(course, true, 'tutoring').alreadyOwned).toBe(true);
    expect(quoteCartLine(course, false, 'tutoring').alreadyOwned).toBe(true);
  });

  it('khóa không bán dạy kèm thì tính như mua khóa', () => {
    expect(quoteCartLine({ id: 'x', priceValue: 500000 }, true).amount).toBe(500000);
  });
});

describe('giỏ hàng trong trình duyệt', () => {
  beforeEach(() => clearCart());

  it('thêm, đổi gói, xóa khóa', () => {
    addToCart('hsk-1');
    addToCart('hsk-2', true);
    addToCart('hsk-1', true); // thêm lại = cập nhật gói, không nhân đôi
    expect(readCart().map((item) => [item.courseId, item.withTutoring])).toEqual([
      ['hsk-1', true],
      ['hsk-2', true]
    ]);

    setCartItemTutoring('hsk-2', false);
    expect(readCart()[1].withTutoring).toBe(false);

    removeFromCart(['hsk-1']);
    expect(readCart().map((item) => item.courseId)).toEqual(['hsk-2']);
  });
});

describe("cartKeyOf", () => {
  const line = (id, withTutoring = false) => ({ course: { id }, withTutoring });
  it("không phụ thuộc thứ tự, đổi gói hoặc xóa khóa thì khác", () => {
    expect(cartKeyOf([line("a"), line("b", true)])).toBe(cartKeyOf([line("b", true), line("a")]));
    expect(cartKeyOf([line("a"), line("b")])).not.toBe(cartKeyOf([line("a"), line("b", true)]));
    expect(cartKeyOf([line("a"), line("b")])).not.toBe(cartKeyOf([line("a")]));
    expect(cartKeyOf([])).toBe("");
  });
});
