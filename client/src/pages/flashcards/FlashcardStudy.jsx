import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  applyAnswer,
  buildLearnQuestion,
  buildLearnQueue,
  buildMatchBoard,
  buildTest,
  createEmptyProgress,
  gradeTest,
  gradeTestQuestion,
  isMatchPair,
  isWrittenAnswerCorrect,
  MATCH_PAIR_COUNT,
  seededShuffle,
  STUDY_MODES,
  summarizeProgress,
  TEST_QUESTION_KINDS
} from '../../lib/flashcardStudy';

const TEST_KIND_LABELS = {
  choice: 'Trắc nghiệm',
  true_false: 'Đúng / Sai',
  written: 'Gõ đáp án'
};

// ─── Thẻ ghi nhớ ──────────────────────────────────────────────────────────────

function FlashcardsMode({ cards }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [definitionFirst, setDefinitionFirst] = useState(false);
  const [seed, setSeed] = useState(1);

  const ordered = useMemo(() => (shuffled ? seededShuffle(cards, seed) : cards), [cards, shuffled, seed]);
  const card = ordered[index] || null;

  useEffect(() => {
    setIndex(0);
    setFlipped(false);
  }, [ordered]);

  function go(step) {
    setFlipped(false);
    setIndex((previous) => {
      const next = previous + step;
      if (next < 0) return ordered.length - 1;
      if (next >= ordered.length) return 0;
      return next;
    });
  }

  if (!card) {
    return <p className="empty-state">Bộ thẻ này chưa có thẻ nào.</p>;
  }

  const front = definitionFirst ? card.definition : card.term;
  const back = definitionFirst ? card.term : card.definition;

  return (
    <div className="fc-flashcards">
      <button
        type="button"
        className={`fc-card ${flipped ? 'is-flipped' : ''}`}
        onClick={() => setFlipped((value) => !value)}
        aria-label="Lật thẻ"
      >
        <span className="fc-card__hint">{flipped ? 'Mặt sau' : 'Mặt trước — bấm để lật'}</span>
        <span className="fc-card__text">{flipped ? back : front}</span>
      </button>

      <div className="fc-flashcards__nav">
        <button type="button" className="button-ghost" onClick={() => go(-1)}>
          ← Trước
        </button>
        <span className="fc-flashcards__counter">
          {index + 1} / {ordered.length}
        </span>
        <button type="button" className="button-ghost" onClick={() => go(1)}>
          Sau →
        </button>
      </div>

      <div className="fc-toolbar">
        <button
          type="button"
          className={`button-ghost ${shuffled ? 'is-active' : ''}`}
          onClick={() => {
            setShuffled((value) => !value);
            setSeed(Date.now() % 100000);
          }}
        >
          {shuffled ? '🔀 Đang trộn' : '🔀 Trộn thẻ'}
        </button>
        <button
          type="button"
          className={`button-ghost ${definitionFirst ? 'is-active' : ''}`}
          onClick={() => {
            setDefinitionFirst((value) => !value);
            setFlipped(false);
          }}
        >
          ⇄ {definitionFirst ? 'Hiện định nghĩa trước' : 'Hiện thuật ngữ trước'}
        </button>
      </div>
    </div>
  );
}

// ─── Học ──────────────────────────────────────────────────────────────────────

