import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { getEffectiveRole } from '../lib/permissions';
import { getCourseCatalog, getMyCourses, getOwnedCourseIds } from '../lib/courseService';
import {
  deleteFlashcardSet,
  getFlashcardMasteredCounts,
  getFlashcardProgress,
  getFlashcardSetById,
  getFlashcardSets,
  saveFlashcardProgress,
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
import { scrollIntoViewRespectingMotion } from '../lib/scrollMotion';
import { toFriendlyError } from '../lib/friendlyError';
import { confirmDialog } from '../lib/confirmDialog';

const SAMPLE = `你好\txin chào\n谢谢\tcảm ơn\n再见\ttạm biệt`;

// `course.id` ở client là slug; khóa ngoại của flashcard_sets là UUID trong
// bảng courses, nằm ở `databaseId`.
function getCourseKey(course) {
  return course?.databaseId || course?.id || '';
}

// `getOwnedCourseIds` trả lẫn cả slug lẫn UUID, nên phải tra ngược qua danh mục
// để lấy đúng UUID trước khi lọc bộ thẻ.
function resolveCourseUuids(identifiers = [], catalog = []) {
  const byKey = new Map();
  catalog.forEach((course) => {
    const uuid = getCourseKey(course);
    if (!uuid) return;
    byKey.set(String(course.id), uuid);
    byKey.set(String(course.databaseId || ''), uuid);
    if (course.slug) byKey.set(String(course.slug), uuid);
  });

  return [...new Set(identifiers.map((id) => byKey.get(String(id))).filter(Boolean))];
}

// Bộ thẻ đang sửa → nội dung dán lại dạng "thuật ngữ<TAB>định nghĩa" mỗi dòng.
function cardsToImportText(cards = []) {
  return cards.map((card) => `${card.term}\t${card.definition}`).join('\n');
}

// Panel nhập bộ thẻ — chỉ giảng viên/admin thấy. Dán text, chọn dấu phân cách,
// xem trước rồi mới lưu, đúng luồng của Quizlet.
function FlashcardImportPanel({ courses, onSaved, autoFocus, editingSet = null, onCancelEdit }) {
  const auth = useAuth();
  const panelRef = useRef(null);
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

  // Bấm "Sửa" ở một bộ thẻ → đổ nội dung bộ đó vào panel để chỉnh rồi lưu đè.
  useEffect(() => {
    if (!editingSet) {
      return;
    }
    setCourseId(editingSet.courseId || '');
    setTitle(editingSet.title || '');
    setDescription(editingSet.description || '');
    setText(cardsToImportText(editingSet.cards));
    setTermSeparator('tab');
    setRowSeparator('newline');
    setStatus({ type: '', text: '' });
    if (panelRef.current) {
      scrollIntoViewRespectingMotion(panelRef.current, { block: 'start' });
    }
  }, [editingSet]);

  function resetForm() {
    setText('');
    setTitle('');
    setDescription('');
  }

  useEffect(() => {
    const first = getCourseKey(courses[0]);
    if (!courseId && first) {
      setCourseId(first);
    }
  }, [courses, courseId]);

  // Vào từ menu "Tạo flashcard" thì cuộn thẳng tới panel này.
  useEffect(() => {
    if (autoFocus && panelRef.current) {
      scrollIntoViewRespectingMotion(panelRef.current, { block: 'start' });
    }
  }, [autoFocus]);

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
        setId: editingSet?.id,
        courseId,
        title,
        description,
        cards: parsed.cards,
        userId: auth.user?.id
      });
      const savedCount = parsed.cards.filter((card) => card.term && card.definition).length;
      setStatus({
        type: 'success',
        text: editingSet
          ? `Đã lưu thay đổi bộ "${title}" (${savedCount} thẻ).`
          : `Đã nhập ${savedCount} thẻ vào bộ "${title}".`
      });
      resetForm();
      onSaved?.();
    } catch (error) {
      setStatus({ type: 'error', text: toFriendlyError(error, 'Chưa thể lưu bộ thẻ.') });
    } finally {
      setSaving(false);
    }
  }

  const canSave = Boolean(courseId) && Boolean(title.trim()) && parsed.cards.length > 0 && !parsed.error;

  return (
    <section id="fc-import" className="content-card content-card--enterprise fc-import" ref={panelRef}>
      <div className="section-head">
        <div>
          <span className="eyebrow">Chỉ giảng viên</span>
          <h2>{editingSet ? `Sửa bộ thẻ "${editingSet.title}"` : 'Nhập bộ thẻ'}</h2>
          <p>
            {editingSet
              ? 'Sửa trực tiếp trong ô bên dưới: mỗi dòng một thẻ, thuật ngữ và định nghĩa cách nhau bằng dấu Tab. Lưu lại thì tiến độ học của học viên với bộ này sẽ bắt đầu lại.'
              : 'Dán danh sách từ Excel, Google Sheets hoặc Word. Mỗi dòng thành một thẻ.'}
          </p>
        </div>
      </div>

      {courses.length ? (
        <>
          <div className="fc-import__meta">
            <label className="auth-field">
              <span>Khóa học</span>
              <select value={courseId} onChange={(event) => setCourseId(event.target.value)}>
                {courses.map((course) => (
                  <option key={course.id} value={getCourseKey(course)}>
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
                {/* Đếm số thẻ THỰC SỰ được nhập: dòng thiếu định nghĩa vẫn hiện
                    trong danh sách để sửa, nhưng không được lưu thành thẻ. */}
                <strong>Xem trước — {parsed.cards.filter((card) => card.term && card.definition).length} thẻ</strong>
                {parsed.rowsWithoutSeparator ? (
                  <span className="pill">
                    Bỏ qua {parsed.rowsWithoutSeparator} dòng thiếu dấu phân cách
                  </span>
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
            <div className="fc-import__actions">
              {editingSet ? (
                <button
                  type="button"
                  className="button-ghost"
                  disabled={saving}
                  onClick={() => {
                    resetForm();
                    setStatus({ type: '', text: '' });
                    onCancelEdit?.();
                  }}
                >
                  Hủy sửa
                </button>
              ) : null}
              <button type="button" className="button" onClick={handleSave} disabled={!canSave || saving}>
                {saving ? 'Đang lưu...' : editingSet ? 'Lưu thay đổi' : 'Nhập bộ thẻ'}
              </button>
            </div>
          </div>
        </>
      ) : (
        <p className="empty-state">
          Bạn chưa phụ trách khóa học nào. Hãy tạo khóa học trước khi nhập bộ thẻ.{' '}
          <Link to="/dashboard">Mở bảng điều khiển</Link>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const wantsCreate = searchParams.get('create') === '1';
  // Bộ đang học nằm trên URL (?set=...) để nút Back của trình duyệt quay về
  // danh sách thay vì thoát khỏi trang Flashcard.
  const activeSetId = searchParams.get('set') || '';

  const [sets, setSets] = useState([]);
  const [teacherCourses, setTeacherCourses] = useState([]);
  const [activeSet, setActiveSet] = useState(null);
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [openingSetId, setOpeningSetId] = useState('');
  const [openError, setOpenError] = useState('');
  const [masteredCounts, setMasteredCounts] = useState({});
  const [editingSet, setEditingSet] = useState(null);
  const requestedSetIdRef = useRef('');
  const [deleteError, setDeleteError] = useState('');
  const [ownedCourseCount, setOwnedCourseCount] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  // Không tải lại khi token tự làm mới, chỉ khi có/mất phiên.
  const hasAccessToken = Boolean(auth.session?.access_token);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setLoadError('');
      try {
        const catalog = await getCourseCatalog();

        // Giảng viên nhập thẻ cho khóa mình phụ trách; học viên chỉ xem bộ thẻ
        // của khóa đã sở hữu.
        const owned = await getOwnedCourseIds(auth.user?.id, catalog);
        let ownCourses = [];

        if (role === 'admin') {
          // Admin có policy quản trị mọi bộ thẻ nên chọn được khóa bất kỳ.
          ownCourses = catalog;
        } else if (canImport) {
          // Chỉ khóa giảng viên thực sự phụ trách. Trước đây rơi về cả danh mục
          // khi danh sách rỗng, khiến giảng viên chọn được khóa của người khác
          // rồi ăn nguyên lỗi RLS thô lúc bấm lưu.
          // null = không hỏi được server; coi như chưa phụ trách khóa nào để
          // không rơi về cả danh mục và cho chọn nhầm khóa của người khác.
          // Chỉ cần tên/ID khóa → bản summary (không kèm nội dung bài, nhẹ hơn hàng MB).
          ownCourses = (await getMyCourses({ accessToken: auth.session?.access_token, summaryOnly: true })) || [];
        }

        const visibleCourseIds = canImport
          ? ownCourses.map(getCourseKey).filter(Boolean)
          : resolveCourseUuids(owned, catalog);

        const nextSets = await getFlashcardSets({ courseIds: visibleCourseIds });

        if (active) {
          setTeacherCourses(ownCourses);
          setSets(nextSets);
          setOwnedCourseCount(visibleCourseIds.length);
        }
      } catch (error) {
        console.warn('[FlashcardsPage load]', error?.message || error);
        if (active) {
          setLoadError(toFriendlyError(error, 'Chưa tải được danh sách bộ thẻ.'));
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [auth.user?.id, hasAccessToken, canImport, role, reloadKey]);

  function focusImportPanel() {
    const panel = document.getElementById('fc-import');
    if (!panel) return;
    scrollIntoViewRespectingMotion(panel, { block: 'start' });
    panel.querySelector('textarea')?.focus({ preventScroll: true });
  }

  // Số thẻ đã thuộc của từng bộ (học viên). Tính lại mỗi lần quay về danh sách
  // để thấy ngay tiến độ vừa học.
  useEffect(() => {
    if (canImport || activeSetId || !sets.length) {
      return undefined;
    }

    let active = true;
    getFlashcardMasteredCounts({ userId: auth.user?.id, sets })
      .then((counts) => {
        if (active) setMasteredCounts(counts);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [auth.user?.id, canImport, activeSetId, sets]);

  function closeSetUrl() {
    const next = new URLSearchParams(searchParams);
    next.delete('set');
    setSearchParams(next, { replace: true });
  }

  // Mở bộ thẻ theo URL: bấm từ danh sách, bấm Back/Forward hoặc mở link trực tiếp.
  useEffect(() => {
    if (!activeSetId) {
      requestedSetIdRef.current = '';
      setActiveSet(null);
      setOpeningSetId('');
      return;
    }

    if (activeSet?.id === activeSetId || requestedSetIdRef.current === activeSetId) {
      return;
    }

    requestedSetIdRef.current = activeSetId;
    setOpeningSetId(activeSetId);
    setOpenError('');

    (async () => {
      try {
        const full = await getFlashcardSetById(activeSetId);
        if (requestedSetIdRef.current !== activeSetId) return;
        if (!full) {
          setOpenError('Không mở được bộ thẻ này. Có thể bộ thẻ đã bị xóa hoặc bạn chưa có quyền xem.');
          requestedSetIdRef.current = '';
          setOpeningSetId('');
          closeSetUrl();
          return;
        }
        const stored = await getFlashcardProgress({ userId: auth.user?.id, setId: activeSetId });
        if (requestedSetIdRef.current !== activeSetId) return;
        setActiveSet(full);
        setProgress(Object.keys(stored).length ? stored : createEmptyProgress(full.cards));
        setOpeningSetId('');
      } catch (error) {
        if (requestedSetIdRef.current !== activeSetId) return;
        setOpenError(toFriendlyError(error, 'Chưa mở được bộ thẻ. Vui lòng thử lại.'));
        requestedSetIdRef.current = '';
        setOpeningSetId('');
        closeSetUrl();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSetId]);

  function openSet(setId) {
    if (openingSetId) return;
    setOpenError('');
    const next = new URLSearchParams(searchParams);
    next.delete('create');
    next.set('set', setId);
    setSearchParams(next, { state: { fromFlashcardList: true } });
  }

  function backToList() {
    // Mở từ danh sách → lùi lịch sử (giống bấm Back); mở bằng link thẳng → bỏ ?set.
    if (location.state?.fromFlashcardList) {
      navigate(-1);
    } else {
      closeSetUrl();
    }
  }

  async function startEditSet(setId) {
    if (openingSetId) return;
    setOpenError('');
    setOpeningSetId(setId);
    try {
      const full = await getFlashcardSetById(setId);
      if (!full) {
        setOpenError('Không tải được bộ thẻ để sửa. Có thể bộ thẻ đã bị xóa.');
        return;
      }
      setEditingSet(full);
    } catch (error) {
      setOpenError(toFriendlyError(error, 'Không tải được bộ thẻ để sửa. Vui lòng thử lại.'));
    } finally {
      setOpeningSetId('');
    }
  }

  // Tiến độ Learn phải xuống DB, không thì mất khi rời trang. Có `changedCardId`
  // (trả lời một câu) thì chỉ lưu dòng đó; không có (bấm "Học lại từ đầu") thì
  // ghi lại cả bộ.
  function handleProgressChange(nextProgress, changedCardId) {
    setProgress(nextProgress);

    if (!activeSet?.id || !auth.user?.id) {
      return;
    }

    const payload = changedCardId
      ? { [changedCardId]: nextProgress[changedCardId] }
      : nextProgress;

    void saveFlashcardProgress({ userId: auth.user.id, setId: activeSet.id, progress: payload });
  }

  async function handleDelete(setId, title) {
    if (!await confirmDialog(`Xóa bộ thẻ "${title}"? Thao tác này không hoàn tác được.`)) {
      return;
    }

    setDeleteError('');

    try {
      await deleteFlashcardSet(setId);
      if (editingSet?.id === setId) {
        setEditingSet(null);
      }
      setReloadKey((value) => value + 1);
    } catch (error) {
      // Không bắt lỗi thì xóa hỏng cũng im lặng: bộ thẻ vẫn nằm đó và giảng
      // viên tưởng mình bấm hụt, bấm lại nhiều lần.
      console.warn('[handleDelete flashcard set]', error?.message || error);
      setDeleteError(toFriendlyError(error, `Chưa xóa được bộ thẻ "${title}". Vui lòng thử lại.`));
    }
  }

  if (activeSet) {
    return (
      <div className="page flashcards-page">
        <button type="button" className="button-ghost" onClick={backToList}>
          ← Về danh sách bộ thẻ
        </button>
        <FlashcardStudy set={activeSet} progress={progress} onProgressChange={handleProgressChange} />
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
        <FlashcardImportPanel
          courses={teacherCourses}
          autoFocus={wantsCreate && !loading}
          editingSet={editingSet}
          onCancelEdit={() => setEditingSet(null)}
          onSaved={() => {
            setEditingSet(null);
            setReloadKey((v) => v + 1);
          }}
        />
      ) : null}

      {openError ? (
        <div className="auth-message auth-message--error" role="alert">
          {openError}
        </div>
      ) : null}

      {deleteError ? (
        <div className="auth-message auth-message--error" role="alert">
          {deleteError}
        </div>
      ) : null}

      {loading ? (
        <p className="empty-state">Đang tải bộ thẻ...</p>
      ) : loadError ? (
        <div className="empty-state fc-empty">
          <p role="alert">{loadError}</p>
          <button type="button" className="button" onClick={() => setReloadKey((value) => value + 1)}>
            Thử lại
          </button>
        </div>
      ) : sets.length ? (
        <div className="fc-set-list">
          {sets.map((set) => (
            <article key={set.id} className="fc-set-card">
              <button
                type="button"
                className="fc-set-card__open"
                onClick={() => openSet(set.id)}
                disabled={Boolean(openingSetId)}
                aria-busy={openingSetId === set.id}
              >
                <strong>{set.title}</strong>
                {set.courseTitle ? <span className="fc-set-card__course">{set.courseTitle}</span> : null}
                {set.description ? <small>{set.description}</small> : null}
                <span className="fc-set-card__stats">
                  {openingSetId === set.id
                    ? 'Đang mở...'
                    : !canImport && set.cardCount
                      ? `${set.cardCount} thẻ · đã thuộc ${masteredCounts[set.id] || 0}/${set.cardCount}`
                      : `${set.cardCount} thẻ`}
                </span>
                {!canImport && set.cardCount ? (
                  <span className="meter fc-set-card__meter" aria-hidden="true">
                    <span style={{ width: `${Math.round(((masteredCounts[set.id] || 0) / set.cardCount) * 100)}%` }} />
                  </span>
                ) : null}
              </button>
              {canImport ? (
                <div className="fc-set-card__actions">
                  <button
                    type="button"
                    className="button-ghost"
                    disabled={Boolean(openingSetId)}
                    onClick={() => startEditSet(set.id)}
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={() => handleDelete(set.id, set.title)}
                  >
                    Xóa
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state fc-empty">
          {canImport ? (
            <>
              <p>Chưa có bộ thẻ nào. Dán danh sách từ vựng vào panel bên trên để tạo bộ đầu tiên.</p>
              {teacherCourses.length ? (
                <button type="button" className="button" onClick={focusImportPanel}>
                  Nhập bộ thẻ đầu tiên
                </button>
              ) : null}
            </>
          ) : ownedCourseCount ? (
            <>
              <p>Khóa học của bạn chưa có bộ thẻ nào. Trong lúc chờ giảng viên nhập, hãy tiếp tục bài học.</p>
              <Link className="button" to="/learn">
                Vào phòng học
              </Link>
            </>
          ) : (
            <>
              <p>Bộ thẻ đi kèm từng khóa học. Đăng ký một khóa để mở các bộ thẻ ghi nhớ.</p>
              <Link className="button" to="/courses">
                Xem khóa học
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
