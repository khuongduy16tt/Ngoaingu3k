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

/** Xe đẩy mua hàng: thân giỏ tô nhạt, nan giỏ, tay đẩy và hai bánh xe. */
export function CartIcon({ size = 28 }) {
  return (
    <svg
      className="cart-icon"
      viewBox="0 0 32 32"
      aria-hidden="true"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Thân giỏ */}
      <path
        className="cart-icon__basket"
        d="M7.4 8.5h20.1c.8 0 1.4.8 1.2 1.6l-2 8.3a2.2 2.2 0 0 1-2.1 1.7H10.6"
        fill="currentColor"
        fillOpacity="0.16"
        strokeWidth="2.1"
      />
      {/* Nan giỏ */}
      <path d="M13 8.8l.9 10.8M19.6 8.8l-.4 10.8M8.6 14h18.9" strokeWidth="1.5" strokeOpacity="0.75" />
      {/* Tay đẩy + khung */}
      <path d="M2.5 4h2.8c.7 0 1.3.5 1.5 1.2l3.3 15.2c.2.9 1 1.6 2 1.6h14.4" strokeWidth="2.3" />
      {/* Bánh xe */}
      <circle cx="12.6" cy="26.4" r="2.1" fill="currentColor" strokeWidth="1.4" />
      <circle cx="24" cy="26.4" r="2.1" fill="currentColor" strokeWidth="1.4" />
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