function LearnMode({ cards, progress, onProgressChange }) {
  const [seed, setSeed] = useState(() => Date.now() % 100000);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState(null);

  const queue = useMemo(() => buildLearnQueue(cards, progress, seed), [cards, progress, seed]);
  const card = queue[0] || null;
  const question = useMemo(
    () => (card ? buildLearnQuestion(card, cards, progress, seed) : null),
    [card, cards, progress, seed]
  );
  const summary = summarizeProgress(cards, progress);

  function submit(isCorrect) {
    setResult({ isCorrect, definition: card.definition });
  }

  function next() {
    onProgressChange(applyAnswer(progress, card.id, result.isCorrect));
    setResult(null);
    setAnswer('');
  }

  if (!cards.length) {
    return <p className="empty-state">Bộ thẻ này chưa có thẻ nào.</p>;
  }

  if (!card) {
    return (
      <div className="fc-done">
        <strong>Đã thuộc hết {cards.length} thẻ 🎉</strong>
        <p>Bạn có thể học lại từ đầu để ôn.</p>
        <button
          type="button"
          className="button"
          onClick={() => {
            onProgressChange(createEmptyProgress(cards));
            setSeed(Date.now() % 100000);
          }}
        >
          Học lại từ đầu
        </button>
      </div>
    );
  }

  return (
    <div className="fc-learn">
      <div className="fc-progress">
        <span className="fc-progress__chip is-mastered">Đã thuộc {summary.mastered}</span>
        <span className="fc-progress__chip is-learning">Đang học {summary.learning}</span>
        <span className="fc-progress__chip">Chưa học {summary.untouched}</span>
      </div>

      <div className="fc-question">
        <span className="eyebrow">{question.kind === 'written' ? 'Gõ đáp án' : 'Chọn đáp án đúng'}</span>
        <h3>{card.term}</h3>

        {question.kind === 'choice' ? (
          <div className="fc-options">
            {question.options.map((option) => (
              <button
                key={option.id}
                type="button"
                className={[
                  'fc-option',
                  result && option.id === card.id ? 'is-correct' : '',
                  result && !result.isCorrect && option.id === result.pickedId ? 'is-wrong' : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={Boolean(result)}
                onClick={() => setResult({ isCorrect: option.id === card.id, pickedId: option.id })}
              >
                {option.definition}
              </button>
            ))}
          </div>
        ) : (
          <form
            className="fc-written"
            onSubmit={(event) => {
              event.preventDefault();
              if (!result) submit(isWrittenAnswerCorrect(card, answer));
            }}
          >
            <input
              className="lesson-input"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="Gõ định nghĩa..."
              disabled={Boolean(result)}
              autoFocus
            />
            {!result ? (
              <button type="submit" className="button" disabled={!answer.trim()}>
                Trả lời
              </button>
            ) : null}
          </form>
        )}

        {result ? (
          <div className={result.isCorrect ? 'exercise-feedback success' : 'exercise-feedback'}>
            {result.isCorrect ? 'Đúng rồi!' : `Đáp án đúng: ${card.definition}`}
            <button type="button" className="button" onClick={next}>
              Tiếp tục
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Kiểm tra ─────────────────────────────────────────────────────────────────

function TestMode({ cards }) {
  const [config, setConfig] = useState({ length: 10, kinds: TEST_QUESTION_KINDS });
  const [seed, setSeed] = useState(() => Date.now() % 100000);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const questions = useMemo(
    () => buildTest(cards, { length: config.length, kinds: config.kinds, seed }),
    [cards, config, seed]
  );
  const score = gradeTest(questions, answers);
  const answered = questions.filter((q) => answers[q.id] !== undefined && answers[q.id] !== '').length;

  function restart() {
    setSeed(Date.now() % 100000);
    setAnswers({});
    setSubmitted(false);
  }

  function toggleKind(kind) {
    setConfig((previous) => {
      const kinds = previous.kinds.includes(kind)
        ? previous.kinds.filter((item) => item !== kind)
        : [...previous.kinds, kind];
      return { ...previous, kinds: kinds.length ? kinds : previous.kinds };
    });
    restart();
  }

  if (!cards.length) {
    return <p className="empty-state">Bộ thẻ này chưa có thẻ nào.</p>;
  }

  return (
    <div className="fc-test">
      <div className="fc-test__config">
        <label className="auth-field">
          <span>Số câu</span>
          <select
            value={config.length}
            onChange={(event) => {
              setConfig((previous) => ({ ...previous, length: Number(event.target.value) }));
              restart();
            }}
          >
            {[5, 10, 20, 30].map((value) => (
              <option key={value} value={value}>
                {Math.min(value, cards.length)} câu
              </option>
            ))}
          </select>
        </label>

        <div className="fc-test__kinds">
          <span>Dạng câu</span>
          <div>
            {TEST_QUESTION_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                className={`button-ghost ${config.kinds.includes(kind) ? 'is-active' : ''}`}
                onClick={() => toggleKind(kind)}
              >
                {TEST_KIND_LABELS[kind]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="fc-test__questions">
        {questions.map((question, index) => {
          const answer = answers[question.id];
          const correct = submitted && gradeTestQuestion(question, answer);

          return (
            <article key={question.id} className="fc-test__item">
              <div className="fc-test__head">
                <span>Câu {index + 1}</span>
                <span className="pill">{TEST_KIND_LABELS[question.kind]}</span>
              </div>

              {question.kind === 'true_false' ? (
                <p className="fc-test__prompt">
                  <strong>{question.card.term}</strong> có nghĩa là &ldquo;{question.shownDefinition}&rdquo;?
                </p>
              ) : (
                <p className="fc-test__prompt">
                  <strong>{question.card.term}</strong>
                </p>
              )}

              {question.kind === 'choice' ? (
                <div className="fc-options">
                  {question.options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={[
                        'fc-option',
                        answer === option.id ? 'is-picked' : '',
                        submitted && option.id === question.card.id ? 'is-correct' : '',
                        submitted && answer === option.id && !correct ? 'is-wrong' : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      disabled={submitted}
                      onClick={() => setAnswers((p) => ({ ...p, [question.id]: option.id }))}
                    >
                      {option.definition}
                    </button>
                  ))}
                </div>
              ) : question.kind === 'true_false' ? (
                <div className="fc-options">
                  {[
                    { value: 'true', label: 'Đúng' },
                    { value: 'false', label: 'Sai' }
                  ].map((choice) => (
                    <button
                      key={choice.value}
                      type="button"
                      className={[
                        'fc-option',
                        answer === choice.value ? 'is-picked' : '',
                        submitted && question.expected === choice.value ? 'is-correct' : '',
                        submitted && answer === choice.value && !correct ? 'is-wrong' : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      disabled={submitted}
                      onClick={() => setAnswers((p) => ({ ...p, [question.id]: choice.value }))}
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  className="lesson-input"
                  value={answer || ''}
                  placeholder="Gõ định nghĩa..."
                  disabled={submitted}
                  onChange={(event) => setAnswers((p) => ({ ...p, [question.id]: event.target.value }))}
                />
              )}

              {submitted ? (
                <div className={correct ? 'exercise-feedback success' : 'exercise-feedback'}>
                  {correct ? 'Đúng' : `Đáp án đúng: ${question.card.definition}`}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="excel-lesson-panel__footer">
        <span>
          {submitted
            ? `Kết quả: ${score.correct}/${score.total} câu đúng`
            : `${answered}/${questions.length} câu đã trả lời`}
        </span>
        {submitted ? (
          <button type="button" className="button" onClick={restart}>
            Làm đề khác
          </button>
        ) : (
          <button
            type="button"
            className="button"
            onClick={() => setSubmitted(true)}
            disabled={answered < questions.length}
          >
            Nộp bài
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Ghép cặp ─────────────────────────────────────────────────────────────────

function MatchMode({ cards }) {
  const [seed, setSeed] = useState(() => Date.now() % 100000);
  const [picked, setPicked] = useState(null);
  const [matched, setMatched] = useState([]);
  const [wrongPair, setWrongPair] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(null);

  const board = useMemo(() => buildMatchBoard(cards, { pairs: MATCH_PAIR_COUNT, seed }), [cards, seed]);
  const done = board.pairCount > 0 && matched.length === board.pairCount;

  useEffect(() => {
    if (done) {
      return undefined;
    }
    startedAt.current = startedAt.current || Date.now();
    const timer = setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 100);
    return () => clearInterval(timer);
  }, [done, seed]);

  function restart() {
    setSeed(Date.now() % 100000);
    setPicked(null);
    setMatched([]);
    setWrongPair([]);
    setElapsed(0);
    startedAt.current = null;
  }

  function pick(tile) {
    if (matched.includes(tile.cardId) || wrongPair.length) {
      return;
    }

    if (!picked) {
      setPicked(tile);
      return;
    }

    if (picked.id === tile.id) {
      setPicked(null);
      return;
    }

    if (isMatchPair(picked, tile)) {
      setMatched((previous) => [...previous, tile.cardId]);
      setPicked(null);
      return;
    }

    // Ghép sai: nháy đỏ một nhịp rồi bỏ chọn, để người chơi kịp nhìn.
    setWrongPair([picked.id, tile.id]);
    setTimeout(() => {
      setWrongPair([]);
      setPicked(null);
    }, 600);
  }

  if (!cards.length) {
    return <p className="empty-state">Bộ thẻ này chưa có thẻ nào.</p>;
  }

  return (
    <div className="fc-match">
      <div className="fc-match__head">
        <span className="fc-match__timer">{elapsed.toFixed(1)}s</span>
        <span>
          {matched.length}/{board.pairCount} cặp
        </span>
        <button type="button" className="button-ghost" onClick={restart}>
          Chơi lại
        </button>
      </div>

      {done ? (
        <div className="fc-done">
          <strong>Xong {board.pairCount} cặp trong {elapsed.toFixed(1)} giây 🎉</strong>
          <button type="button" className="button" onClick={restart}>
            Chơi ván mới
          </button>
        </div>
      ) : (
        <div className="fc-match__board">
          {board.tiles.map((tile) => (
            <button
              key={tile.id}
              type="button"
              className={[
                'fc-tile',
                matched.includes(tile.cardId) ? 'is-matched' : '',
                picked?.id === tile.id ? 'is-picked' : '',
                wrongPair.includes(tile.id) ? 'is-wrong' : ''
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => pick(tile)}
              disabled={matched.includes(tile.cardId)}
            >
              {tile.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Vỏ ngoài ─────────────────────────────────────────────────────────────────

export function FlashcardStudy({ set, progress, onProgressChange }) {
  const [mode, setMode] = useState('flashcards');
  const cards = set?.cards || [];

  return (
    <section className="content-card content-card--enterprise fc-study">
      <div className="section-head">
        <div>
          <span className="eyebrow">{set?.courseTitle || 'Flashcard'}</span>
          <h2>{set?.title}</h2>
          {set?.description ? <p>{set.description}</p> : null}
        </div>
        <span className="pill">{cards.length} thẻ</span>
      </div>

      <div className="fc-modes" role="tablist" aria-label="Chế độ học">
        {STUDY_MODES.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={mode === item.value}
            className={`fc-mode ${mode === item.value ? 'is-active' : ''}`}
            onClick={() => setMode(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {mode === 'flashcards' ? <FlashcardsMode cards={cards} /> : null}
      {mode === 'learn' ? (
        <LearnMode cards={cards} progress={progress} onProgressChange={onProgressChange} />
      ) : null}
      {mode === 'test' ? <TestMode cards={cards} /> : null}
      {mode === 'match' ? <MatchMode cards={cards} /> : null}
    </section>
  );
}
