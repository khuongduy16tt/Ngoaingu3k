import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatVnd } from '../lib/money';
import { quoteCombo, savingsPercent, sumListPrice } from '../lib/comboPricing';
import { comboPricingCourses } from '../lib/comboService';
import { PackagePicker } from './PackagePicker';

function ComboCard({ combo, ownedCourseIdSet, authSession, currentRole, purchasingId, feedback, onPurchase }) {
  const pricingCourses = comboPricingCourses(combo);
  const listTotal = sumListPrice(pricingCourses);
  const percent = savingsPercent(combo.price, listTotal);
  const ownedIds = combo.courses
    .filter((course) => ownedCourseIdSet.has(course.id) || ownedCourseIdSet.has(course.databaseId))
    .map((course) => String(course.databaseId || course.id));
  const ownsAll = ownedIds.length === combo.courses.length;
  const { amount: payable } = quoteCombo(combo.price, pricingCourses, ownedIds);
  const ownsSome = ownedIds.length > 0 && !ownsAll;
  const isPurchasing = purchasingId === combo.id;
  const [withTutoring, setWithTutoring] = useState(false);
  const tutoringListTotal = combo.tutoringPrice
    ? pricingCourses.reduce((sum, course) => sum + (course.tutoringPrice || course.price), 0)
    : 0;
  const shownListTotal = withTutoring ? tutoringListTotal : listTotal;
  const shownPrice = withTutoring ? combo.tutoringPrice : combo.price;
  const canBuy = !ownsAll || (withTutoring && combo.tutoringPrice);

  return (
    <article className={`content-card content-card--enterprise combo-card ${ownsAll ? 'is-owned' : ''}`}>
      <div className="combo-card__head">
        <span className="eyebrow">Combo {combo.courses.length} khóa</span>
        {percent > 0 ? <span className="combo-card__saving">Tiết kiệm {percent}%</span> : null}
      </div>

      <h3>{combo.title}</h3>
      {combo.description ? <p className="combo-card__description">{combo.description}</p> : null}

      <ul className="combo-card__courses">
        {combo.courses.map((course) => {
          const owned = ownedIds.includes(String(course.databaseId || course.id));
          return (
            <li key={course.id} className={owned ? 'is-owned' : ''}>
              <Link to={`/courses/${course.id}`}>{course.title}</Link>
              <span>{owned ? 'Đã có' : course.price}</span>
            </li>
          );
        })}
      </ul>

      <PackagePicker
        price={combo.price}
        tutoringPrice={combo.tutoringPrice}
        withTutoring={withTutoring}
        onChange={setWithTutoring}
        courseLabel="Chỉ khóa học"
      />

      <div className="combo-card__price">
        {shownListTotal > shownPrice ? <s>{formatVnd(shownListTotal)}</s> : null}
        <strong>{formatVnd(shownPrice)}</strong>
        {withTutoring && ownedIds.length ? (
          <small>Khóa bạn đã có chỉ tính phần dạy kèm — số tiền chính xác hiện ở bước thanh toán.</small>
        ) : ownsSome ? (
          <small>
            Bạn đã có {ownedIds.length} khóa trong combo — chỉ cần trả <b>{formatVnd(payable)}</b> cho phần còn lại.
          </small>
        ) : null}
      </div>

      <div className="combo-card__actions">
        {!canBuy ? (
          <span className="marketplace-owned-tag">Đã sở hữu đủ combo</span>
        ) : authSession ? (
          <button
            type="button"
            className="button"
            disabled={currentRole !== 'student' || isPurchasing}
            onClick={() => onPurchase(combo, withTutoring)}
          >
            {currentRole !== 'student'
              ? 'Chỉ dành cho học viên'
              : isPurchasing
                ? 'Đang xử lý...'
                : withTutoring
                  ? 'Mua combo + dạy kèm'
                  : 'Mua combo'}
          </button>
        ) : (
          <Link className="button" to="/auth">
            Đăng nhập để mua
          </Link>
        )}
      </div>

      {feedback.text && feedback.courseId === combo.id ? (
        <div className="inline-feedback" role="status">
          {feedback.text}
        </div>
      ) : null}
    </article>
  );
}

export function ComboSection({ combos, ...cardProps }) {
  if (!combos.length) {
    return null;
  }

  const groups = [
    { key: 'hsk', label: 'Combo HSK', items: combos.filter((combo) => combo.program === 'hsk') },
    { key: 'ielts', label: 'Combo IELTS', items: combos.filter((combo) => combo.program !== 'hsk') }
  ].filter((group) => group.items.length);

  return (
    <section id="combo" className="marketplace-program-group combo-section">
      <div className="section-head">
        <div className="section-head__copy">
          <span className="eyebrow">Lộ trình</span>
          <h2>Combo khóa học</h2>
        </div>
        <span className="pill">{combos.length} combo</span>
      </div>

      {groups.map((group) => (
        <div key={group.key} className="combo-section__group">
          {groups.length > 1 ? <h3 className="combo-section__label">{group.label}</h3> : null}
          <div className="combo-grid">
            {group.items.map((combo) => (
              <ComboCard key={combo.id} combo={combo} {...cardProps} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
