import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { OPEN_CONSULTATION_EVENT } from '../components/ConsultationFab';
import { submitConsultationRequest } from '../lib/leadService';
import { scrollIntoViewRespectingMotion } from '../lib/scrollMotion';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAuth } from '../providers/AuthProvider';
import { HSK_PASS_SCORE, hskChoices, hskQuestions, hskTests, scoreHsk } from '../data/hskTests';
import { TestPicker } from './placement/TestPicker';
import { ExamDialog } from './ExamRoomPage';

// Bài test trình độ HSK 1–5 ở /test/hsk/:level (cần đăng nhập).
// Chỉ có phần Đọc trắc nghiệm, chấm theo đáp án, đạt từ 60/100.
// Dùng lại giao diện phòng thi của bài test IELTS (placement-test.css).

const PHONE_PATTERN = /^[0-9+\s-]{8,15}$/;
const TICK_MS = 500;

function sessionKey(level) {
  return `ngoaingu3k-hsk-test-v1:${level}`;
}

function readSession(level) {
  try {
    const raw = localStorage.getItem(sessionKey(level));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(level, value) {
  try {
    localStorage.setItem(sessionKey(level), JSON.stringify(value));
  } catch {
    // Bộ nhớ bị chặn: vẫn làm bài được, chỉ là không khôi phục khi tải lại.
  }
}

function clearSession(level) {
  try {
    localStorage.removeItem(sessionKey(level));
  } catch {
    // ignore
  }
}

function emptyState() {
  return { phase: 'intro', partIndex: 0, answers: {}, deadline: null, info: { fullName: '', phone: '' }, result: null };
}

function formatClock(totalSeconds) {
  const safe = Math.max(0, totalSeconds);
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function answerKey(question) {
  return `q${question.n}`;
}

function getSuggestion(level, passed) {
  if (passed && level < 5) {
    return { course: `Thử sức HSK ${level + 1}`, text: `Bạn đã đạt trình độ HSK ${level}. Có thể học tiếp lên HSK ${level + 1}.` };
  }
  if (passed) {
    return { course: 'Lộ trình HSK 6', text: 'Bạn đã đạt trình độ HSK 5, phù hợp lộ trình HSK 6 và luyện đề nâng cao.' };
  }
  return { course: `Khoá HSK ${level}`, text: `Bạn chưa đạt HSK ${level}. Nên học khoá HSK ${level} để chắc từ vựng và ngữ pháp trước khi thi.` };
}

function HskGroup({ group, answers, setAnswer }) {
  const shared = Boolean(group.bank) && !group.codes;
  return (
    <section className="ptest-group">
      <header className="ptest-group__head">
        <h3>{group.title}</h3>
        <p>{group.instruction}</p>
      </header>

      {group.passage ? <p className="hsk-passage">{group.passage}</p> : null}

      {shared ? (
        <div className="ptest-list">
          <h4>Đáp án lựa chọn</h4>
          <ul>
            {hskChoices(group, {}).map((choice) => (
              <li key={choice.code}>
                <b>{choice.code}</b>
                <span>{choice.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="ptest-items">
        {group.questions.map((question) => {
          const key = answerKey(question);
          const value = answers[key];
          const choices = hskChoices(group, question);
          const pick = (code) => setAnswer(key, value === code ? '' : code);

          if (shared) {
            return (
              <div key={key} id={`hsk-${key}`} className="ptest-item ptest-item--row">
                <div className="ptest-item__prompt">
                  <span className={`ptest-num ${value ? 'is-answered' : ''}`}>{question.n}</span>
                  <p className="hsk-prompt">{question.prompt}</p>
                </div>
                <div className="ptest-pills" role="radiogroup" aria-label={`Câu ${question.n}`}>
                  {choices.map((choice) => (
                    <button
                      key={choice.code}
                      type="button"
                      role="radio"
                      aria-checked={value === choice.code}
                      title={choice.text}
                      className={`ptest-pill ${value === choice.code ? 'is-selected' : ''}`}
                      onClick={() => pick(choice.code)}
                    >
                      {choice.code}
                    </button>
                  ))}
                </div>
              </div>
            );
          }

          return (
            <div key={key} id={`hsk-${key}`} className="ptest-item ptest-item--mc">
              <div className="ptest-item__prompt">
                <span className={`ptest-num ${value ? 'is-answered' : ''}`}>{question.n}</span>
                <p className="hsk-prompt">{question.prompt || `Chỗ trống (${question.n})`}</p>
              </div>
              <div className="ptest-options">
                {choices.map((choice) => (
                  <button
                    key={choice.code}
                    type="button"
                    className={`ptest-option ${value === choice.code ? 'is-selected' : ''}`}
                    aria-pressed={value === choice.code}
                    onClick={() => pick(choice.code)}
                  >
                    <b>{choice.code}</b>
                    <span>{choice.text}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function HskTestPage() {
  const { level: levelParam } = useParams();
  const level = Number(levelParam);
  const test = hskTests[level];
  if (!test) return <Navigate to="/test" replace />;
  // key: đổi cấp HSK thì làm mới toàn bộ trạng thái.
  return <HskTest key={level} test={test} />;
}

function HskTest({ test }) {
  usePageTitle(`Test ${test.title} Free`);
  const auth = useAuth();
  const { level } = test;
  const allQuestions = useMemo(() => hskQuestions(test), [test]);

  const [state, setState] = useState(() => {
    const saved = readSession(level);
    return saved && saved.phase ? { ...emptyState(), ...saved } : emptyState();
  });
  const [now, setNow] = useState(() => Date.now());
  const [formError, setFormError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [leadStatus, setLeadStatus] = useState('idle');

  const { phase, partIndex, answers, deadline, info, result } = state;
  const part = test.parts[partIndex] || test.parts[0];
  const remainingSeconds = deadline ? Math.ceil((deadline - now) / 1000) : 0;

  function update(patch) {
    setState((previous) => ({ ...previous, ...(typeof patch === 'function' ? patch(previous) : patch) }));
  }

  // Điền sẵn họ tên, SĐT từ tài khoản.
  useEffect(() => {
    const profileName = auth.profile?.full_name || '';
    const profilePhone = auth.profile?.phone || '';
    if (!profileName && !profilePhone) return;
    update((previous) =>
      previous.info.fullName || previous.info.phone
        ? {}
        : { info: { fullName: profileName, phone: profilePhone } }
    );
  }, [auth.profile?.full_name, auth.profile?.phone]);

  useEffect(() => {
    if (phase !== 'intro') writeSession(level, state);
  }, [state, phase, level]);

  useEffect(() => {
    document.body.classList.add('ptest-page');
    return () => document.body.classList.remove('ptest-page');
  }, []);

  useEffect(() => {
    if (phase !== 'room') return undefined;
    document.body.classList.add('ptest-focus');
    return () => document.body.classList.remove('ptest-focus');
  }, [phase]);

  useEffect(() => {
    if (phase !== 'room' || !deadline) return undefined;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [phase, deadline]);

  useEffect(() => {
    if (phase !== 'room') return undefined;
    function onBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [phase]);

  useEffect(() => {
    if (phase === 'room' && deadline && remainingSeconds <= 0) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, deadline, remainingSeconds]);

  // Gửi kết quả về trung tâm một lần.
  useEffect(() => {
    if (phase !== 'result' || !result || result.leadSent || leadStatus !== 'idle') return;
    setLeadStatus('sending');
    submitConsultationRequest({
      fullName: info.fullName,
      phone: info.phone,
      email: auth.session?.user?.email || '',
      program: 'HSK',
      needs: `[Test trình độ ${test.title}] Đúng ${result.correct}/${result.total} câu · ${result.score}/100 điểm · ${result.passed ? 'Đạt' : 'Chưa đạt'}`,
      source: 'test-trinh-do'
    })
      .then(() => {
        setLeadStatus('sent');
        update((previous) => ({ result: { ...previous.result, leadSent: true } }));
      })
      .catch(() => setLeadStatus('failed'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, result]);

  function scrollTop() {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  function startTest(event) {
    event.preventDefault();
    const fullName = info.fullName.trim();
    const phone = info.phone.trim();
    if (!fullName || !phone) {
      setFormError('Vui lòng nhập họ tên và số điện thoại để nhận kết quả.');
      return;
    }
    if (!PHONE_PATTERN.test(phone)) {
      setFormError('Số điện thoại chưa đúng — hãy nhập 8–15 chữ số.');
      return;
    }
    setFormError('');
    setNow(Date.now());
    update({
      phase: 'room',
      partIndex: 0,
      answers: {},
      result: null,
      info: { fullName, phone },
      deadline: Date.now() + test.durationMinutes * 60_000
    });
    scrollTop();
  }

  function finish() {
    setConfirmOpen(false);
    update((previous) => ({
      phase: 'result',
      deadline: null,
      result: { ...scoreHsk(test, previous.answers), leadSent: false }
    }));
    scrollTop();
  }

  function restart() {
    clearSession(level);
    setLeadStatus('idle');
    setRestartOpen(false);
    setState((previous) => ({ ...emptyState(), info: previous.info }));
    scrollTop();
  }

  function setAnswer(key, value) {
    update((previous) => ({ answers: { ...previous.answers, [key]: value } }));
  }

  function goToPart(index) {
    update({ partIndex: index });
    document.querySelector('.ptest-body__questions')?.scrollTo({ top: 0 });
    scrollTop();
  }

  function jumpToQuestion(targetPartIndex, key) {
    if (targetPartIndex !== partIndex) update({ partIndex: targetPartIndex });
    setTimeout(() => {
      scrollIntoViewRespectingMotion(document.getElementById(`hsk-${key}`), { block: 'center' });
    }, 30);
  }

  // ─── Màn bắt đầu ────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div className="pt-landing">
        <section className="pt-landing__hero">
          <div className="pt-landing__copy">
            <TestPicker active={level} />
            <p className="pt-kicker pt-rise" style={{ '--d': 0 }}>
              Miễn phí · Tiếng Trung
            </p>
            <h1 className="pt-landing__title pt-rise" style={{ '--d': 1 }}>
              Test {test.title} <span>Free</span>
            </h1>
            <p className="pt-landing__lead pt-rise" style={{ '--d': 2 }}>
              Bài đọc hiểu theo format {test.title}, {allQuestions.length} câu trắc nghiệm trong {test.durationMinutes} phút. Nộp
              xong có ngay điểm, kết quả đạt hay chưa đạt và đáp án chi tiết.
            </p>
            <ol className="pt-skills pt-skills--hsk pt-rise" style={{ '--d': 3 }}>
              {test.parts.map((item, index) => (
                <li key={item.id} className="pt-3d">
                  <span className="pt-skills__num">0{index + 1}</span>
                  <strong>{item.title}</strong>
                  <span className="pt-skills__meta">Câu {item.range}</span>
                </li>
              ))}
            </ol>
            <ul className="pt-checks pt-rise" style={{ '--d': 4 }}>
              <li>Đạt từ {HSK_PASS_SCORE}/100 điểm</li>
              <li>Có điểm ngay khi nộp</li>
              <li>Tư vấn lộ trình miễn phí</li>
            </ul>
          </div>

          <form className="pt-form pt-3d pt-rise" style={{ '--d': 2 }} onSubmit={startTest} noValidate>
            <h2 className="pt-form__title">Bắt đầu làm bài</h2>
            <label className="pt-field">
              <span>Họ và tên</span>
              <input
                type="text"
                placeholder="Nguyễn Văn A"
                value={info.fullName}
                autoComplete="name"
                onChange={(event) => update({ info: { ...info, fullName: event.target.value } })}
              />
            </label>
            <label className="pt-field">
              <span>Số điện thoại</span>
              <input
                type="tel"
                inputMode="tel"
                placeholder="0912 345 678"
                value={info.phone}
                autoComplete="tel"
                aria-invalid={formError ? true : undefined}
                onChange={(event) => update({ info: { ...info, phone: event.target.value } })}
              />
            </label>
            {formError ? (
              <p className="pt-form__error" role="alert">
                {formError}
              </p>
            ) : null}
            <button type="submit" className="pt-btn pt-btn--primary pt-btn--block">
              Làm bài {test.title}
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
            <p className="pt-form__privacy">
              {test.durationMinutes} phút, {allQuestions.length} câu. Lỡ tải lại trang, bài làm vẫn được giữ.
            </p>
          </form>
        </section>
      </div>
    );
  }

  // ─── Kết quả ────────────────────────────────────────────────────────────────
  if (phase === 'result' && result) {
    const suggestion = getSuggestion(level, result.passed);
    const partResults = test.parts.map((item) => {
      const questions = allQuestions.filter((question) => question.part.id === item.id);
      const correct = questions.filter((question) => answers[answerKey(question)] === question.answer).length;
      return { id: item.id, title: item.title, correct, total: questions.length };
    });

    return (
      <div className="pt-result">
        <section className="pt-result__head pt-3d pt-rise" style={{ '--d': 0 }}>
          <div className="pt-result__band">
            <p className="pt-kicker">Điểm {test.title}</p>
            <strong aria-live="polite">{result.score}</strong>
            <span>
              {result.passed ? 'Đạt' : 'Chưa đạt'} · cần {HSK_PASS_SCORE}/100
            </span>
          </div>

          <div className="pt-result__main">
            <p className="pt-kicker">Kết quả test trình độ</p>
            <h1 className="pt-result__title">
              {info.fullName ? `${info.fullName}, bạn đã hoàn thành ${test.title}` : `Bạn đã hoàn thành ${test.title}`}
            </h1>

            <table className="pt-scores">
              <thead>
                <tr>
                  <th scope="col">Phần</th>
                  <th scope="col">Kết quả</th>
                  <th scope="col">Đúng</th>
                </tr>
              </thead>
              <tbody>
                {partResults.map((item, index) => (
                  <tr key={item.id}>
                    <th scope="row">{item.title}</th>
                    <td>
                      <div className="pt-scores__bar">
                        <span className="pt-scores__value">
                          {item.correct}/{item.total}
                        </span>
                        <span className="pt-meter" aria-hidden="true">
                          <span style={{ width: `${(item.correct / item.total) * 100}%`, '--d': index }} />
                        </span>
                      </div>
                    </td>
                    <td className="pt-scores__band">{Math.round((item.correct / item.total) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pt-advice pt-3d">
              <p className="pt-kicker">Gợi ý lộ trình</p>
              <strong>{suggestion.course}</strong>
              <p>{suggestion.text}</p>
            </div>

            {leadStatus === 'sent' || result.leadSent ? (
              <p className="pt-status pt-status--ok" role="status">
                Trung tâm đã nhận kết quả — giảng viên sẽ liên hệ qua số {info.phone} để tư vấn lộ trình.
              </p>
            ) : leadStatus === 'failed' ? (
              <p className="pt-status pt-status--error" role="alert">
                Chưa gửi được kết quả cho trung tâm. Bấm “Nhận tư vấn lộ trình” để để lại thông tin nhé.
              </p>
            ) : null}

            <div className="pt-actions">
              <button
                type="button"
                className="pt-btn pt-btn--primary"
                onClick={() => window.dispatchEvent(new Event(OPEN_CONSULTATION_EVENT))}
              >
                Nhận tư vấn lộ trình
              </button>
              {result.passed && level < 5 ? (
                <Link className="pt-btn pt-btn--outline" to={`/test/hsk/${level + 1}`}>
                  Làm test HSK {level + 1}
                </Link>
              ) : (
                <Link className="pt-btn pt-btn--outline" to="/courses">
                  Xem khoá học
                </Link>
              )}
              <button type="button" className="pt-btn pt-btn--text" onClick={() => setRestartOpen(true)}>
                Làm lại bài test
              </button>
            </div>
          </div>
        </section>

        <section className="pt-review pt-rise" style={{ '--d': 1 }}>
          <h2 className="pt-section-title">Đáp án chi tiết</h2>
          <div className="pt-review__skill">
            {test.parts.map((reviewPart) => (
              <div key={reviewPart.id} className="pt-review__part">
                <h4>
                  {reviewPart.title} <span>câu {reviewPart.range}</span>
                </h4>
                <div className="pt-review__grid">
                  {allQuestions
                    .filter((question) => question.part.id === reviewPart.id)
                    .map((question) => {
                      const answer = answers[answerKey(question)];
                      const correct = answer === question.answer;
                      const choices = hskChoices(question.group, question);
                      const label = (code) => {
                        const choice = choices.find((item) => item.code === code);
                        return choice ? `${choice.code}. ${choice.text}` : 'Bỏ trống';
                      };
                      return (
                        <div key={question.n} className={`pt-review__cell ${correct ? 'is-correct' : 'is-wrong'}`}>
                          <span className="pt-review__num">{question.n}</span>
                          <div className="pt-review__text">
                            <span className="pt-review__answer">
                              <span className="pt-review__mark" aria-label={correct ? 'Đúng' : 'Sai'}>
                                {correct ? '✓' : '✗'}
                              </span>{' '}
                              {label(answer)}
                            </span>
                            {!correct ? <span className="pt-review__key">Đáp án: {label(question.answer)}</span> : null}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {restartOpen ? (
          <ExamDialog
            title="Làm lại bài test?"
            cancelLabel="Ở lại"
            confirmLabel="Làm lại"
            onCancel={() => setRestartOpen(false)}
            onConfirm={restart}
          >
            <p>Kết quả hiện tại sẽ bị xoá khỏi thiết bị này.</p>
          </ExamDialog>
        ) : null}
      </div>
    );
  }

  // ─── Phòng thi ──────────────────────────────────────────────────────────────
  const answeredCount = allQuestions.filter((question) => answers[answerKey(question)]).length;
  const lowTime = remainingSeconds <= 180;
  const isLastPart = partIndex >= test.parts.length - 1;

  return (
    <div className="ptest-room">
      <header className="ptest-bar">
        <div className="ptest-bar__title">
          <strong>{test.title}</strong>
          <span>
            {answeredCount}/{allQuestions.length} câu đã làm
          </span>
        </div>
        <div className={`ptest-bar__timer ${lowTime ? 'is-low' : ''}`} role="timer" aria-label="Thời gian còn lại">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2.5 2.5M9 2h6" />
          </svg>
          {formatClock(remainingSeconds)}
        </div>
        <button type="button" className="button ptest-bar__submit" onClick={() => setConfirmOpen(true)}>
          Nộp bài
        </button>
      </header>

      <nav className="ptest-tabs" aria-label="Chọn phần">
        {test.parts.map((item, index) => {
          const questions = allQuestions.filter((question) => question.part.id === item.id);
          const done = questions.filter((question) => answers[answerKey(question)]).length;
          return (
            <button
              key={item.id}
              type="button"
              className={`ptest-tab ${index === partIndex ? 'is-active' : ''}`}
              aria-current={index === partIndex ? 'step' : undefined}
              onClick={() => goToPart(index)}
            >
              <strong>{item.title}</strong>
              <span>
                {done}/{questions.length}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="ptest-body">
        <div className="ptest-body__questions">
          {part.groups.map((group) => (
            <HskGroup key={group.title} group={group} answers={answers} setAnswer={setAnswer} />
          ))}
          {isLastPart ? (
            <button type="button" className="button ptest-next" onClick={() => setConfirmOpen(true)}>
              Nộp bài
            </button>
          ) : (
            <button type="button" className="button-ghost ptest-next" onClick={() => goToPart(partIndex + 1)}>
              Sang {test.parts[partIndex + 1].title} →
            </button>
          )}
        </div>
      </div>

      <footer className="ptest-nav" aria-label="Danh sách câu hỏi">
        {test.parts.map((item, index) => {
          const questions = allQuestions.filter((question) => question.part.id === item.id);
          const done = questions.filter((question) => answers[answerKey(question)]).length;
          if (index !== partIndex) {
            return (
              <button key={item.id} type="button" className="ptest-nav__chip" onClick={() => goToPart(index)}>
                {item.title} <span>{done}/{questions.length}</span>
              </button>
            );
          }
          return (
            <div key={item.id} className="ptest-nav__part is-active">
              <span className="ptest-nav__label">{item.title}</span>
              <div className="ptest-nav__nums">
                {questions.map((question) => {
                  const key = answerKey(question);
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`ptest-nav__num ${answers[key] ? 'is-answered' : ''}`}
                      aria-label={`Câu ${question.n}${answers[key] ? ' (đã làm)' : ''}`}
                      onClick={() => jumpToQuestion(index, key)}
                    >
                      {question.n}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </footer>

      {confirmOpen ? (
        <ExamDialog
          title={`Nộp bài ${test.title}?`}
          cancelLabel="Làm tiếp"
          confirmLabel="Nộp bài"
          onCancel={() => setConfirmOpen(false)}
          onConfirm={finish}
        >
          <p>
            Bạn đã làm {answeredCount}/{allQuestions.length} câu.
            {answeredCount < allQuestions.length ? ' Câu bỏ trống sẽ không được tính điểm.' : ''}
          </p>
        </ExamDialog>
      ) : null}
    </div>
  );
}
