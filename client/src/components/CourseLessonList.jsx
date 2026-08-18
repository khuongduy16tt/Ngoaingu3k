import React, { useState } from 'react';
import {
  MAX_LESSON_STARS,
  MAX_SECTION_TROPHIES,
  getLessonStars,
  getSectionStars,
  getSectionTrophies,
  isLessonComplete
} from '../lib/lessonStars';

function StarIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.6l2.96 6 6.62.96-4.79 4.67 1.13 6.59L12 17.71l-5.92 3.11 1.13-6.59L2.42 9.56l6.62-.96L12 2.6z" />
    </svg>
  );
}

function TrophyIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.4 3.6h9.2v4.1a4.6 4.6 0 0 1-9.2 0V3.6Z" fill="currentColor" />
      <path
        d="M7.4 5.3H5.6a2.7 2.7 0 0 0 2.2 3.4M16.6 5.3h1.8a2.7 2.7 0 0 1-2.2 3.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M12 12.2v5.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.5 20.4l1-2.9h5l1 2.9H8.5Z" fill="currentColor" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="lesson-list-item__check-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5.4 12.7l4.2 4.2L18.6 7.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="lesson-list-item__check-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8.4 11V8.6a3.6 3.6 0 0 1 7.2 0V11"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect x="6" y="10.6" width="12" height="9" rx="2.4" fill="currentColor" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className="lesson-list-section__chevron" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8.8 5.6l6.6 6.4-6.6 6.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StarRow({ value, max = MAX_LESSON_STARS }) {
  return (
    <span className="lesson-list__stars" aria-label={`${value}/${max} sao`}>
      {Array.from({ length: max }, (_, index) => (
        <StarIcon key={index} className={`lesson-list__star ${index < value ? 'is-earned' : ''}`} />
      ))}
    </span>
  );
}

function TrophyRow({ value, max = MAX_SECTION_TROPHIES }) {
  return (
    <span className="lesson-list__trophies" aria-label={`${value}/${max} cúp`}>
      {Array.from({ length: max }, (_, index) => (
        <TrophyIcon key={index} className={`lesson-list__trophy ${index < value ? 'is-earned' : ''}`} />
      ))}
    </span>
  );
}

/**
 * Danh sách chương/bài dùng chung cho trang chi tiết khóa học và phòng học.
 *
 * - `onSelectLesson` không truyền → các bài chỉ để xem (trang chi tiết khóa học
 *   khi học viên chưa mua), truyền → bấm được để mở bài (phòng học).
 * - `expandedSections`/`onToggleSection` cho phép trang ngoài điều khiển chương
 *   nào đang mở (phòng học tự mở chương của bài đang học); không truyền thì
 *   component tự quản lý.
 * - `sectionOffset` để số hiệu chương vẫn đúng khi danh sách bị phân trang.
 */
