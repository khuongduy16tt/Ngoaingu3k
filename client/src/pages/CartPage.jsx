import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  checkCoursePaymentStatus,
  getCourseCatalog,
  getOwnedCourseIds,
  getTutoringCourseIds
} from '../lib/courseService';
import {
  checkoutCart,
  quoteCartLine,
  removeFromCart,
  setCartItemTutoring,
  useCart
} from '../lib/cartService';
import { findPendingCartOrder } from '../lib/paymentService';
import { formatVnd } from '../lib/money';
import { getEffectiveRole } from '../lib/permissions';
import { handleRemoteImageError, supabaseImageUrl } from '../lib/imageCdn';
import { useAuth } from '../providers/AuthProvider';
import { AuthModalLink } from '../providers/AuthModalProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import { usePaymentStatusPolling } from '../hooks/usePaymentStatusPolling';
import { PackagePicker } from '../components/PackagePicker';
import { PaymentInstructions } from '../components/PaymentInstructions';
import { toFriendlyError } from '../lib/friendlyError';

function CartLine({ line, onRemove, onTutoringChange }) {
  const { course, withTutoring, quote, unavailable } = line;

  if (unavailable) {
    return (
      <li className="cart-line is-disabled">
        <div className="cart-line__body">
          <strong>Khóa học không còn mở bán</strong>
          <p className="cart-line__note">Khóa này đã bị ẩn hoặc gỡ khỏi danh mục.</p>
        </div>
        <button type="button" className="cart-line__remove" onClick={onRemove}>
          Xóa
        </button>
      </li>
    );
  }

  const canUpgrade = quote.alreadyOwned && !withTutoring && course.tutoringPriceValue && line.owned === 'course';

  return (
    <li className={`cart-line ${quote.alreadyOwned ? 'is-disabled' : ''}`}>
      <Link className="cart-line__media" to={`/courses/${course.id}`} tabIndex={-1} aria-hidden="true">
        {course.bannerUrl ? (
          <img
            src={supabaseImageUrl(course.bannerUrl, { width: 320 })}
            onError={handleRemoteImageError(course.bannerUrl)}
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span>{course.category || 'Khóa học'}</span>
        )}
      </Link>

      <div className="cart-line__body">
        <Link className="cart-line__title" to={`/courses/${course.id}`}>
          {course.title}
        </Link>
        <span className="cart-line__meta">{[course.category, course.level].filter(Boolean).join(' · ')}</span>

        {quote.alreadyOwned ? (
          <p className="cart-line__note">
            {line.owned === 'tutoring' || !withTutoring
              ? 'Bạn đã sở hữu khóa này — không tính tiền.'
              : 'Bạn đã có gói này.'}
            {canUpgrade ? (
              <>
                {' '}
                <button type="button" className="cart-line__link" onClick={() => onTutoringChange(true)}>
                  Nâng cấp lên gói dạy kèm
                </button>
              </>
            ) : null}
          </p>
        ) : (
          <>
            {line.owned !== 'course' ? (
              <PackagePicker
                price={course.priceValue}
                tutoringPrice={course.tutoringPriceValue}
                withTutoring={withTutoring}
                onChange={onTutoringChange}
              />
            ) : null}
            {quote.isUpgrade ? (
              <p className="cart-line__note">Nâng cấp dạy kèm — bạn đã có khóa nên chỉ trả phần chênh.</p>
            ) : null}
          </>
        )}
      </div>

      <div className="cart-line__side">
        <strong className="cart-line__price">{quote.alreadyOwned ? '—' : formatVnd(quote.amount)}</strong>
        <button type="button" className="cart-line__remove" onClick={onRemove}>
          Xóa
        </button>
      </div>
    </li>
  );
}

