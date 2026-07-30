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
  footer = null
}) {
  const [localExpanded, setLocalExpanded] = useState({});
  const isControlled = Boolean(expandedSections);
  const expandedMap = isControlled ? expandedSections : localExpanded;

  const allLessons = sections.flatMap((section) => (Array.isArray(section?.lessons) ? section.lessons : []));
  const totalUnits = Number.isFinite(totalLessonsCount) ? totalLessonsCount : allLessons.length;
  const doneUnits = Number.isFinite(completedLessonsCount)
    ? completedLessonsCount
    : allLessons.filter((lesson) => isLessonComplete(lesson, progressMap)).length;

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

            return (
              <article
                key={`${section?.title || 'section'}-${sectionIndex}`}
                className={`lesson-list-section ${isExpanded ? 'is-expanded' : ''} ${
                  isComplete ? 'is-complete' : isStarted ? 'is-started' : ''
                }`}
              >
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
                  <div className="lesson-list-section__lessons">
                    {lessons.length ? (
                      lessons.map((lesson) => {
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

                        return onSelectLesson ? (
                          <button
                            key={lesson.id}
                            type="button"
                            className={className}
                            onClick={() => onSelectLesson(lesson.id)}
                          >
                            {content}
                          </button>
                        ) : (
                          <div key={lesson.id} className={className}>
                            {content}
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
