import React, { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../../lib/scrollMotion';
import { useIsVisible } from './useInView';

// Mini-quiz điền từ tự chạy ở hero: con trỏ giả bay tới đáp án đúng, nhấc nó
// lên, kéo vào chỗ trống, đáp án nảy lên và chuyển xanh lá — rồi sang câu tiếp,
// lặp vô hạn. Người dùng bấm một đáp án bất kỳ thì demo nhường quyền điều khiển
// (tạm dừng tự chạy), chấm đúng/sai ngay, và tự chạy lại sau vài giây.
//
// Toàn bộ chuyển động là transform/opacity (CSS transition trong home-v2.css);
// JS chỉ đo vị trí và đổi pha. Tự dừng khi khối cuộn khỏi màn hình, khi tab bị
// ẩn, và không bao giờ tự chạy khi người dùng bật giảm chuyển động.
const QUESTIONS = [
  {
    lang: 'Tiếng Anh',
    skill: 'Ngữ pháp',
    before: 'She',
    after: 'to school every day.',
    options: ['go', 'goes', 'going'],
    answer: 'goes',
    meaning: 'Cô ấy đi học mỗi ngày.',
  },
  {
    lang: 'Tiếng Trung',
    skill: 'Từ vựng HSK 1',
    before: '我',
    after: '学生。',
    options: ['在', '是', '有'],
    answer: '是',
    meaning: 'Tôi là học sinh.',
  },
  {
    lang: 'Tiếng Anh',
    skill: 'Thì hiện tại hoàn thành',
    before: 'I have lived here',
    after: '2019.',
    options: ['for', 'from', 'since'],
    answer: 'since',
    meaning: 'Tôi đã sống ở đây từ năm 2019.',
  },
];

// Thời lượng từng pha (ms). Tổng ~4.6s mỗi câu.
const PHASE_MS = { idle: 700, move: 850, grab: 260, drag: 900, drop: 1900 };
const NEXT_PHASE = { idle: 'move', move: 'grab', grab: 'drag', drag: 'drop' };
const RESUME_AFTER_USER_MS = 5000;

export function HeroQuizDemo({ onAnswer }) {
  const cardRef = useRef(null);
  const slotRef = useRef(null);
  const chipRefs = useRef({});
  const timersRef = useRef([]);

  const [reduced] = useState(prefersReducedMotion);
  const [qIndex, setQIndex] = useState(0);
  const [phase, setPhase] = useState('idle');
  const [placed, setPlaced] = useState(null); // { word, correct }
  const [cursor, setCursor] = useState(null); // { x, y }
  const [ghost, setGhost] = useState(null); // { x, y }
  const [userMode, setUserMode] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [pageVisible, setPageVisible] = useState(true);
  const onScreen = useIsVisible(cardRef);

  const question = QUESTIONS[qIndex];
  const autoplay = !reduced && !userMode && onScreen && pageVisible;

  useEffect(() => {
    const onVisibility = () => setPageVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  function centerOf(element) {
    const card = cardRef.current;
    if (!card || !element) return null;
    const box = card.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return { x: rect.left - box.left + rect.width / 2, y: rect.top - box.top + rect.height / 2 };
  }

  function restPoint() {
    const card = cardRef.current;
    if (!card) return null;
    return { x: card.offsetWidth * 0.84, y: card.offsetHeight * 0.9 };
  }

  // Dừng tự chạy giữa chừng (cuộn đi, người dùng bấm) → về pha đầu của câu.
  useEffect(() => {
    if (!autoplay) {
      setGhost(null);
      setPhase('idle');
    }
  }, [autoplay]);

  useEffect(() => {
    if (!autoplay) return undefined;
    const answerChip = chipRefs.current[question.answer];

    if (phase === 'idle') {
      setPlaced(null);
      setGhost(null);
      setCursor(restPoint());
    } else if (phase === 'move') {
      setCursor(centerOf(answerChip));
    } else if (phase === 'grab') {
      setGhost(centerOf(answerChip));
    } else if (phase === 'drag') {
      const target = centerOf(slotRef.current);
      setCursor(target);
      setGhost(target);
    } else if (phase === 'drop') {
      setGhost(null);
      setPlaced({ word: question.answer, correct: true });
      onAnswer?.(true);
    }

    const timer = setTimeout(() => {
      if (phase === 'drop') {
        setQIndex((current) => (current + 1) % QUESTIONS.length);
        setPhase('idle');
      } else {
        setPhase(NEXT_PHASE[phase]);
      }
    }, PHASE_MS[phase]);
    return () => clearTimeout(timer);
    // centerOf/restPoint chỉ đọc ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, autoplay, qIndex]);

  function later(fn, ms) {
    timersRef.current.push(setTimeout(fn, ms));
  }

  function choose(word) {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setUserMode(true);

    const correct = word === question.answer;
    setPlaced({ word, correct });
    onAnswer?.(correct);
    setAnnounce(
      correct
        ? `Chính xác! Đáp án là ${word}. ${question.meaning}`
        : `Chưa đúng, ${word} không phải đáp án. Thử lại nhé.`
    );

    if (correct) {
      later(() => {
        setPlaced(null);
        setQIndex((current) => (current + 1) % QUESTIONS.length);
      }, 1800);
    } else {
      later(() => setPlaced(null), 1000);
    }
    later(() => setUserMode(false), RESUME_AFTER_USER_MS);
  }

  const autoPicked = autoplay && (phase === 'grab' || phase === 'drag' || phase === 'drop');
  const slotState = placed ? (placed.correct ? 'is-correct' : 'is-wrong') : '';

  return (
    <div className="hv-quiz" ref={cardRef}>
      <div className="hv-quiz__top">
        <span className="hv-quiz__tag">
          {question.lang} · {question.skill}
        </span>
        <span className="hv-quiz__dots" aria-hidden="true">
          {QUESTIONS.map((item, i) => (
            <span key={item.answer} className={i === qIndex ? 'is-active' : i < qIndex ? 'is-done' : ''} />
          ))}
        </span>
      </div>

      <p className="hv-quiz__prompt">Điền vào chỗ trống</p>

      <p className="hv-quiz__sentence" lang={question.lang === 'Tiếng Trung' ? 'zh' : 'en'}>
        <span>{question.before}</span>{' '}
        <span ref={slotRef} className={`hv-quiz__slot ${slotState}`} key={`${qIndex}-${placed?.word || ''}`}>
          {placed ? placed.word : <span className="hv-visually-hidden">chỗ trống</span>}
        </span>{' '}
        <span>{question.after}</span>
      </p>

      <div className="hv-quiz__options" role="group" aria-label="Chọn đáp án">
        {question.options.map((word) => {
          const pickedHere = (autoPicked && word === question.answer) || placed?.word === word;
          return (
            <button
              key={`${qIndex}-${word}`}
              ref={(node) => {
                chipRefs.current[word] = node;
              }}
              type="button"
              className={`hv-chip ${pickedHere ? 'is-picked' : ''}`}
              onClick={() => choose(word)}
              lang={question.lang === 'Tiếng Trung' ? 'zh' : 'en'}
            >
              {word}
            </button>
          );
        })}
      </div>

      <p className={`hv-quiz__feedback ${slotState}`} aria-hidden="true">
        {placed ? (
          placed.correct ? (
            <>
              <svg viewBox="0 0 24 24">
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
              Chính xác! <span className="hv-quiz__xp">+10 XP</span>
            </>
          ) : (
            'Chưa đúng — thử lại nhé!'
          )
        ) : (
          <span className="hv-quiz__meaning">“{question.meaning}”</span>
        )}
      </p>
      <span className="hv-visually-hidden" aria-live="polite">
        {announce}
      </span>

      {ghost ? (
        <span
          className={`hv-quiz__ghost ${phase === 'drag' ? 'is-moving' : ''}`}
          style={{ transform: `translate3d(${ghost.x}px, ${ghost.y}px, 0) translate(-50%, -50%) rotate(-3deg)` }}
          aria-hidden="true"
        >
          {question.answer}
        </span>
      ) : null}

      {cursor && autoplay ? (
        <svg
          className={`hv-quiz__cursor ${phase === 'grab' || phase === 'drag' ? 'is-pressing' : ''}`}
          style={{ transform: `translate3d(${cursor.x - 4}px, ${cursor.y - 2}px, 0)` }}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M5 3l14 7.5-6.2 1.6L10 18.5 5 3Z" />
        </svg>
      ) : null}
    </div>
  );
}