export default function CartPage() {
  usePageTitle('Giỏ hàng');
  const auth = useAuth();
  const currentRole = getEffectiveRole(auth);
  const cartItems = useCart();
  const [courses, setCourses] = useState([]);
  const [ownedCourseIds, setOwnedCourseIds] = useState([]);
  const [tutoringCourseIds, setTutoringCourseIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [paymentScreenOpen, setPaymentScreenOpen] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [paymentCheckNote, setPaymentCheckNote] = useState('');
  const [justPaid, setJustPaid] = useState([]);

  useEffect(() => {
    if (!auth.ready) return undefined;
    let alive = true;

    async function load() {
      setLoading(true);
      setLoadError('');
      try {
        const nextCourses = await getCourseCatalog();
        const [nextOwned, nextTutoring] = await Promise.all([
          getOwnedCourseIds(auth.user?.id, nextCourses),
          getTutoringCourseIds(auth.user?.id)
        ]);
        if (alive) {
          setCourses(nextCourses);
          setOwnedCourseIds(nextOwned);
          setTutoringCourseIds(nextTutoring);
          setPaymentOrder(auth.user?.id ? findPendingCartOrder(auth.user.id) || null : null);
        }
      } catch (error) {
        console.warn('[CartPage load]', error?.message || error);
        if (alive) setLoadError(toFriendlyError(error, 'Chưa tải được giỏ hàng.'));
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, [auth.ready, auth.user?.id, reloadKey]);

  const lines = useMemo(() => {
    const lookup = new Map();
    courses.forEach((course) => {
      lookup.set(String(course.id), course);
      if (course.databaseId) lookup.set(String(course.databaseId), course);
    });
    const ownedSet = new Set(ownedCourseIds.map(String));
    const tutoringSet = new Set(tutoringCourseIds.map(String));

    return cartItems.map((item) => {
      const course = lookup.get(item.courseId);
      if (!course) {
        return { key: item.courseId, unavailable: true, quote: { amount: 0, alreadyOwned: false } };
      }
      const ids = [course.id, course.databaseId].filter(Boolean).map(String);
      const owned = ids.some((id) => tutoringSet.has(id))
        ? 'tutoring'
        : ids.some((id) => ownedSet.has(id))
          ? 'course'
          : undefined;
      // Khóa không bán gói dạy kèm thì bỏ lựa chọn cũ còn lưu trong giỏ.
      const withTutoring = Boolean(item.withTutoring && course.tutoringPriceValue);
      return { key: item.courseId, course, owned, withTutoring, quote: quoteCartLine(course, withTutoring, owned) };
    });
  }, [cartItems, courses, ownedCourseIds, tutoringCourseIds]);

  const payableLines = lines.filter((line) => !line.unavailable && !line.quote.alreadyOwned);
  const subtotal = payableLines.reduce(
    (sum, line) => sum + (line.withTutoring ? line.course.tutoringPriceValue : line.course.priceValue),
    0
  );
  const total = payableLines.reduce((sum, line) => sum + line.quote.amount, 0);
  const upgradeCredit = subtotal - total;

  const syncPaymentStatus = useCallback(
    async (order, { manual = false } = {}) => {
      if (!order?.id || order.status === 'paid') return;
      if (manual) {
        setCheckingPayment(true);
        setPaymentCheckNote('');
      }
      try {
        const result = await checkCoursePaymentStatus({ order, accessToken: auth.session?.access_token });
        if (result.order) setPaymentOrder(result.order);
        if (manual && !result.paid) {
          setPaymentCheckNote('Chưa thấy tiền về. Ngân hàng có thể chậm vài phút — màn hình này sẽ tự cập nhật.');
        }
        if (result.paid) {
          const paidIds = (result.order?.courseIds || order.courseIds || []).map(String);
          setJustPaid(courses.filter((course) => paidIds.includes(String(course.id))));
          removeFromCart(paidIds);
          const [nextOwned, nextTutoring] = await Promise.all([
            getOwnedCourseIds(auth.user?.id, courses),
            getTutoringCourseIds(auth.user?.id)
          ]);
          setOwnedCourseIds(nextOwned);
          setTutoringCourseIds(nextTutoring);
          setFeedback('');
        }
      } catch (error) {
        console.warn('[checkCoursePaymentStatus]', error?.message || error);
        if (manual) {
          setPaymentCheckNote(toFriendlyError(error, 'Chưa kiểm tra được giao dịch. Vui lòng thử lại sau ít phút.'));
        }
      } finally {
        if (manual) setCheckingPayment(false);
      }
    },
    [auth.session?.access_token, auth.user?.id, courses]
  );

  usePaymentStatusPolling({ order: paymentOrder, active: paymentScreenOpen, onCheck: syncPaymentStatus });

  async function handleCheckout() {
    if (!auth.session || currentRole !== 'student' || !payableLines.length) return;

    setSubmitting(true);
    setFeedback('');
    setJustPaid([]);
    try {
      const result = await checkoutCart({
        lines: payableLines.map((line) => ({
          course: line.course,
          withTutoring: line.withTutoring,
          amount: line.quote.amount
        })),
        userId: auth.user?.id,
        accessToken: auth.session?.access_token,
        user: auth.user
      });

      if (result.requiresPayment && result.order) {
        setPaymentOrder(result.order);
        setPaymentScreenOpen(true);
        return;
      }

      // Server báo đã sở hữu hết (vd vừa mua ở máy khác): dọn giỏ cho khớp.
      if (result.ownedCourseIds) setOwnedCourseIds(result.ownedCourseIds);
      removeFromCart(payableLines.map((line) => line.key));
      setFeedback('Bạn đã sở hữu toàn bộ khóa trong giỏ.');
    } catch (error) {
      setFeedback(toFriendlyError(error, 'Chưa thể tạo đơn thanh toán. Vui lòng thử lại sau.'));
    } finally {
      setSubmitting(false);
    }
  }

  const pendingOrderOpen =
    paymentOrder && !paymentScreenOpen && !['paid', 'failed', 'cancelled'].includes(paymentOrder.status);
  const learnHref = justPaid.length === 1 ? `/learn/${justPaid[0].id}` : '/learn';

  return (
    <div className="page cart-page">
      <PaymentInstructions
        order={paymentOrder}
        checking={checkingPayment}
        checkNote={paymentCheckNote}
        onCheckNow={() => syncPaymentStatus(paymentOrder, { manual: true })}
        learnHref={learnHref}
        variant="overlay"
        open={paymentScreenOpen}
        onClose={() => {
          setPaymentScreenOpen(false);
          setPaymentCheckNote('');
        }}
      />

      <header className="cart-page__head">
        <span className="eyebrow">Thanh toán</span>
        <h1>Giỏ hàng</h1>
      </header>

      {pendingOrderOpen ? (
        <div className="inline-feedback payment-resume-banner" role="status">
          <span>
            Đơn <strong>{paymentOrder.courseTitle}</strong> ({formatVnd(paymentOrder.amount)}) đang chờ chuyển khoản.
          </span>
          <button type="button" className="button" onClick={() => setPaymentScreenOpen(true)}>
            Mở lại mã QR
          </button>
        </div>
      ) : null}

      {justPaid.length ? (
        <section className="content-card content-card--enterprise cart-success" role="status">
          <h2>Thanh toán thành công</h2>
          <p>Các khóa dưới đây đã mở, bạn vào học được ngay.</p>
          <ul className="cart-success__list">
            {justPaid.map((course) => (
              <li key={course.id}>
                <span>{course.title}</span>
                <Link className="button" to={`/learn/${course.id}`}>
                  Vào học
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {loading ? (
        <p className="empty-state">Đang tải giỏ hàng...</p>
      ) : loadError ? (
        <section className="content-card content-card--enterprise marketplace-empty">
          <h3>Chưa tải được giỏ hàng</h3>
          <p role="alert">{loadError}</p>
          <button type="button" className="button" onClick={() => setReloadKey((value) => value + 1)}>
            Thử lại
          </button>
        </section>
      ) : !lines.length ? (
        justPaid.length ? null : (
          <section className="content-card content-card--enterprise marketplace-empty cart-empty">
            <h3>Giỏ hàng đang trống</h3>
            <p>Thêm khóa học vào giỏ để thanh toán một lần cho nhiều khóa.</p>
            <Link className="button" to="/courses">
              Xem khóa học
            </Link>
          </section>
        )
      ) : (
        <div className="cart-layout">
          <section className="content-card content-card--enterprise cart-items" aria-label="Khóa học trong giỏ">
            <div className="cart-items__head">
              <h2>{lines.length} khóa học</h2>
              <Link className="cart-line__link" to="/courses">
                + Thêm khóa khác
              </Link>
            </div>
            <ul className="cart-lines">
              {lines.map((line) => (
                <CartLine
                  key={line.key}
                  line={line}
                  onRemove={() => removeFromCart(line.key)}
                  onTutoringChange={(value) => setCartItemTutoring(line.key, value)}
                />
              ))}
            </ul>
          </section>

          <aside className="content-card content-card--enterprise cart-summary" aria-label="Tóm tắt đơn hàng">
            <h2>Tóm tắt đơn hàng</h2>
            <dl className="cart-summary__rows">
              <div>
                <dt>Tạm tính ({payableLines.length} khóa)</dt>
                <dd>{formatVnd(subtotal)}</dd>
              </div>
              {upgradeCredit > 0 ? (
                <div>
                  <dt>Trừ khóa đã mua (nâng cấp)</dt>
                  <dd>−{formatVnd(upgradeCredit)}</dd>
                </div>
              ) : null}
              <div className="cart-summary__total">
                <dt>Tổng thanh toán</dt>
                <dd>{formatVnd(total)}</dd>
              </div>
            </dl>

            {!auth.session ? (
              <AuthModalLink className="button cart-summary__cta">Đăng nhập để thanh toán</AuthModalLink>
            ) : (
              <button
                type="button"
                className="button cart-summary__cta"
                disabled={currentRole !== 'student' || submitting || !payableLines.length}
                onClick={handleCheckout}
              >
                {currentRole !== 'student'
                  ? 'Chỉ dành cho học viên'
                  : submitting
                    ? 'Đang tạo đơn...'
                    : `Thanh toán ${formatVnd(total)}`}
              </button>
            )}

            <p className="cart-summary__hint">
              Chuyển khoản một lần qua mã QR. Tất cả khóa trong giỏ tự mở khi tiền về.
            </p>

            {feedback ? (
              <div className="inline-feedback" role="status">
                {feedback}
              </div>
            ) : null}
          </aside>
        </div>
      )}
    </div>
  );
}
