import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { getEffectiveRole } from '../lib/permissions';
import { getCourseCatalog, getOwnedCourseIds } from '../lib/courseService';
import {
  getExamById,
  getExamAttemptsForStudent,
  getExamDurationMinutes,
  getExamQuestionCount,
  getQuestionTypeLabel,
  getSectionTypeLabel,
  saveExamAttempt,
  scoreExamAnswers,
  scoreExamQuestion
} from '../lib/examService';
import { usePageTitle } from '../hooks/usePageTitle';

const TICK_MS = 500;

function formatClock(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function isQuestionAnswered(question, answer) {
  if (question.type === 'matching') {
    return question.pairs.every((_, index) => Boolean(answer?.[index] ?? answer?.[String(index)]));
  }

  return String(answer ?? '').trim() !== '';
}

// Deterministic shuffle so the right-hand options of a matching question keep a
// stable (but non-original) order across re-renders without extra state.
function stableShuffle(values, seed) {
  function hash(text) {
    let value = 0;
    for (let i = 0; i < text.length; i++) {
      value = (value * 31 + text.charCodeAt(i)) >>> 0;
    }
    return value;
  }

  return [...values].sort((left, right) => hash(`${seed}:${left}`) - hash(`${seed}:${right}`));
}

// ─── Question renderers ───────────────────────────────────────────────────────

function MultipleChoiceQuestion({ question, answer, onChange, disabled }) {
  return (
    <div className="exam-question__options">
      {question.options.map((option) => (
        <button
          key={option}
          type="button"
          className={`exam-option ${String(answer ?? '') === option ? 'is-selected' : ''}`}
          onClick={() => onChange(option)}
          disabled={disabled}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function TrueFalseQuestion({ answer, onChange, disabled }) {
  return (
    <div className="exam-question__options exam-question__options--row">
      {[
        { value: 'true', label: 'Đúng' },
        { value: 'false', label: 'Sai' }
      ].map((choice) => (
        <button
          key={choice.value}
          type="button"
          className={`exam-option exam-option--pill ${String(answer ?? '') === choice.value ? 'is-selected' : ''}`}
          onClick={() => onChange(choice.value)}
          disabled={disabled}
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}

function FillBlankQuestion({ answer, onChange, disabled }) {
  return (
    <input
      className="exam-fill-input"
      type="text"
      value={String(answer ?? '')}
      placeholder="Gõ đáp án của bạn..."
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
    />
  );
}

function MatchingQuestion({ question, answer, onChange, disabled }) {
  const rightOptions = useMemo(
    () => stableShuffle(question.pairs.map((pair) => pair.right), question.id),
    [question]
  );

  function setPairAnswer(index, value) {
    onChange({ ...(answer || {}), [index]: value });
  }

  return (
    <div className="exam-matching">
      {question.pairs.map((pair, index) => (
        <div key={`${pair.left}-${index}`} className="exam-matching__row">
          <span className="exam-matching__left">{pair.left}</span>
          <select
            value={String(answer?.[index] ?? answer?.[String(index)] ?? '')}
            onChange={(event) => setPairAnswer(index, event.target.value)}
            disabled={disabled}
          >
            <option value="">-- Chọn --</option>
            {rightOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

function ExamQuestion({ question, index, answer, onChange, disabled }) {
  return (
    <article id={`exam-question-${question.id}`} className="exam-question">
      <header className="exam-question__head">
        <span className="exam-question__number">Câu {index + 1}</span>
        <span className="exam-question__type">{getQuestionTypeLabel(question.type)}</span>
      </header>
      <p className="exam-question__prompt">{question.prompt}</p>

      {question.type === 'multiple_choice' ? (
        <MultipleChoiceQuestion question={question} answer={answer} onChange={onChange} disabled={disabled} />
      ) : question.type === 'true_false' ? (
        <TrueFalseQuestion answer={answer} onChange={onChange} disabled={disabled} />
      ) : question.type === 'fill_blank' ? (
        <FillBlankQuestion answer={answer} onChange={onChange} disabled={disabled} />
      ) : (
        <MatchingQuestion question={question} answer={answer} onChange={onChange} disabled={disabled} />
      )}
    </article>
  );
}

// ─── Result review ────────────────────────────────────────────────────────────

function formatAnswerForReview(question, answer) {
  if (question.type === 'matching') {
    if (!answer) {
      return '(chưa trả lời)';
    }
    return question.pairs
      .map((pair, index) => `${pair.left} → ${answer[index] ?? answer[String(index)] ?? '?'}`)
      .join(' · ');
  }

  if (question.type === 'true_false') {
    if (String(answer ?? '') === '') return '(chưa trả lời)';
    return String(answer) === 'true' ? 'Đúng' : 'Sai';
  }

  return String(answer ?? '').trim() || '(chưa trả lời)';
}

function formatCorrectAnswer(question) {
  if (question.type === 'matching') {
    return question.pairs.map((pair) => `${pair.left} → ${pair.right}`).join(' · ');
  }

  if (question.type === 'true_false') {
    return question.correctAnswer === 'true' ? 'Đúng' : 'Sai';
  }

  if (question.type === 'fill_blank') {
    return (question.acceptedAnswers.length ? question.acceptedAnswers : [question.correctAnswer]).join(' / ');
  }

  return question.correctAnswer;
}

function ExamResult({ exam, attempt }) {
  const percent = attempt.maxScore ? Math.round((attempt.score / attempt.maxScore) * 100) : 0;

  return (
    <div className="exam-result">
      <section className="exam-result__summary">
        <span className="eyebrow">Kết quả bài thi</span>
        <h1>{exam.title}</h1>
        <div className="exam-result__score">
          <strong>
            {attempt.score}/{attempt.maxScore}
          </strong>
          <span>{percent}% chính xác</span>
          {attempt.status === 'auto_submitted' ? (
            <span className="exam-result__flag">Nộp tự động khi hết giờ</span>
          ) : null}
        </div>

        <div className="exam-result__sections">
          {attempt.sectionScores.map((section) => (
            <article key={section.sectionId} className="exam-result__section-card">
              <span>{section.title || getSectionTypeLabel(section.type)}</span>
              <strong>
                {section.score}/{section.maxScore}
              </strong>
            </article>
          ))}
        </div>

        <div className="exam-result__actions">
          <Link className="button" to="/exams">
            Về danh sách đề thi
          </Link>
        </div>
      </section>

      <section className="exam-result__review">
        <h2>Xem lại bài làm</h2>
        {exam.sections.map((section) => (
          <div key={section.id} className="exam-result__review-section">
            <h3>{section.title}</h3>
            {section.questions.map((question, index) => {
              const answer = attempt.answers[question.id];
              const { score, maxScore } = scoreExamQuestion(question, answer);
              const isCorrect = score === maxScore;

              return (
                <article
                  key={question.id}
                  className={`exam-review-item ${isCorrect ? 'is-correct' : 'is-incorrect'}`}
                >
                  <header>
                    <span>Câu {index + 1}</span>
                    <strong>
                      {score}/{maxScore}
                    </strong>
                  </header>
                  <p className="exam-review-item__prompt">{question.prompt}</p>
                  <p>
                    <span className="exam-review-item__label">Bạn trả lời:</span>{' '}
                    {formatAnswerForReview(question, answer)}
                  </p>
                  {!isCorrect ? (
                    <p>
                      <span className="exam-review-item__label">Đáp án đúng:</span>{' '}
                      {formatCorrectAnswer(question)}
                    </p>
                  ) : null}
                  {question.explanation ? (
                    <p className="exam-review-item__explanation">{question.explanation}</p>
                  ) : null}
                </article>
              );
            })}
          </div>
        ))}
      </section>
    </div>
  );
}

// ─── Exam room page ───────────────────────────────────────────────────────────

export default function ExamRoomPage() {
  usePageTitle('Phòng thi');
  const { examId } = useParams();
  const auth = useAuth();
  const role = getEffectiveRole(auth);

  const [exam, setExam] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading | blocked | lobby | room | saving | result
  const [blockedMessage, setBlockedMessage] = useState('');
  const [attempt, setAttempt] = useState(null);

  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [deadline, setDeadline] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const autoSubmittedRef = useRef(false);
  const sectionTimesRef = useRef({});
  const sectionStartedAtRef = useRef(null);
  const startedAtRef = useRef('');
  const finishingRef = useRef(false);

  const studentId = auth.user?.id || '';
  const studentEmail = auth.user?.email || '';

  // Load exam + previous attempt.
  useEffect(() => {
    if (!auth.ready) {
      return undefined;
    }

    let alive = true;

    async function load() {
      const loadedExam = await getExamById(examId);

      if (!alive) return;

      if (!loadedExam) {
        setPhase('blocked');
        setBlockedMessage('Không tìm thấy đề thi hoặc bạn không có quyền truy cập.');
        return;
      }

      const isOwnerTeacher = role !== 'student' && loadedExam.teacherId === studentId;
      const isAdmin = role === 'admin';

      if (loadedExam.status !== 'published' && !isOwnerTeacher && !isAdmin) {
        setPhase('blocked');
        setBlockedMessage('Đề thi này chưa được mở.');
        return;
      }

      if (role === 'student') {
        // Catalog để map uuid ↔ slug, khớp course_key của đề với orders đã mua.
        const ownedCourseIds = await getOwnedCourseIds(studentId, await getCourseCatalog());
        const normalizedEmail = studentEmail.toLowerCase();
        const assigned =
          loadedExam.assignmentScope === 'course_buyers'
            ? ownedCourseIds.map((id) => String(id).toLowerCase()).includes(String(loadedExam.courseKey).toLowerCase())
            : loadedExam.recipients.some((recipient) => recipient.studentEmail.toLowerCase() === normalizedEmail);

        if (!assigned && !alive) return;
        if (!assigned) {
          setPhase('blocked');
          setBlockedMessage('Bạn chưa được giao đề thi này. Hãy liên hệ giảng viên của bạn.');
          return;
        }
      }

      const previousAttempts = await getExamAttemptsForStudent(studentId, studentEmail);
      if (!alive) return;

      const previous = previousAttempts.find((item) => item.examId === loadedExam.id);

      setExam(loadedExam);

      if (previous && previous.status !== 'in_progress') {
        setAttempt(previous);
        setPhase('result');
      } else {
        setPhase('lobby');
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, [auth.ready, examId, role, studentId, studentEmail]);

  const currentSection = exam?.sections[sectionIndex] || null;
  const remainingSeconds = deadline ? Math.ceil((deadline - now) / 1000) : 0;

  // Countdown tick — anchored to an absolute deadline so tab sleep can't stretch time.
  useEffect(() => {
    if (phase !== 'room' || !deadline) {
      return undefined;
    }

    const intervalId = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(intervalId);
  }, [phase, deadline]);

  // Warn before leaving mid-exam.
  useEffect(() => {
    if (phase !== 'room') {
      return undefined;
    }

    function onBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [phase]);

  function startExam() {
    startedAtRef.current = new Date().toISOString();
    sectionStartedAtRef.current = Date.now();
    autoSubmittedRef.current = false;
    setSectionIndex(0);
    setAnswers({});
    setDeadline(Date.now() + exam.sections[0].durationMinutes * 60_000);
    setNow(Date.now());
    setPhase('room');
  }

  async function finishExam(finalAnswers, wasAutoSubmitted) {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setPhase('saving');

    const result = scoreExamAnswers(exam.sections, finalAnswers);
    const sectionScores = result.sectionScores.map((section) => ({
      ...section,
      timeSpentSeconds: sectionTimesRef.current[section.sectionId] || 0
    }));

    const savedAttempt = await saveExamAttempt({
      examId: exam.id,
      studentId,
      studentEmail,
      answers: finalAnswers,
      sectionScores,
      score: result.score,
      maxScore: result.maxScore,
      status: wasAutoSubmitted ? 'auto_submitted' : 'submitted',
      startedAt: startedAtRef.current
    });

    setAttempt(savedAttempt);
    setPhase('result');
    finishingRef.current = false;
  }

  function endCurrentSection(wasAutoSubmitted) {
    if (!currentSection) return;

    sectionTimesRef.current[currentSection.id] = Math.round(
      (Date.now() - (sectionStartedAtRef.current || Date.now())) / 1000
    );

    if (wasAutoSubmitted) {
      autoSubmittedRef.current = true;
    }

    setConfirmOpen(false);

    const isLastSection = sectionIndex >= exam.sections.length - 1;

    if (isLastSection) {
      setDeadline(null);
      void finishExam(answers, autoSubmittedRef.current);
      return;
    }

    const nextIndex = sectionIndex + 1;
    sectionStartedAtRef.current = Date.now();
    setSectionIndex(nextIndex);
    setDeadline(Date.now() + exam.sections[nextIndex].durationMinutes * 60_000);
    setNow(Date.now());
  }

  // Auto-submit when the section clock hits zero.
  useEffect(() => {
    if (phase === 'room' && deadline && remainingSeconds <= 0) {
      endCurrentSection(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, deadline, remainingSeconds]);

  function setQuestionAnswer(questionId, value) {
    setAnswers((previous) => ({ ...previous, [questionId]: value }));
  }

  function jumpToQuestion(questionId) {
    document.getElementById(`exam-question-${questionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ─── Render phases ───────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="page centered exam-room-page">
        <p>Đang chuẩn bị phòng thi...</p>
      </div>
    );
  }

  if (phase === 'blocked') {
    return (
      <div className="page centered exam-room-page">
        <div className="exam-lobby__card">
          <h1>Không thể vào phòng thi</h1>
          <p>{blockedMessage}</p>
          <Link className="button" to="/exams">
            Về danh sách đề thi
          </Link>
        </div>
      </div>
    );
  }

  if (phase === 'result' && attempt) {
    return (
      <div className="page exam-room-page">
        <ExamResult exam={exam} attempt={attempt} />
      </div>
    );
  }

  if (phase === 'lobby') {
    return (
      <div className="page centered exam-room-page">
        <div className="exam-lobby__card">
          <span className="eyebrow">Phòng thi mô phỏng</span>
          <h1>{exam.title}</h1>
          {exam.description ? <p>{exam.description}</p> : null}

          <div className="exam-lobby__facts">
            <span>{exam.sections.length} phần thi</span>
            <span>{getExamQuestionCount(exam)} câu hỏi</span>
            <span>{getExamDurationMinutes(exam)} phút</span>
          </div>

          <ol className="exam-lobby__sections">
            {exam.sections.map((section) => (
              <li key={section.id}>
                <strong>{section.title}</strong>
                <span>
                  {getSectionTypeLabel(section.type)} · {section.durationMinutes} phút · {section.questions.length} câu
                </span>
              </li>
            ))}
          </ol>

          <ul className="exam-lobby__rules">
            <li>Mỗi phần thi có đồng hồ riêng, hết giờ hệ thống tự nộp và chuyển phần tiếp theo.</li>
            <li>Không thể quay lại phần thi đã nộp.</li>
            <li>Không tải lại trang trong khi làm bài — bài làm sẽ bị mất.</li>
          </ul>

          <button type="button" className="button exam-lobby__start" onClick={startExam}>
            Bắt đầu làm bài
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'saving') {
    return (
      <div className="page centered exam-room-page">
        <p>Đang chấm và lưu bài thi...</p>
      </div>
    );
  }

  // phase === 'room'
  const isLastSection = sectionIndex >= exam.sections.length - 1;
  const lowTime = remainingSeconds <= 300;

  return (
    <div className="exam-room">
      <header className="exam-room__header">
        <div className="exam-room__title">
          <strong>{exam.title}</strong>
          <span>
            Phần {sectionIndex + 1}/{exam.sections.length}: {currentSection.title}
          </span>
        </div>

        <div className={`exam-room__timer ${lowTime ? 'is-low' : ''}`} aria-live="polite">
          {formatClock(remainingSeconds)}
        </div>

        <button type="button" className="button exam-room__submit" onClick={() => setConfirmOpen(true)}>
          {isLastSection ? 'Nộp bài' : 'Nộp phần này'}
        </button>
      </header>

      <div className="exam-room__body">
        <main className="exam-room__main">
          {currentSection.type === 'listening' && currentSection.audioUrl ? (
            <div className="exam-room__audio">
              <span>File nghe — bạn có thể tua và nghe lại trong thời gian của phần thi.</span>
              <audio controls src={currentSection.audioUrl} preload="auto" />
            </div>
          ) : null}

          {currentSection.type === 'reading' && currentSection.passage ? (
            <div className="exam-room__split">
              <div className="exam-room__passage">
                <h2>Bài đọc</h2>
                {currentSection.passage.split(/\n{2,}/).map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
              <div className="exam-room__questions">
                {currentSection.questions.map((question, index) => (
                  <ExamQuestion
                    key={question.id}
                    question={question}
                    index={index}
                    answer={answers[question.id]}
                    onChange={(value) => setQuestionAnswer(question.id, value)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="exam-room__questions">
              {currentSection.questions.map((question, index) => (
                <ExamQuestion
                  key={question.id}
                  question={question}
                  index={index}
                  answer={answers[question.id]}
                  onChange={(value) => setQuestionAnswer(question.id, value)}
                />
              ))}
            </div>
          )}
        </main>

        <aside className="exam-room__palette">
          <h3>Câu hỏi</h3>
          <div className="exam-room__palette-grid">
            {currentSection.questions.map((question, index) => (
              <button
                key={question.id}
                type="button"
                className={`exam-palette-btn ${isQuestionAnswered(question, answers[question.id]) ? 'is-answered' : ''}`}
                onClick={() => jumpToQuestion(question.id)}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <p className="exam-room__palette-hint">
            {currentSection.questions.filter((question) => isQuestionAnswered(question, answers[question.id])).length}/
            {currentSection.questions.length} câu đã trả lời
          </p>
        </aside>
      </div>

      {confirmOpen ? (
        <div className="exam-confirm" role="dialog" aria-modal="true" aria-label="Xác nhận nộp bài">
          <div className="exam-confirm__card">
            <h2>{isLastSection ? 'Nộp bài thi?' : `Nộp phần "${currentSection.title}"?`}</h2>
            <p>
              {currentSection.questions.filter((question) => isQuestionAnswered(question, answers[question.id])).length}/
              {currentSection.questions.length} câu đã trả lời.{' '}
              {isLastSection
                ? 'Sau khi nộp, bài thi sẽ được chấm ngay.'
                : 'Bạn sẽ không thể quay lại phần này sau khi nộp.'}
            </p>
            <div className="exam-confirm__actions">
              <button type="button" className="button-ghost" onClick={() => setConfirmOpen(false)}>
                Tiếp tục làm bài
              </button>
              <button type="button" className="button" onClick={() => endCurrentSection(false)}>
                Xác nhận nộp
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
