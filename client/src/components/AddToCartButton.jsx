import React from 'react';
import { Link } from 'react-router-dom';
import { addToCart, useCart } from '../lib/cartService';

/**
 * Bỏ khóa vào giỏ với gói đang chọn. Khóa đã nằm trong giỏ đúng gói này thì nút
 * thành lối tắt sang trang giỏ; đổi gói thì bấm lại để cập nhật gói trong giỏ.
 */
export function AddToCartButton({ course, withTutoring = false, className = 'button-ghost' }) {
  const items = useCart();
  const inCart = items.find((item) => item.courseId === course.id);
  const sameOption = inCart && Boolean(inCart.withTutoring) === Boolean(withTutoring);

  if (sameOption) {
    return (
      <Link className={`${className} add-to-cart is-added`} to="/cart">
        Đã trong giỏ · Xem giỏ
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={`${className} add-to-cart`}
      onClick={() => addToCart(course.id, withTutoring)}
    >
      {inCart ? 'Cập nhật gói trong giỏ' : 'Thêm vào giỏ'}
    </button>
  );
}

export function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M2.5 3.5h2.6l2.3 11.2a1.6 1.6 0 0 0 1.6 1.3h8.4a1.6 1.6 0 0 0 1.6-1.2l1.6-6.8H6.2" />
    </svg>
  );
}

/** Icon giỏ trên header, kèm số khóa đang có trong giỏ. */
export function HeaderCartLink({ onClick }) {
  const count = useCart().length;
  return (
    <Link
      className="site-header__cart"
      to="/cart"
      onClick={onClick}
      aria-label={count ? `Giỏ hàng, ${count} khóa học` : 'Giỏ hàng'}
      title="Giỏ hàng"
    >
      <CartIcon />
      {count ? <span className="site-header__cart-count">{count > 9 ? '9+' : count}</span> : null}
    </Link>
  );
}
