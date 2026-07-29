import React, { useMemo, useState } from 'react';
import { StrokeGlyph } from '../../components/StrokeGlyph';
import { BASIC_STROKES, CHINESE_STROKES } from '../../lib/strokes';

const QUIZ_LENGTH = 10;
const OPTION_COUNT = 4;

// Trộn ổn định theo seed để bộ đề không nhảy lung tung mỗi lần render, nhưng
// vẫn khác nhau giữa các lượt làm bài (seed đổi khi bấm "Làm lại").
function seededShuffle(items, seed) {
  let value = seed;
  const next = () => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value / 2147483648;
  };

  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function buildQuiz(pool, seed, direction) {
  const picked = seededShuffle(pool, seed).slice(0, Math.min(QUIZ_LENGTH, pool.length));

  return picked.map((answer, index) => {
    const distractors = seededShuffle(
      CHINESE_STROKES.filter((stroke) => stroke.id !== answer.id),
      seed + index * 7919
    ).slice(0, OPTION_COUNT - 1);

    return {
      id: `${answer.id}-${index}`,
      answer,
      direction,
      options: seededShuffle([answer, ...distractors], seed + index * 104729)
    };
  });
}

// Bảng tra: xem toàn bộ nét kèm tên, cách đọc và chữ ví dụ.
function StrokeReference({ strokes }) {
  return (
    <div className="stroke-reference">
      {strokes.map((stroke) => (
        <article key={stroke.id} className="stroke-card">
          <StrokeGlyph stroke={stroke} size={104} />
          <div className="stroke-card__body">
            <strong>{stroke.vi}</strong>
            <span className="stroke-card__zh">
              {stroke.zh} · {stroke.pinyin}
            </span>
            <span className="stroke-card__example">Ví dụ: {stroke.example}</span>
            <small>{stroke.tip}</small>
          </div>
        </article>
      ))}
    </div>
  );
}

export function StrokePractice({ onCompleted }) {
  const [scope, setScope] = useState('basic');
  const [mode, setMode] = useState('reference');
  // 'name' = nhìn hình chọn tên; 'glyph' = nghe tên chọn hình.
  const [direction, setDirection] = useState('name');
  const [seed, setSeed] = useState(() => Date.now() % 2147483647);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const pool = scope === 'basic' ? BASIC_STROKES : CHINESE_STROKES;
  const questions = useMemo(() => buildQuiz(pool, seed, direction), [pool, seed, direction]);

  const answeredCount = questions.filter((question) => answers[question.id]).length;
  const score = questions.filter((question) => answers[question.id] === question.answer.id).length;
  const canSubmit = answeredCount === questions.length && questions.length > 0;

  function resetQuiz(nextSeed = Date.now() % 2147483647) {
    setSeed(nextSeed);
    setAnswers({});
    setSubmitted(false);
  }

  function pick(questionId, strokeId) {
    if (submitted) {
      return;
    }
    setAnswers((previous) => ({ ...previous, [questionId]: strokeId }));
  }

  function handleSubmit() {
    setSubmitted(true);
    onCompleted?.(score, questions.length);
  }

  return (
    <section className="content-card content-card--enterprise stroke-practice">
      <div className="section-head">
        <div>
          <span className="eyebrow">Luyện nét chữ Hán</span>
          <h2>Nhận biết các nét cơ bản</h2>
          <p>
            Xem bảng nét để nhớ mặt nét và tên gọi, rồi chuyển sang phần luyện tập để kiểm tra.
            Chấm tròn trên hình là điểm đặt bút.
          </p>
        </div>
        <span className="pill">{pool.length} nét</span>
      </div>

      <div className="stroke-practice__controls">
        <div className="stroke-practice__switch" role="tablist" aria-label="Chế độ">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'reference'}
            className={mode === 'reference' ? 'is-active' : ''}
            onClick={() => setMode('reference')}
          >
            Bảng nét
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'quiz'}
            className={mode === 'quiz' ? 'is-active' : ''}
            onClick={() => setMode('quiz')}
          >
            Luyện tập
          </button>
        </div>

        <div className="stroke-practice__filters">
          <label className="auth-field">
            <span>Phạm vi</span>
            <select
              value={scope}
              onChange={(event) => {
                setScope(event.target.value);
                resetQuiz();
              }}
            >
              <option value="basic">8 nét cơ bản</option>
              <option value="all">Toàn bộ {CHINESE_STROKES.length} nét</option>
            </select>
          </label>

          {mode === 'quiz' ? (
            <label className="auth-field">
              <span>Dạng hỏi</span>
              <select
                value={direction}
                onChange={(event) => {
                  setDirection(event.target.value);
                  resetQuiz();
                }}
              >
                <option value="name">Nhìn hình → chọn tên</option>
                <option value="glyph">Đọc tên → chọn hình</option>
              </select>
            </label>
          ) : null}
        </div>
      </div>

      {mode === 'reference' ? (
        <StrokeReference strokes={pool} />
      ) : (
        <>
          <div className="stroke-quiz">
            {questions.map((question, index) => {
              const chosen = answers[question.id];
              const isCorrect = chosen === question.answer.id;

              return (
                <article key={question.id} className="stroke-quiz__item">
                  <div className="stroke-quiz__head">
                    <span>Câu {index + 1}</span>
                    <strong>
                      {question.direction === 'name'
                        ? 'Chọn tên gọi đúng của nét trong hình'
                        : `Chọn hình đúng của "${question.answer.vi}"`}
                    </strong>
                  </div>

                  {question.direction === 'name' ? (
                    <>
                      <div className="stroke-quiz__prompt">
                        <StrokeGlyph stroke={question.answer} size={132} />
                      </div>
                      <div className="stroke-quiz__options">
                        {question.options.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            className={[
                              'stroke-option',
                              chosen === option.id ? 'is-picked' : '',
                              submitted && option.id === question.answer.id ? 'is-correct' : '',
                              submitted && chosen === option.id && !isCorrect ? 'is-wrong' : ''
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            onClick={() => pick(question.id, option.id)}
                            disabled={submitted}
                          >
                            {option.vi}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="stroke-quiz__options stroke-quiz__options--glyph">
                      {question.options.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className={[
                            'stroke-option stroke-option--glyph',
                            chosen === option.id ? 'is-picked' : '',
                            submitted && option.id === question.answer.id ? 'is-correct' : '',
                            submitted && chosen === option.id && !isCorrect ? 'is-wrong' : ''
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          onClick={() => pick(question.id, option.id)}
                          disabled={submitted}
                        >
                          <StrokeGlyph stroke={option} size={92} showStart={false} />
                        </button>
                      ))}
                    </div>
                  )}

                  {submitted ? (
                    <div className={isCorrect ? 'exercise-feedback success' : 'exercise-feedback'}>
                      {isCorrect
                        ? `Đúng — ${question.answer.vi} (${question.answer.zh} ${question.answer.pinyin})`
                        : `Đáp án đúng: ${question.answer.vi} (${question.answer.zh} ${question.answer.pinyin}). ${question.answer.tip}`}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          <div className="excel-lesson-panel__footer">
            <span>
              {submitted
                ? `Kết quả: ${score}/${questions.length} nét đúng`
                : `${answeredCount}/${questions.length} câu đã trả lời`}
            </span>
            {submitted ? (
              <button type="button" className="button" onClick={() => resetQuiz()}>
                Làm bộ khác
              </button>
            ) : (
              <button type="button" className="button" onClick={handleSubmit} disabled={!canSubmit}>
                Kiểm tra đáp án
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