export function CourseLessonList({
  sections = [],
  progressMap = {},
  heading = 'Danh sách bài học',
  variant = 'wide',
  sectionOffset = 0,
  completedLessonsCount,
  totalLessonsCount,
  selectedLessonId = '',
  onSelectLesson,
  expandedSections,
  onToggleSection,
  emptyMessage = 'Danh sách bài học sẽ hiển thị khi chương được đồng bộ.',
  footer = null,
  // Kéo thả sắp xếp bài. Mặc định TẮT: danh sách này còn dùng ở trang khóa
  // học công khai, nơi người xem không được sắp xếp gì.
  editable = false,
  onReorderLessons,
  onReorderSections
}) {
  const [draggedLesson, setDraggedLesson] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [draggedSection, setDraggedSection] = useState(null);
  const [sectionDropTarget, setSectionDropTarget] = useState(null);
  const canReorder = Boolean(editable && onReorderLessons);
  const canReorderSections = Boolean(editable && onReorderSections);
  const [localExpanded, setLocalExpanded] = useState({});
  const isControlled = Boolean(expandedSections);
  const expandedMap = isControlled ? expandedSections : localExpanded;

  const allLessons = sections.flatMap((section) => (Array.isArray(section?.lessons) ? section.lessons : []));
  const totalUnits = Number.isFinite(totalLessonsCount) ? totalLessonsCount : allLessons.length;
  const doneUnits = Number.isFinite(completedLessonsCount)
    ? completedLessonsCount
    : allLessons.filter((lesson) => isLessonComplete(lesson, progressMap)).length;

  // Cắt bài khỏi chương nguồn rồi chèn vào chương đích. Hai chương là hai
  // mảng khác nhau nên chỉ bù trừ chỉ số khi cùng một chương.
  function moveLesson(from, toSectionIndex, insertionIndex) {
    const next = sections.map((section) => ({
      ...section,
      lessons: Array.isArray(section?.lessons) ? [...section.lessons] : []
    }));

    const source = next[from.sectionIndex - sectionOffset];
    const target = next[toSectionIndex - sectionOffset];
    if (!source || !target) return;

    const [moved] = source.lessons.splice(from.lessonIndex, 1);
    if (!moved) return;

    const sameSection = source === target;
    const bounded = sameSection && from.lessonIndex < insertionIndex ? insertionIndex - 1 : insertionIndex;
    target.lessons.splice(Math.max(0, Math.min(bounded, target.lessons.length)), 0, moved);

    onReorderLessons(next, { lessonId: moved.id, toSectionIndex });
  }

  function handleLessonDrop(toSectionIndex, insertionIndex) {
    if (!draggedLesson) return;
    moveLesson(draggedLesson, toSectionIndex, insertionIndex);
    setDraggedLesson(null);
    setDropTarget(null);
  }

  // Đổi chỗ hai chương. insertionIndex theo hệ "chèn TRƯỚC phần tử thứ i" nên đi
  // xuống phải bù trừ 1 sau khi đã cắt chương ra khỏi mảng.
  function moveSection(fromIndex, insertionIndex) {
    if (fromIndex === insertionIndex || fromIndex + 1 === insertionIndex) {
      return;
    }

    const next = sections.map((section) => ({ ...section }));
    const [moved] = next.splice(fromIndex, 1);
    if (!moved) return;

    const bounded = fromIndex < insertionIndex ? insertionIndex - 1 : insertionIndex;
    next.splice(Math.max(0, Math.min(bounded, next.length)), 0, moved);

    onReorderSections(next);
  }

  function handleSectionDrop(sectionIndex) {
    if (draggedSection === null) return;

    const placement =
      sectionDropTarget?.sectionIndex === sectionIndex ? sectionDropTarget.placement : 'before';
    const insertionIndex = placement === 'after' ? sectionIndex + 1 : sectionIndex;

    moveSection(draggedSection - sectionOffset, insertionIndex - sectionOffset);
    setDraggedSection(null);
    setSectionDropTarget(null);
  }

  function toggleSection(sectionIndex) {
    if (onToggleSection) {
      onToggleSection(sectionIndex);
      return;
    }

    setLocalExpanded((previous) => ({
      ...previous,
      [sectionIndex]: !(previous[sectionIndex] ?? sectionIndex === 0)
    }));
  }

  return (
    <section className={`lesson-list ${variant === 'sidebar' ? 'lesson-list--sidebar' : 'lesson-list--wide'}`}>
      <header className="lesson-list__head">
        <h2>{heading}</h2>
        <span className="lesson-list__units">
          Đã học{' '}
          <strong>
            {doneUnits}/{totalUnits}
          </strong>{' '}
          Units
        </span>
      </header>

      {sections.length ? (
        <div className="lesson-list__sections">
          {sections.map((section, index) => {
            const sectionIndex = sectionOffset + index;
            const lessons = Array.isArray(section?.lessons) ? section.lessons : [];
            const isExpanded = expandedMap[sectionIndex] ?? index === 0;
            const doneCount = lessons.filter((lesson) => isLessonComplete(lesson, progressMap)).length;
            const sectionStars = getSectionStars(section, progressMap);
            const trophies = getSectionTrophies(sectionStars);
            const isComplete = lessons.length > 0 && doneCount === lessons.length;
            const isStarted = doneCount > 0 && !isComplete;
            const donePercent = lessons.length ? Math.round((doneCount / lessons.length) * 100) : 0;

            const isSectionDragging = draggedSection === sectionIndex;
            const isSectionDropBefore =
              !isSectionDragging &&
              sectionDropTarget?.sectionIndex === sectionIndex &&
              sectionDropTarget?.placement === 'before';
            const isSectionDropAfter =
              !isSectionDragging &&
              sectionDropTarget?.sectionIndex === sectionIndex &&
              sectionDropTarget?.placement === 'after';

            return (
              <article
                key={`${section?.title || 'section'}-${sectionIndex}`}
                className={[
                  'lesson-list-section',
                  isExpanded ? 'is-expanded' : '',
                  isComplete ? 'is-complete' : isStarted ? 'is-started' : '',
                  isSectionDragging ? 'is-section-dragging' : '',
                  isSectionDropBefore ? 'is-section-drop-before' : '',
                  isSectionDropAfter ? 'is-section-drop-after' : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                onDragOver={(event) => {
                  // Chỉ nhận khi đang kéo CHƯƠNG. Lúc kéo bài, các handler bên
                  // trong đã stopPropagation nên không lọt tới đây.
                  if (draggedSection === null) return;
                  event.preventDefault();
                  const bounds = event.currentTarget.getBoundingClientRect();
                  const placement =
                    event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
                  setSectionDropTarget({ sectionIndex, placement });
                }}
                onDrop={(event) => {
                  if (draggedSection === null) return;
                  event.preventDefault();
                  handleSectionDrop(sectionIndex);
                }}
              >
                {/* Tay cầm nằm NGOÀI nút mở/đóng chương: nút lồng trong nút là
                    HTML sai, và cả khối head mà kéo được thì bấm để mở chương sẽ
                    hay bị nhận nhầm thành thao tác kéo. */}
                {canReorderSections ? (
                  <div
                    className="lesson-list-section__drag-row"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', `section-${sectionIndex}`);
                      setDraggedSection(sectionIndex);
                    }}
                    onDragEnd={() => {
                      setDraggedSection(null);
                      setSectionDropTarget(null);
                    }}
                  >
                    <span className="lesson-list-section__drag" aria-hidden="true">
                      ⠿
                    </span>
                    <span className="lesson-list-section__drag-label">Kéo để đổi vị trí chương</span>
                  </div>
                ) : null}

                <button
                  type="button"
                  className="lesson-list-section__head"
                  aria-expanded={isExpanded}
                  onClick={() => toggleSection(sectionIndex)}
                >
                  <span className="lesson-list-section__badge" aria-hidden="true">
                    <strong>{String(sectionIndex + 1).padStart(2, '0')}</strong>
                    <small>LESSON</small>
                  </span>

                  <span className="lesson-list-section__copy">
                    <strong>{section?.title || `Chủ đề ${sectionIndex + 1}`}</strong>
                    <span className="lesson-list-section__meta">
                      <span className="lesson-list-section__count">
                        {doneCount}/{lessons.length} Sections
                      </span>
                      <span className="lesson-list-section__score">
                        <StarIcon className="lesson-list__star is-earned" />
                        {sectionStars.earned}/{sectionStars.max}
                      </span>
                    </span>
                  </span>

                  <TrophyRow value={trophies} />
                  <ChevronIcon />

                  <span className="lesson-list-section__bar" aria-hidden="true">
                    <span style={{ width: `${donePercent}%` }} />
                  </span>
                </button>

                {isExpanded ? (
                  <div
                    className={`lesson-list-section__lessons ${
                      canReorder &&
                      draggedLesson &&
                      dropTarget?.sectionIndex === sectionIndex &&
                      dropTarget?.placement === 'end'
                        ? 'is-drop-end'
                        : ''
                    }`}
                    onDragOver={(event) => {
                      if (!canReorder || !draggedLesson) return;
                      // Lơ lửng ở khoảng trống của chương → mặc định thả xuống cuối,
                      // nhờ vậy chương chưa có bài nào cũng nhận được bài kéo sang.
                      event.preventDefault();
                      setDropTarget({ sectionIndex, lessonIndex: -1, placement: 'end' });
                    }}
                    onDrop={(event) => {
                      if (!canReorder || !draggedLesson) return;
                      event.preventDefault();
                      handleLessonDrop(sectionIndex, lessons.length);
                    }}
                  >
                    {lessons.length ? (
                      lessons.map((lesson, lessonIndex) => {
                        const isDone = isLessonComplete(lesson, progressMap);
                        const stars = getLessonStars(lesson, progressMap);
                        const isLocked = !isDone && lesson.status === 'locked';
                        const className = `lesson-list-item ${isDone ? 'is-done' : ''} ${
                          isLocked ? 'is-locked' : ''
                        } ${selectedLessonId && selectedLessonId === lesson.id ? 'is-selected' : ''}`;

                        const content = (
                          <>
                            <span className="lesson-list-item__check">
                              {isDone ? <CheckIcon /> : isLocked ? <LockIcon /> : null}
                            </span>
                            <span className="lesson-list-item__copy">
                              <strong>{lesson.title}</strong>
                              <StarRow value={stars} />
                            </span>
                          </>
                        );

                        const row = onSelectLesson ? (
                          <button
                            type="button"
                            className={className}
                            onClick={() => onSelectLesson(lesson.id)}
                          >
                            {content}
                          </button>
                        ) : (
                          <div className={className}>{content}</div>
                        );

                        // Ngoài chế độ sửa thì markup giữ nguyên như cũ — trang khóa
                        // học công khai không được mọc thêm tay cầm kéo.
                        if (!canReorder) {
                          return <React.Fragment key={lesson.id}>{row}</React.Fragment>;
                        }

                        const isDragging =
                          draggedLesson?.sectionIndex === sectionIndex &&
                          draggedLesson?.lessonIndex === lessonIndex;
                        const isDropBefore =
                          !isDragging &&
                          dropTarget?.sectionIndex === sectionIndex &&
                          dropTarget?.lessonIndex === lessonIndex &&
                          dropTarget?.placement === 'before';
                        const isDropAfter =
                          !isDragging &&
                          dropTarget?.sectionIndex === sectionIndex &&
                          dropTarget?.lessonIndex === lessonIndex &&
                          dropTarget?.placement === 'after';

                        return (
                          <div
                            key={lesson.id}
                            className={[
                              'lesson-list-item-drag',
                              isDragging ? 'is-dragging' : '',
                              isDropBefore ? 'is-drop-before' : '',
                              isDropAfter ? 'is-drop-after' : ''
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            draggable
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = 'move';
                              event.dataTransfer.setData('text/plain', lesson.id || '');
                              setDraggedLesson({ sectionIndex, lessonIndex, id: lesson.id });
                            }}
                            onDragEnd={() => {
                              setDraggedLesson(null);
                              setDropTarget(null);
                            }}
                            onDragOver={(event) => {
                              if (!draggedLesson) return;
                              event.preventDefault();
                              // Chặn nổi bọt: vùng chương bên ngoài cũng nhận dragover
                              // và sẽ ghi đè vị trí chèn chính xác vừa tính ở đây.
                              event.stopPropagation();
                              const bounds = event.currentTarget.getBoundingClientRect();
                              const placement =
                                event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
                              setDropTarget({ sectionIndex, lessonIndex, placement });
                            }}
                            onDrop={(event) => {
                              if (!draggedLesson) return;
                              event.preventDefault();
                              event.stopPropagation();
                              const after =
                                dropTarget?.sectionIndex === sectionIndex &&
                                dropTarget?.lessonIndex === lessonIndex &&
                                dropTarget?.placement === 'after';
                              handleLessonDrop(sectionIndex, after ? lessonIndex + 1 : lessonIndex);
                            }}
                          >
                            <span className="lesson-list-item-drag__handle" aria-hidden="true">
                              ⠿
                            </span>
                            {row}
                          </div>
                        );
                      })
                    ) : (
                      <p className="lesson-list__empty">{emptyMessage}</p>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="lesson-list__empty">{emptyMessage}</p>
      )}

      {footer ? <div className="lesson-list__footer">{footer}</div> : null}
    </section>
  );
}

export default CourseLessonList;
