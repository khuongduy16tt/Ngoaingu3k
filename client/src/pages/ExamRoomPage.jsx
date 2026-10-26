import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { ListeningAudio } from '../components/ListeningAudio';
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
import { scrollIntoViewRespectingMotion } from '../lib/scrollMotion';
import { toFriendlyError } from '../lib/friendlyError';

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

      {/* Ảnh đề thi luôn tải ngay (không lazy) để học viên không gặp ô trống giữa giờ làm bài. */}
      {question.imageUrl ? (
        <img
          className="exam-question__image"
          src={question.imageUrl}
          alt={question.imageName || `Ảnh minh họa câu ${index + 1}`}
        />
      ) : null}

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
                  {question.imageUrl ? (
                    <img
                      className="exam-question__image"
                      src={question.imageUrl}
                      alt={question.imageName || `Ảnh minh họa câu ${index + 1}`}
                    />
                  ) : null}
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

// ─── Lưu tạm bài làm trên máy ───────────────────────────────────────────────
// Lỡ tải lại trang, tắt tab hay điện thoại tự đóng trình duyệt thì vào lại đề
// vẫn làm tiếp được. Hạn giờ lưu dạng mốc tuyệt đối nên đồng hồ không "đứng"
// trong lúc rời đi.
const EXAM_SESSION_PREFIX = 'ngoaingu3k-exam-session';

function getExamSessionKey(examId, userKey) {
  return `${EXAM_SESSION_PREFIX}:${userKey || 'guest'}:${examId}`;
}

function readExamSession(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeExamSession(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Bộ nhớ bị chặn/đầy: vẫn thi được, chỉ là không khôi phục được khi tải lại.
  }
}

