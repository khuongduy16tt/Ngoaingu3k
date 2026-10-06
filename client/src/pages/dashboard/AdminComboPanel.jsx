import React, { useEffect, useMemo, useState } from 'react';
import { formatVnd } from '../../lib/money';
import { priceAfterDiscount, savingsPercent, sumListPrice } from '../../lib/comboPricing';
import {
  buildComboSuggestions,
  deleteAdminCombo,
  getAdminCombos,
  saveAdminCombo
} from '../../lib/comboService';
import { isHskCourse } from '../../lib/courseService';

const STATUS_LABELS = { draft: 'Nháp', published: 'Đang bán', hidden: 'Ẩn' };

const emptyDraft = {
  id: '',
  title: '',
  description: '',
  price: '',
  tutoringPrice: '',
  status: 'published',
  position: 0,
  courseIds: []
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function AdminComboPanel({ courses }) {
  const [combos, setCombos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [draft, setDraft] = useState(emptyDraft);
  const [discountPercent, setDiscountPercent] = useState('');

  // Chỉ khóa thật trên server mới ghép combo được (đơn hàng cần uuid khóa).
  const sellableCourses = useMemo(
    () => (courses || []).filter((course) => UUID_PATTERN.test(String(course.databaseId || ''))),
    [courses]
  );
  const courseById = useMemo(
    () => new Map(sellableCourses.map((course) => [String(course.databaseId), course])),
    [sellableCourses]
  );
  const courseGroups = useMemo(
    () => [
      { label: 'HSK', items: sellableCourses.filter(isHskCourse) },
      { label: 'IELTS / Tiếng Anh', items: sellableCourses.filter((course) => !isHskCourse(course)) }
    ].filter((group) => group.items.length),
    [sellableCourses]
  );
  const suggestions = useMemo(() => buildComboSuggestions(sellableCourses), [sellableCourses]);

  const selectedCourses = draft.courseIds.map((id) => courseById.get(String(id))).filter(Boolean);
  const listTotal = sumListPrice(selectedCourses.map((course) => ({ price: course.price })));
  const tutoringListTotal = sumListPrice(
    selectedCourses.map((course) => ({ price: course.tutoringPrice || course.price }))
  );
  const draftPrice = Number(draft.price || 0);
  const draftTutoringPrice = Number(draft.tutoringPrice || 0);

  async function reload() {
    setLoading(true);
    setLoadError('');
    try {
      setCombos(await getAdminCombos(sellableCourses));
    } catch (error) {
      setLoadError(error?.message || 'Chưa tải được danh sách combo.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // sellableCourses đổi khi bảng quản trị tải lại dữ liệu khóa học.
  }, [sellableCourses]);

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function toggleCourse(databaseId) {
    setDraft((current) => {
      const has = current.courseIds.includes(databaseId);
      const courseIds = has
        ? current.courseIds.filter((id) => id !== databaseId)
        : [...current.courseIds, databaseId];
      return { ...current, courseIds };
    });
  }

  function applyDiscount(percentValue) {
    setDiscountPercent(percentValue);
    if (percentValue !== '' && listTotal) {
      updateDraft('price', String(priceAfterDiscount(listTotal, percentValue)));
      if (selectedCourses.some((course) => course.tutoringPrice)) {
        updateDraft('tutoringPrice', String(priceAfterDiscount(tutoringListTotal, percentValue)));
      }
    }
  }

  function applySuggestion(suggestion) {
    setDraft({
      ...emptyDraft,
      title: suggestion.title,
      courseIds: suggestion.courses.map((course) => String(course.databaseId)),
      position: combos.length
    });
    setDiscountPercent('');
    setMessage({ type: '', text: '' });
  }

  function editCombo(combo) {
    setDraft({
      id: combo.id,
      title: combo.title,
      description: combo.description,
      price: String(combo.price),
      tutoringPrice: combo.tutoringPrice ? String(combo.tutoringPrice) : '',
      status: combo.status,
      position: combo.position,
      courseIds: combo.courseIds.map(String)
    });
    setDiscountPercent('');
    setMessage({ type: '', text: '' });
  }

  function resetDraft() {
    setDraft(emptyDraft);
    setDiscountPercent('');
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await saveAdminCombo(draft);
      setMessage({ type: 'success', text: `Đã lưu ${draft.title}.` });
      resetDraft();
      await reload();
    } catch (error) {
      setMessage({ type: 'error', text: error?.message || 'Chưa lưu được combo.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(combo) {
    // Đơn đã bán vẫn giữ nguyên (orders.combo_id chuyển về NULL), học viên không mất khóa.
    if (!window.confirm(`Xóa ${combo.title}? Học viên đã mua vẫn giữ các khóa của mình.`)) {
      return;
    }
    setSaving(true);
    try {
      await deleteAdminCombo(combo.id);
      if (draft.id === combo.id) resetDraft();
      await reload();
    } catch (error) {
      setMessage({ type: 'error', text: error?.message || 'Chưa xóa được combo.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="section admin-management-grid">
      <form className="content-card content-card--enterprise dashboard-form admin-panel" onSubmit={handleSave}>
        <div className="section-head">
          <div>
            <span className="eyebrow">Combo &amp; giảm giá</span>
            <h2>{draft.id ? 'Sửa combo' : 'Tạo combo mới'}</h2>
            <p>Chọn các khóa lẻ, đặt giá combo trực tiếp hoặc theo % giảm so với tổng giá lẻ.</p>
          </div>
          <button type="button" className="button-ghost" onClick={resetDraft}>
            Tạo mới
          </button>
        </div>

        {suggestions.length && !draft.id ? (
          <div className="auth-field auth-field--full">
            <span>Gợi ý nhanh (theo cấp độ khóa hiện có)</span>
            <div className="admin-combo-suggestions">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.key}
                  type="button"
                  className="button-ghost"
                  onClick={() => applySuggestion(suggestion)}
                >
                  {suggestion.title}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="dashboard-form__grid">
          <label className="auth-field">
            <span>Tên combo</span>
            <input value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} placeholder="Combo HSK 1-2" />
          </label>
          <label className="auth-field">
            <span>Trạng thái</span>
            <select value={draft.status} onChange={(event) => updateDraft('status', event.target.value)}>
              <option value="published">Đang bán</option>
              <option value="draft">Nháp</option>
              <option value="hidden">Ẩn</option>
            </select>
          </label>
          <label className="auth-field auth-field--full">
            <span>Mô tả ngắn (không bắt buộc)</span>
            <input value={draft.description} onChange={(event) => updateDraft('description', event.target.value)} />
          </label>
        </div>

        {courseGroups.map((group) => (
          <fieldset key={group.label} className="auth-field auth-field--full">
            <span>Khóa trong combo · {group.label}</span>
            <div className="admin-combo-courses">
              {group.items.map((course) => {
                const key = String(course.databaseId);
                return (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={draft.courseIds.includes(key)}
                      onChange={() => toggleCourse(key)}
                    />
                    <span>
                      {course.title} · {formatVnd(course.price)}
                      {course.status !== 'published' ? ` (${STATUS_LABELS[course.status] || course.status})` : ''}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}

        <div className="dashboard-form__grid">
          <label className="auth-field">
            <span>Giảm % so với giá lẻ</span>
            <input
              type="number"
              min="0"
              max="90"
              step="1"
              value={discountPercent}
              onChange={(event) => applyDiscount(event.target.value)}
              placeholder="vd 15"
              disabled={!listTotal}
            />
          </label>
          <label className="auth-field">
            <span>Giá combo (VND)</span>
            <input
              type="number"
              min="0"
              step="1000"
              value={draft.price}
              onChange={(event) => {
                setDiscountPercent('');
                updateDraft('price', event.target.value);
              }}
            />
          </label>
          <label className="auth-field">
            <span>Giá combo kèm dạy kèm (VND)</span>
            <input
              type="number"
              min="0"
              step="1000"
              value={draft.tutoringPrice}
              onChange={(event) => {
                setDiscountPercent('');
                updateDraft('tutoringPrice', event.target.value);
              }}
              placeholder="Bỏ trống nếu không bán dạy kèm"
            />
          </label>
        </div>

        <div className="admin-combo-summary" aria-live="polite">
          <span>{selectedCourses.length} khóa đã chọn</span>
          <span>Tổng giá lẻ: <strong>{formatVnd(listTotal)}</strong></span>
          {draftPrice ? (
            <span>
              Giá combo: <strong>{formatVnd(draftPrice)}</strong>
              {listTotal > draftPrice ? ` · tiết kiệm ${savingsPercent(draftPrice, listTotal)}%` : ''}
            </span>
          ) : null}
          {draftTutoringPrice ? (
            <span>
              Dạy kèm: lẻ <strong>{formatVnd(tutoringListTotal)}</strong> → combo <strong>{formatVnd(draftTutoringPrice)}</strong>
            </span>
          ) : null}
          {draftPrice && draftPrice >= listTotal && listTotal ? (
            <span style={{ color: 'var(--color-warning)' }}>Giá combo không rẻ hơn mua lẻ.</span>
          ) : null}
        </div>

        {message.text ? (
          <div
            role={message.type === 'error' ? 'alert' : 'status'}
            className={`auth-message ${message.type === 'success' ? 'auth-message--success' : message.type === 'error' ? 'auth-message--error' : ''}`}
          >
            {message.text}
          </div>
        ) : null}

        <div className="section-actions" style={{ display: 'flex', gap: '0.75rem' }}>
          <button type="submit" className="button teacher-console-primary" disabled={saving}>
            {saving ? 'Đang lưu...' : draft.id ? 'Lưu thay đổi' : 'Tạo combo'}
          </button>
        </div>
      </form>

      <section className="content-card content-card--enterprise admin-panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">Danh sách</span>
            <h2>Combo hiện có</h2>
          </div>
          <span className="pill">{combos.length} combo</span>
        </div>

        {loading ? <p className="empty-state">Đang tải combo...</p> : null}
        {loadError ? <div role="alert" className="auth-message auth-message--error">{loadError}</div> : null}

        {!loading && !loadError ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Combo</th>
                  <th>Khóa</th>
                  <th>Giá</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {combos.map((combo) => {
                  const total = sumListPrice(combo.courses.map((course) => ({ price: course.price })));
                  const percent = savingsPercent(combo.price, total);
                  return (
                    <tr key={combo.id}>
                      <td data-label="Combo"><strong>{combo.title}</strong></td>
                      <td data-label="Khóa">
                        {combo.courses.map((course) => course.title).join(', ') || '—'}
                        {combo.courses.length < combo.courseIds.length ? (
                          <span> (có khóa đã bị xóa)</span>
                        ) : null}
                      </td>
                      <td data-label="Giá">
                        <strong>{formatVnd(combo.price)}</strong>
                        <span>{total ? `Lẻ ${formatVnd(total)}${percent ? ` · -${percent}%` : ''}` : ''}</span>
                        {combo.tutoringPrice ? <span>Kèm dạy kèm: {formatVnd(combo.tutoringPrice)}</span> : null}
                      </td>
                      <td data-label="Trạng thái">
                        <span className={`pill ${combo.status === 'published' ? 'pill--success' : ''}`}>
                          {STATUS_LABELS[combo.status] || combo.status}
                        </span>
                      </td>
                      <td data-label="Thao tác">
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button type="button" className="button-ghost" onClick={() => editCombo(combo)} disabled={saving}>
                            Sửa
                          </button>
                          <button type="button" className="button-ghost" onClick={() => handleDelete(combo)} disabled={saving}>
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!combos.length ? (
                  <tr><td colSpan={5} className="empty-state">Chưa có combo nào. Dùng gợi ý nhanh ở bên trái để tạo.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </section>
  );
}
