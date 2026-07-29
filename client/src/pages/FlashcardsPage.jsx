import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { getEffectiveRole } from '../lib/permissions';
import { getCourseCatalog, getMyCourses, getOwnedCourseIds } from '../lib/courseService';
import {
  deleteFlashcardSet,
  getFlashcardProgress,
  getFlashcardSetById,
  getFlashcardSets,
  saveFlashcardSet
} from '../lib/flashcardService';
import {
  detectTermSeparator,
  parseFlashcardImport,
  ROW_SEPARATORS,
  TERM_SEPARATORS
} from '../lib/flashcardParser';
import { createEmptyProgress } from '../lib/flashcardStudy';
import { FlashcardStudy } from './flashcards/FlashcardStudy';
import { usePageTitle } from '../hooks/usePageTitle';

const SAMPLE = `你好\txin chào\n谢谢\tcảm ơn\n再见\ttạm biệt`;

// Panel nhập bộ thẻ — chỉ giảng viên/admin thấy. Dán text, chọn dấu phân cách,
// xem trước rồi mới lưu, đúng luồng của Quizlet.
function FlashcardImportPanel({ courses, onSaved }) {
  const auth = useAuth();
  const [courseId, setCourseId] = useState(courses[0]?.id || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [text, setText] = useState('');
  const [termSeparator, setTermSeparator] = useState('tab');
  const [termCustomSeparator, setTermCustomSeparator] = useState('');
  const [rowSeparator, setRowSeparator] = useState('newline');
  const [rowCustomSeparator, setRowCustomSeparator] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: '', text: '' });

  useEffect(() => {
    if (!courseId && courses[0]?.id) {
      setCourseId(courses[0].id);
    }
  }, [courses, courseId]);

  const parsed = useMemo(
    () =>
      parseFlashcardImport(text, {
        termSeparator,
        termCustomSeparator,
        rowSeparator,
        rowCustomSeparator
      }),
    [text, termSeparator, termCustomSeparator, rowSeparator, rowCustomSeparator]
  );

  function handlePaste(value) {
    setText(value);
    // Đoán dấu phân cách ngay lần dán đầu để đỡ phải chọn tay.
    if (!text.trim() && value.trim()) {
      setTermSeparator(detectTermSeparator(value));
    }
  }

  async function handleSave() {
    setSaving(true);
    setStatus({ type: '', text: '' });

    try {
      await saveFlashcardSet({
        courseId,
        title,
        description,
        cards: parsed.cards,
        userId: auth.user?.id
      });
      setStatus({ type: 'success', text: `Đã nhập ${parsed.cards.length} thẻ vào bộ "${title}".` });
      setText('');
      setTitle('');
      setDescription('');
      onSaved?.();
    } catch (error) {
      setStatus({ type: 'error', text: error.message || 'Chưa thể lưu bộ thẻ.' });
    } finally {
      setSaving(false);
    }
  }

  const canSave = Boolean(courseId) && Boolean(title.trim()) && parsed.cards.length > 0 && !parsed.error;

  return (
    <section className="content-card content-card--enterprise fc-import">
      <div className="section-head">
        <div>
          <span className="eyebrow">Chỉ giảng viên</span>
          <h2>Nhập bộ thẻ</h2>
          <p>Dán danh sách từ Excel, Google Sheets hoặc Word. Mỗi dòng thành một thẻ.</p>
        </div>
      </div>

      {courses.length ? (
        <>
          <div className="fc-import__meta">
            <label className="auth-field">
              <span>Khóa học</span>
              <select value={courseId} onChange={(event) => setCourseId(event.target.value)}>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="auth-field">
              <span>Tên bộ thẻ</span>
              <input
                className="lesson-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="VD: HSK 1 — Chủ đề 1"
              />
            </label>

            <label className="auth-field auth-field--full">
              <span>Mô tả (không bắt buộc)</span>
              <input
                className="lesson-input"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="VD: 60 từ vựng bài 1-3"
              />
            </label>
          </div>

          <label className="auth-field auth-field--full">
            <span>Dán nội dung</span>
            <textarea
              rows={7}
              className="lesson-input"
              value={text}
              onChange={(event) => handlePaste(event.target.value)}
              placeholder={SAMPLE}
            />
          </label>

          <div className="fc-import__separators">
            <div className="fc-import__separator">
              <span>Giữa thuật ngữ và định nghĩa</span>
              <div>
                {TERM_SEPARATORS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`button-ghost ${termSeparator === item.value ? 'is-active' : ''}`}
                    onClick={() => setTermSeparator(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {termSeparator === 'custom' ? (
                <input
                  className="lesson-input"
                  value={termCustomSeparator}
                  onChange={(event) => setTermCustomSeparator(event.target.value)}
                  placeholder="VD: ::"
                />
              ) : null}
            </div>

            <div className="fc-import__separator">
              <span>Giữa các thẻ</span>
              <div>
                {ROW_SEPARATORS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`button-ghost ${rowSeparator === item.value ? 'is-active' : ''}`}
                    onClick={() => setRowSeparator(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {rowSeparator === 'custom' ? (
                <input
                  className="lesson-input"
                  value={rowCustomSeparator}
                  onChange={(event) => setRowCustomSeparator(event.target.value)}
                  placeholder="VD: ||"
                />
              ) : null}
            </div>
          </div>

          {parsed.error ? <div className="exercise-feedback">{parsed.error}</div> : null}

          {parsed.cards.length ? (
            <div className="fc-import__preview">
              <div className="fc-import__preview-head">
                <strong>Xem trước — {parsed.cards.length} thẻ</strong>
                {parsed.rowsWithoutSeparator ? (
                  <span className="pill">{parsed.rowsWithoutSeparator} dòng thiếu dấu phân cách</span>
                ) : null}
                {parsed.truncated ? <span className="pill">Đã cắt bớt do quá nhiều dòng</span> : null}
              </div>
              <div className="fc-import__preview-list">
                {parsed.cards.slice(0, 12).map((card, index) => (
                  <div key={index} className={`fc-import__row ${card.definition ? '' : 'is-incomplete'}`}>
                    <span>{card.term}</span>
                    <span>{card.definition || '— thiếu định nghĩa —'}</span>
                  </div>
                ))}
              </div>
              {parsed.cards.length > 12 ? (
                <small>…và {parsed.cards.length - 12} thẻ nữa</small>
              ) : null}
            </div>
          ) : null}

          {status.text ? (
            <div className={status.type === 'success' ? 'exercise-feedback success' : 'exercise-feedback'}>
              {status.text}
            </div>
          ) : null}

          <div className="excel-lesson-panel__footer">
            <span>{parsed.cards.length ? `${parsed.cards.length} thẻ sẵn sàng` : 'Chưa có thẻ nào'}</span>
            <button type="button" className="button" onClick={handleSave} disabled={!canSave || saving}>
              {saving ? 'Đang lưu...' : 'Nhập bộ thẻ'}
            </button>
          </div>
        </>
      ) : (
        <p className="empty-state">
          Bạn chưa phụ trách khóa học nào. Hãy tạo khóa học trước khi nhập bộ thẻ.
        </p>
      )}
    </section>
  );
}

export default function FlashcardsPage() {
  usePageTitle('Flashcard');
  const auth = useAuth();
  const role = getEffectiveRole(auth);
  const canImport = role === 'teacher' || role === 'admin';

  const [sets, setSets] = useState([]);
  const [teacherCourses, setTeacherCourses] = useState([]);
  const [activeSet, setActiveSet] = useState(null);
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const catalog = await getCourseCatalog();

        // Giảng viên nhập thẻ cho khóa mình phụ trách; học viên chỉ xem bộ thẻ
        // của khóa đã sở hữu.
        const owned = await getOwnedCourseIds(auth.user?.id, catalog);
        let ownCourses = [];

        if (canImport) {
          const mine = await getMyCourses({ accessToken: auth.session?.access_token });
          ownCourses = mine.length
            ? mine
            : catalog.filter((course) => course.teacherId === auth.user?.id);
          if (!ownCourses.length) {
            ownCourses = catalog;
          }
        }

        const visibleCourseIds = canImport
          ? ownCourses.map((course) => course.id)
          : owned;

        const nextSets = await getFlashcardSets({ courseIds: visibleCourseIds });

        if (active) {
          setTeacherCourses(ownCourses);
          setSets(nextSets);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [auth.user?.id, auth.session?.access_token, canImport, reloadKey]);

  async function openSet(setId) {
    const full = await getFlashcardSetById(setId);
    if (!full) {
      return;
    }
    const stored = await getFlashcardProgress({ userId: auth.user?.id, setId });
    setActiveSet(full);
    setProgress(Object.keys(stored).length ? stored : createEmptyProgress(full.cards));
  }

  async function handleDelete(setId, title) {
    if (!window.confirm(`Xóa bộ thẻ "${title}"? Thao tác này không hoàn tác được.`)) {
      return;
    }
    await deleteFlashcardSet(setId);
    setActiveSet(null);
    setReloadKey((value) => value + 1);
  }

  if (activeSet) {
    return (
      <div className="page flashcards-page">
        <button type="button" className="button-ghost" onClick={() => setActiveSet(null)}>
          ← Về danh sách bộ thẻ
        </button>
        <FlashcardStudy set={activeSet} progress={progress} onProgressChange={setProgress} />
      </div>
    );
  }

  return (
    <div className="page flashcards-page">
      <section className="section-head">
        <div>
          <span className="eyebrow">Flashcard</span>
          <h1>Bộ thẻ ghi nhớ</h1>
          <p>Học bằng thẻ ghi nhớ, chế độ Học, Kiểm tra và Ghép cặp.</p>
        </div>
        <span className="pill">{sets.length} bộ</span>
      </section>

      {canImport ? (
        <FlashcardImportPanel courses={teacherCourses} onSaved={() => setReloadKey((v) => v + 1)} />
      ) : null}

      {loading ? (
        <p className="empty-state">Đang tải bộ thẻ...</p>
      ) : sets.length ? (
        <div className="fc-set-list">
          {sets.map((set) => (
            <article key={set.id} className="fc-set-card">
              <button type="button" className="fc-set-card__open" onClick={() => openSet(set.id)}>
                <strong>{set.title}</strong>
                {set.courseTitle ? <span className="fc-set-card__course">{set.courseTitle}</span> : null}
                {set.description ? <small>{set.description}</small> : null}
              </button>
              {canImport ? (
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => handleDelete(set.id, set.title)}
                >
                  Xóa
                </button>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">
          {canImport
            ? 'Chưa có bộ thẻ nào. Dùng panel bên trên để nhập bộ đầu tiên.'
            : 'Khóa học của bạn chưa có bộ thẻ nào. Hãy chờ giảng viên nhập.'}
        </p>
      )}
    </div>
  );
}