function clearExamSession(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// Hộp thoại dùng chung của phòng thi: Esc để đóng, con trỏ vào nút an toàn,
// Tab không thoát ra ngoài, đóng xong trả con trỏ về chỗ cũ.
function ExamDialog({ title, children, cancelLabel, confirmLabel, onCancel, onConfirm }) {
  const titleId = useId();
  const cardRef = useRef(null);
  const cancelRef = useRef(null);
  // Phòng thi render lại mỗi nửa giây (đồng hồ) — giữ hàm đóng trong ref để
  // effect không chạy lại và giật con trỏ về nút đầu.
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    const returnFocusTo = document.activeElement;
    cancelRef.current?.focus();

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancelRef.current?.();
        return;
      }
      if (event.key !== 'Tab' || !cardRef.current) return;
      const focusables = [...cardRef.current.querySelectorAll('button:not([disabled])')];
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!cardRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (returnFocusTo && returnFocusTo.isConnected) {
        returnFocusTo.focus?.({ preventScroll: true });
      }
    };
  }, []);

  return (
    <div className="exam-confirm" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="exam-confirm__card" ref={cardRef}>
        <h2 id={titleId}>{title}</h2>
        {children}
        <div className="exam-confirm__actions">
          <button ref={cancelRef} type="button" className="button-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Exam room page ───────────────────────────────────────────────────────────

export default function ExamRoomPage() {
  usePageTitle('Phòng thi');
  const { examId } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const role = getEffectiveRole(auth);
  // Giảng viên/admin vào đề là để xem trước: làm thử được nhưng không lưu
  // thành lượt thi, không làm bẩn bảng kết quả.
  const isPreview = role !== 'student';

  const [exam, setExam] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading | blocked | lobby | room | break | saving | result
  const [blockedMessage, setBlockedMessage] = useState('');
  const [canRetryLoad, setCanRetryLoad] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [attempt, setAttempt] = useState(null);

  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [deadline, setDeadline] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [saveError, setSaveError] = useState('');
  const autoSubmittedRef = useRef(false);
  const sectionTimesRef = useRef({});
  const sectionStartedAtRef = useRef(null);
  const startedAtRef = useRef('');
  const finishingRef = useRef(false);
  // Bài làm của lần nộp đang chờ lưu — giữ lại để bấm "Thử lưu lại" không phải
  // làm lại đề từ đầu khi lần lưu trước hỏng.
  const pendingSubmissionRef = useRef(null);

  const studentId = auth.user?.id || '';
  const studentEmail = auth.user?.email || '';
  const sessionKey = getExamSessionKey(examId, studentId || studentEmail);

  // Load exam + previous attempt.
  useEffect(() => {
    if (!auth.ready) {
      return undefined;
    }

    let alive = true;

    function restoreSession(saved) {
      startedAtRef.current = saved.startedAt || new Date().toISOString();
      sectionTimesRef.current = saved.sectionTimes || {};
      sectionStartedAtRef.current = saved.sectionStartedAt || Date.now();
      autoSubmittedRef.current = Boolean(saved.autoSubmitted);
      setSectionIndex(saved.sectionIndex);
      setAnswers(saved.answers || {});
      setDeadline(saved.phase === 'room' ? saved.deadline : null);
      setNow(Date.now());
      setResumed(true);
      setPhase(saved.phase === 'break' ? 'break' : 'room');
    }

    async function load() {
      setPhase('loading');
      setCanRetryLoad(false);

      try {
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

          if (!alive) return;
          if (!assigned) {
            setPhase('blocked');
            setBlockedMessage('Bạn chưa được giao đề thi này. Hãy liên hệ giảng viên của bạn.');
            return;
          }
        }

        const previousAttempts = isPreview ? [] : await getExamAttemptsForStudent(studentId, studentEmail);
        if (!alive) return;

        const previous = previousAttempts.find((item) => item.examId === loadedExam.id);

        setExam(loadedExam);

        if (previous && previous.status !== 'in_progress') {
          clearExamSession(sessionKey);
          setAttempt(previous);
          setPhase('result');
          return;
        }

        const saved = readExamSession(sessionKey);
        const savedIsUsable =
          saved &&
          saved.examId === loadedExam.id &&
          Number.isInteger(saved.sectionIndex) &&
          saved.sectionIndex >= 0 &&
          saved.sectionIndex < loadedExam.sections.length &&
          (saved.phase === 'break' || (saved.phase === 'room' && Number(saved.deadline) > 0));

        if (savedIsUsable) {
          restoreSession(saved);
        } else {
          if (saved) clearExamSession(sessionKey);
          setPhase('lobby');
        }
      } catch (error) {
        // Không bắt lỗi ở đây thì trang đứng mãi ở "Đang chuẩn bị phòng thi...".
        console.warn('[ExamRoomPage load]', error?.message || error);
        if (alive) {
          setPhase('blocked');
          setBlockedMessage('Chưa tải được đề thi. Kiểm tra kết nối mạng rồi thử lại.');
          setCanRetryLoad(true);
        }
      }
    }

    void load();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.ready, examId, role, studentId, studentEmail, reloadKey]);

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

  // Ghi bài làm xuống máy mỗi khi có thay đổi trong lúc thi.
  useEffect(() => {
    if (!exam || (phase !== 'room' && phase !== 'break')) {
      return;
    }

    writeExamSession(sessionKey, {
      examId: exam.id,
      phase,
      sectionIndex,
      answers,
      deadline,
      startedAt: startedAtRef.current,
      sectionTimes: sectionTimesRef.current,
      sectionStartedAt: sectionStartedAtRef.current,
      autoSubmitted: autoSubmittedRef.current,
      savedAt: Date.now()
    });
  }, [exam, phase, sectionIndex, answers, deadline, sessionKey]);

  // Vẫn nhắc trước khi đóng tab giữa giờ thi (bài làm được giữ nhưng đồng hồ
  // vẫn chạy) — và cả khi bài đã nộp nhưng lưu hỏng.
  useEffect(() => {
    if (phase !== 'room' && !saveError) {
      return undefined;
    }

    function onBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [phase, saveError]);

  function startExam() {
    startedAtRef.current = new Date().toISOString();
    sectionStartedAtRef.current = Date.now();
    sectionTimesRef.current = {};
    autoSubmittedRef.current = false;
    setResumed(false);
    setSectionIndex(0);
    setAnswers({});
    setDeadline(Date.now() + exam.sections[0].durationMinutes * 60_000);
    setNow(Date.now());
    setPhase('room');
  }

  function startNextSection() {
    sectionStartedAtRef.current = Date.now();
    setResumed(false);
    setDeadline(Date.now() + exam.sections[sectionIndex].durationMinutes * 60_000);
    setNow(Date.now());
    setPhase('room');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  async function finishExam(finalAnswers, wasAutoSubmitted) {
    if (finishingRef.current) return;
    finishingRef.current = true;
    pendingSubmissionRef.current = { finalAnswers, wasAutoSubmitted };
    setSaveError('');
    setPhase('saving');

    try {
      // Chấm điểm cũng phải nằm trong try: đề hỏng cấu trúc thì scoreExamAnswers
      // ném lỗi ngay tại đây, và bên ngoài try thì vẫn kẹt màn "đang lưu".
      const result = scoreExamAnswers(exam.sections, finalAnswers);
      const sectionScores = result.sectionScores.map((section) => ({
        ...section,
        timeSpentSeconds: sectionTimesRef.current[section.sectionId] || 0
      }));
      const status = wasAutoSubmitted ? 'auto_submitted' : 'submitted';

      const savedAttempt = isPreview
        ? {
            examId: exam.id,
            answers: finalAnswers,
            sectionScores,
            score: result.score,
            maxScore: result.maxScore,
            status
          }
        : await saveExamAttempt({
            examId: exam.id,
            studentId,
            studentEmail,
            answers: finalAnswers,
            sectionScores,
            score: result.score,
            maxScore: result.maxScore,
            status,
            startedAt: startedAtRef.current
          });

      pendingSubmissionRef.current = null;
      clearExamSession(sessionKey);
      setAttempt(savedAttempt);
      setPhase('result');
    } catch (error) {
      // Không bắt lỗi ở đây thì màn "đang lưu" quay mãi và finishingRef kẹt ở
      // true — thí sinh vừa thi xong mất trắng bài, không có cách nào nộp lại.
      console.warn('[finishExam]', error?.message || error);
      setSaveError(toFriendlyError(error, 'Chưa lưu được bài thi. Vui lòng kiểm tra kết nối mạng rồi thử lại.'));
    } finally {
      finishingRef.current = false;
    }
  }

  function retrySaveExam() {
    const pending = pendingSubmissionRef.current;
    if (!pending) return;

    void finishExam(pending.finalAnswers, pending.wasAutoSubmitted);
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
    setExitOpen(false);
    setDeadline(null);

    const isLastSection = sectionIndex >= exam.sections.length - 1;

    if (isLastSection) {
      void finishExam(answers, autoSubmittedRef.current);
      return;
    }

    // Nghỉ giữa hai phần: đồng hồ phần sau chỉ chạy khi thí sinh bấm bắt đầu,
    // không bị ném thẳng vào phần mới (nhất là phần nghe) khi chưa sẵn sàng.
    setSectionIndex(sectionIndex + 1);
    setPhase('break');
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
    scrollIntoViewRespectingMotion(document.getElementById(`exam-question-${questionId}`), { block: 'center' });
  }

  function leaveRoom() {
    setExitOpen(false);
    navigate('/exams');
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
          <p role={canRetryLoad ? 'alert' : undefined}>{blockedMessage}</p>
          <div className="exam-confirm__actions">
            {canRetryLoad ? (
              <button type="button" className="button" onClick={() => setReloadKey((value) => value + 1)}>
                Thử lại
              </button>
            ) : null}
            <Link className={canRetryLoad ? 'button-ghost' : 'button'} to="/exams">
              Về danh sách đề thi
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'result' && attempt) {
    return (
      <div className="page exam-room-page">
        {isPreview ? (
          <p className="auth-message" role="status">
            Đây là bản xem trước của giảng viên — kết quả không được lưu và không hiện trong bảng kết quả.
          </p>
        ) : null}
        <ExamResult exam={exam} attempt={attempt} />
      </div>
    );
  }

  if (phase === 'lobby') {
    return (
      <div className="page centered exam-room-page">
        <div className="exam-lobby__card">
          <span className="eyebrow">{isPreview ? 'Xem trước đề thi' : 'Phòng thi mô phỏng'}</span>
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
            {isPreview ? (
              <li>Bạn đang xem trước với vai trò giảng viên: làm thử được, nhưng bài làm không được lưu thành lượt thi.</li>
            ) : null}
            <li>Mỗi phần thi có đồng hồ riêng, hết giờ hệ thống tự nộp phần đó.</li>
            <li>Giữa hai phần có màn nghỉ — đồng hồ phần sau chỉ chạy khi bạn bấm bắt đầu.</li>
            <li>Không thể quay lại phần thi đã nộp.</li>
            <li>
              Lỡ tải lại trang hoặc tắt trình duyệt, bài làm vẫn được giữ trên thiết bị này. Đồng hồ vẫn chạy trong lúc
              bạn rời đi.
            </li>
          </ul>

          <div className="exam-confirm__actions">
            <Link className="button-ghost" to="/exams">
              Về danh sách đề thi
            </Link>
            <button type="button" className="button exam-lobby__start" onClick={startExam}>
              Bắt đầu làm bài
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'break') {
    const finishedSection = exam.sections[sectionIndex - 1];

    return (
      <div className="page centered exam-room-page">
        <div className="exam-lobby__card">
          <span className="eyebrow">
            Đã nộp phần {sectionIndex}/{exam.sections.length}
          </span>
          <h1>Phần tiếp theo: {currentSection.title}</h1>
          {resumed ? (
            <p className="auth-message auth-message--success" role="status">
              Đã khôi phục bài làm đang dở trên thiết bị này.
            </p>
          ) : null}
          <p>
            {finishedSection ? `Phần "${finishedSection.title}" đã được nộp. ` : ''}
            Nghỉ một chút nếu cần — đồng hồ của phần tiếp theo chỉ bắt đầu khi bạn bấm nút bên dưới.
          </p>
          <div className="exam-lobby__facts">
            <span>{getSectionTypeLabel(currentSection.type)}</span>
            <span>{currentSection.durationMinutes} phút</span>
            <span>{currentSection.questions.length} câu</span>
          </div>
          {currentSection.type === 'listening' ? (
            <p>Phần nghe có file âm thanh — hãy chuẩn bị tai nghe trước khi bắt đầu.</p>
          ) : null}
          <div className="exam-confirm__actions">
            <Link className="button-ghost" to="/exams">
              Tạm rời phòng thi
            </Link>
            <button type="button" className="button exam-lobby__start" onClick={startNextSection}>
              Bắt đầu phần {sectionIndex + 1}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'saving') {
    return (
      <div className="page centered exam-room-page">
        {saveError ? (
          <div className="exam-lobby__card">
            <h1>Chưa lưu được bài thi</h1>
            <p role="alert">{saveError}</p>
            <p>
              Bài làm vẫn được giữ trên thiết bị này. Hãy bấm thử lại khi mạng đã ổn định — nếu lỡ đóng tab, mở lại đề
              thi trên thiết bị này để nộp tiếp.
            </p>
            <button type="button" className="button" onClick={retrySaveExam}>
              Thử lưu lại
            </button>
          </div>
        ) : (
          <p>Đang chấm và lưu bài thi...</p>
        )}
      </div>
    );
  }

  // phase === 'room'
  const isLastSection = sectionIndex >= exam.sections.length - 1;
  const lowTime = remainingSeconds <= 300;
  const answeredInSection = currentSection.questions.filter((question) =>
    isQuestionAnswered(question, answers[question.id])
  ).length;
  // Chỉ đọc cho trình đọc màn hình ở các mốc 5 phút và 1 phút, không đọc mỗi giây.
  const timeAnnouncement =
    remainingSeconds <= 60 ? 'Còn 1 phút cho phần thi này.' : remainingSeconds <= 300 ? 'Còn 5 phút cho phần thi này.' : '';

  return (
    <div className="exam-room">
      <header className="exam-room__header">
        <div className="exam-room__title">
          <strong>{exam.title}</strong>
          <span>
            Phần {sectionIndex + 1}/{exam.sections.length}: {currentSection.title}
          </span>
        </div>

        <div className={`exam-room__timer ${lowTime ? 'is-low' : ''}`} role="timer" aria-label="Thời gian còn lại">
          {formatClock(remainingSeconds)}
        </div>
        <span className="exam-room__sr-only" aria-live="assertive">
          {timeAnnouncement}
        </span>

        <div className="exam-room__actions">
          <button type="button" className="button-ghost" onClick={() => setExitOpen(true)}>
            Thoát
          </button>
          <button type="button" className="button exam-room__submit" onClick={() => setConfirmOpen(true)}>
            {isLastSection ? 'Nộp bài' : 'Nộp phần này'}
          </button>
        </div>
      </header>

      {resumed ? (
        <p className="auth-message auth-message--success exam-room__resume-note" role="status">
          Đã khôi phục bài làm đang dở trên thiết bị này. Đồng hồ vẫn chạy trong lúc bạn rời đi.
        </p>
      ) : null}

      <div className="exam-room__body">
        <main className="exam-room__main">
          {currentSection.type === 'listening' && currentSection.audioUrl ? (
            <div className="exam-room__audio">
              <span>File nghe — bạn có thể tua, nghe lại và chỉnh tốc độ trong thời gian của phần thi.</span>
              <ListeningAudio src={currentSection.audioUrl} label={currentSection.title || 'Phần nghe'} />
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
            {answeredInSection}/{currentSection.questions.length} câu đã trả lời
          </p>
        </aside>
      </div>

      {confirmOpen ? (
        <ExamDialog
          title={isLastSection ? 'Nộp bài thi?' : `Nộp phần "${currentSection.title}"?`}
          cancelLabel="Tiếp tục làm bài"
          confirmLabel="Xác nhận nộp"
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => endCurrentSection(false)}
        >
          <p>
            {answeredInSection}/{currentSection.questions.length} câu đã trả lời.{' '}
            {isLastSection
              ? 'Sau khi nộp, bài thi sẽ được chấm ngay.'
              : 'Bạn sẽ không thể quay lại phần này sau khi nộp.'}
          </p>
        </ExamDialog>
      ) : null}

      {exitOpen ? (
        <ExamDialog
          title="Tạm rời phòng thi?"
          cancelLabel="Ở lại làm bài"
          confirmLabel="Rời phòng thi"
          onCancel={() => setExitOpen(false)}
          onConfirm={leaveRoom}
        >
          <p>
            Bài làm đã được lưu trên thiết bị này, mở lại đề là làm tiếp được. Đồng hồ của phần thi{' '}
            <strong>vẫn tiếp tục chạy</strong> khi bạn ra ngoài — hết giờ mà chưa quay lại thì phần này được nộp với
            các câu đã làm.
          </p>
        </ExamDialog>
      ) : null}
    </div>
  );
}
