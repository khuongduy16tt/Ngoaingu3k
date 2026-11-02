import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListeningAudio } from '../components/ListeningAudio';
import { OPEN_CONSULTATION_EVENT } from '../components/ConsultationFab';
import { normalizeExamSection, scoreExamQuestion, scoreExamAnswers } from '../lib/examService';
import { submitConsultationRequest } from '../lib/leadService';
import { scrollIntoViewRespectingMotion } from '../lib/scrollMotion';
import { usePageTitle } from '../hooks/usePageTitle';
import { placementTest, toBand } from '../data/placementTest';
import {
  ExamDialog,
  ExamQuestion,
  formatAnswerForReview,
  formatCorrectAnswer,
  isQuestionAnswered
} from './ExamRoomPage';

// Bài test trình độ miễn phí cho khách (không cần đăng nhập). Dùng lại giao diện
// phòng thi; chấm ngay trên máy rồi gửi tên + SĐT + điểm về trung tâm qua form
// tư vấn (/api/leads/consultation) để giảng viên liên hệ tư vấn lộ trình.

const SESSION_KEY = `ngoaingu3k-placement-test:${placementTest.id}`;
const PHONE_PATTERN = /^[0-9+\s-]{8,15}$/;
const TICK_MS = 500;

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(value) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(value));
  } catch {
    // Bộ nhớ bị chặn: vẫn làm bài được, chỉ là không khôi phục khi tải lại.
  }
}

function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

function formatClock(totalSeconds) {
  const safe = Math.max(0, totalSeconds);
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

// Band tổng ước tính từ 2 kỹ năng, làm tròn theo kiểu IELTS (.25 → .5, .75 → lên 1).
function overallBand(bands) {
  const average = bands.reduce((total, band) => total + band, 0) / bands.length;
  return Math.round(average * 2) / 2;
}

function formatBand(band) {
  return band ? band.toFixed(1) : 'dưới 2.5';
}

function getSuggestion(band) {
  if (band >= 6.5) return 'Bạn đã có nền tảng tốt — phù hợp lộ trình luyện đề, bứt phá band 7.0+.';
  if (band >= 5) return 'Bạn đang ở mức trung cấp — phù hợp khoá IELTS Trung cấp để lên 6.0–6.5.';
  if (band >= 3.5) return 'Bạn đã có kiến thức cơ bản — phù hợp khoá IELTS Cơ bản để chắc nền và lên 5.0+.';
  return 'Bạn nên bắt đầu từ khoá IELTS Nền tảng để xây chắc ngữ pháp, từ vựng và kỹ năng nghe – đọc.';
}

function emptyState() {
  return { phase: 'intro', sectionIndex: 0, answers: {}, deadline: null, info: { fullName: '', phone: '' }, result: null };
}

export default function PlacementTestPage() {
  usePageTitle('Test trình độ miễn phí');
  const sections = useMemo(() => placementTest.sections.map((section, index) => normalizeExamSection(section, index)), []);

  const [state, setState] = useState(() => {
    const saved = readSession();
    return saved && saved.phase ? { ...emptyState(), ...saved } : emptyState();
  });
  const [resumed] = useState(() => Boolean(readSession()?.phase && readSession().phase !== 'intro'));
  const [now, setNow] = useState(() => Date.now());
  const [formError, setFormError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [leadStatus, setLeadStatus] = useState('idle'); // idle | sending | sent | failed
  const leadSentRef = useRef(false);

  const { phase, sectionIndex, answers, deadline, info, result } = state;
  const currentSection = sections[sectionIndex] || null;
  const remainingSeconds = deadline ? Math.ceil((deadline - now) / 1000) : 0;
  const isLastSection = sectionIndex >= sections.length - 1;

  function update(patch) {
    setState((previous) => ({ ...previous, ...(typeof patch === 'function' ? patch(previous) : patch) }));
  }

  // Lưu bài làm xuống máy để lỡ tải lại trang vẫn làm tiếp được.
  useEffect(() => {
    if (phase === 'intro') return;
    writeSession(state);
  }, [state, phase]);

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

  // Hết giờ thì tự nộp phần đang làm.
  useEffect(() => {
    if (phase === 'room' && deadline && remainingSeconds <= 0) {
      endSection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, deadline, remainingSeconds]);

  // Gửi kết quả về trung tâm một lần khi có kết quả.
  useEffect(() => {
    if (phase !== 'result' || !result || result.leadSent || leadSentRef.current) return;
    leadSentRef.current = true;
    setLeadStatus('sending');
    const needs = `[Test trình độ ${placementTest.title}] Listening ${result.listening}/40 (band ${formatBand(result.listeningBand)}) · Reading ${result.reading}/40 (band ${formatBand(result.readingBand)}) · Band ước tính ${formatBand(result.overall)}`;
    submitConsultationRequest({
      fullName: info.fullName,
      phone: info.phone,
      email: '',
      program: 'IELTS',
      needs
    })
      .then(() => {
        setLeadStatus('sent');
        update((previous) => ({ result: { ...previous.result, leadSent: true } }));
      })
      .catch(() => {
        leadSentRef.current = false;
        setLeadStatus('failed');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, result]);

  function startTest(event) {
    event.preventDefault();
    const fullName = info.fullName.trim();
    const phone = info.phone.trim();
    if (!fullName || !phone) {
      setFormError('Vui lòng nhập họ tên và số điện thoại để nhận kết quả.');
      return;
    }
    if (!PHONE_PATTERN.test(phone)) {
      setFormError('Số điện thoại không hợp lệ.');
      return;
    }
    setFormError('');
    setNow(Date.now());
    update({
      phase: 'room',
      sectionIndex: 0,
      answers: {},
      result: null,
      info: { fullName, phone },
      deadline: Date.now() + sections[0].durationMinutes * 60_000
    });
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  function startNextSection() {
    setNow(Date.now());
    update({ phase: 'room', deadline: Date.now() + sections[sectionIndex].durationMinutes * 60_000 });
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  function endSection() {
    setConfirmOpen(false);
    if (!isLastSection) {
      update({ phase: 'break', sectionIndex: sectionIndex + 1, deadline: null });
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      return;
    }

    const scored = scoreExamAnswers(sections, answers);
    const byId = Object.fromEntries(scored.sectionScores.map((section) => [section.sectionId, section.score]));
    const listening = byId.listening || 0;
    const reading = byId.reading || 0;
    const listeningBand = toBand(listening);
    const readingBand = toBand(reading);
    update({
      phase: 'result',
      deadline: null,
      result: {
        listening,
        reading,
        listeningBand,
        readingBand,
        overall: overallBand([listeningBand, readingBand]),
        leadSent: false
      }
    });
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  function restart() {
    clearSession();
    leadSentRef.current = false;
    setLeadStatus('idle');
    setRestartOpen(false);
    setState((previous) => ({ ...emptyState(), info: previous.info }));
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  function setAnswer(questionId, value) {
    update((previous) => ({ answers: { ...previous.answers, [questionId]: value } }));
  }

  // ─── Intro ──────────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div className="page centered exam-room-page">
        <form className="exam-lobby__card" onSubmit={startTest} noValidate>
          <span className="eyebrow">Kiểm tra trình độ miễn phí</span>
          <h1>{placementTest.title}</h1>
          <p>
            Làm bài test chuẩn format IELTS để biết trình độ hiện tại của bạn. Có kết quả và band điểm ngay sau khi nộp,
            kèm gợi ý lộ trình học phù hợp.
          </p>

          <div className="exam-lobby__facts">
            <span>2 phần thi</span>
            <span>80 câu hỏi</span>
            <span>100 phút</span>
          </div>

          <ol className="exam-lobby__sections">
            {sections.map((section) => (
              <li key={section.id}>
                <strong>{section.title}</strong>
                <span>
                  {section.durationMinutes} phút · {section.questions.length} câu
                </span>
              </li>
            ))}
          </ol>

          <ul className="exam-lobby__rules">
            <li>Phần Nghe có file âm thanh — hãy chuẩn bị tai nghe.</li>
            <li>Mỗi phần có đồng hồ riêng, hết giờ hệ thống tự nộp phần đó. Giữa hai phần có màn nghỉ.</li>
            <li>Lỡ tải lại trang, bài làm vẫn được giữ trên thiết bị này (đồng hồ vẫn chạy).</li>
          </ul>

          <div className="auth-fields">
            <label className="auth-field">
              <span>Họ và tên</span>
              <input
                type="text"
                placeholder="Nguyễn Văn A"
                value={info.fullName}
                autoComplete="name"
                onChange={(event) => update({ info: { ...info, fullName: event.target.value } })}
              />
            </label>
            <label className="auth-field">
              <span>Số điện thoại</span>
              <input
                type="tel"
                placeholder="0912345678"
                value={info.phone}
                autoComplete="tel"
                onChange={(event) => update({ info: { ...info, phone: event.target.value } })}
              />
            </label>
          </div>
          {formError ? (
            <p className="auth-message auth-message--error" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="exam-confirm__actions">
            <Link className="button-ghost" to="/courses">
              Xem khoá học
            </Link>
            <button type="submit" className="button exam-lobby__start">
              Bắt đầu làm bài
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ─── Result ─────────────────────────────────────────────────────────────────
  if (phase === 'result' && result) {
    return (
      <div className="page exam-room-page">
        <div className="exam-result">
          <section className="exam-result__summary">
            <span className="eyebrow">Kết quả test trình độ</span>
            <h1>{info.fullName ? `${info.fullName}, band ước tính của bạn` : 'Band ước tính của bạn'}</h1>
            <div className="exam-result__score">
              <strong>{formatBand(result.overall)}</strong>
              <span>Band trung bình Listening + Reading</span>
            </div>

            <div className="exam-result__sections">
              <article className="exam-result__section-card">
                <span>Listening</span>
                <strong>
                  {result.listening}/40 · band {formatBand(result.listeningBand)}
                </strong>
              </article>
              <article className="exam-result__section-card">
                <span>Reading</span>
                <strong>
                  {result.reading}/40 · band {formatBand(result.readingBand)}
                </strong>
              </article>
            </div>

            <p>{getSuggestion(result.overall)}</p>
            {leadStatus === 'sent' || result.leadSent ? (
              <p className="auth-message auth-message--success" role="status">
                Trung tâm đã nhận kết quả của bạn — giảng viên sẽ liên hệ qua số {info.phone} để tư vấn lộ trình.
              </p>
            ) : leadStatus === 'failed' ? (
              <p className="auth-message auth-message--error" role="alert">
                Chưa gửi được kết quả cho trung tâm. Bấm "Nhận tư vấn lộ trình" để để lại thông tin nhé.
              </p>
            ) : null}

            <div className="exam-result__actions">
              <button
                type="button"
                className="button"
                onClick={() => window.dispatchEvent(new Event(OPEN_CONSULTATION_EVENT))}
              >
                Nhận tư vấn lộ trình
              </button>
              <Link className="button-ghost" to="/courses">
                Xem khoá học
              </Link>
              <button type="button" className="button-ghost" onClick={() => setRestartOpen(true)}>
                Làm lại bài test
              </button>
            </div>
          </section>

          <section className="exam-result__review">
            <h2>Xem lại bài làm</h2>
            {sections.map((section) => (
              <div key={section.id} className="exam-result__review-section">
                <h3>{section.title}</h3>
                {section.questions.map((question, index) => {
                  const answer = answers[question.id];
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
                          <span className="exam-review-item__label">Đáp án đúng:</span> {formatCorrectAnswer(question)}
                        </p>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ))}
          </section>
        </div>

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

  // ─── Break between sections ─────────────────────────────────────────────────
  if (phase === 'break') {
    return (
      <div className="page centered exam-room-page">
        <div className="exam-lobby__card">
          <span className="eyebrow">
            Đã nộp phần {sectionIndex}/{sections.length}
          </span>
          <h1>Phần tiếp theo: {currentSection.title}</h1>
          <p>Nghỉ một chút nếu cần — đồng hồ của phần tiếp theo chỉ bắt đầu khi bạn bấm nút bên dưới.</p>
          <div className="exam-lobby__facts">
            <span>{currentSection.durationMinutes} phút</span>
            <span>{currentSection.questions.length} câu</span>
          </div>
          <div className="exam-confirm__actions">
            <button type="button" className="button exam-lobby__start" onClick={startNextSection}>
              Bắt đầu phần {sectionIndex + 1}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Room ───────────────────────────────────────────────────────────────────
  const answeredInSection = currentSection.questions.filter((question) =>
    isQuestionAnswered(question, answers[question.id])
  ).length;
  const lowTime = remainingSeconds <= 300;

  const questionList = (
    <div className="exam-room__questions">
      {currentSection.questions.map((question, index) => (
        <ExamQuestion
          key={question.id}
          question={question}
          index={index}
          answer={answers[question.id]}
          onChange={(value) => setAnswer(question.id, value)}
        />
      ))}
    </div>
  );

  return (
    <div className="exam-room">
      <header className="exam-room__header">
        <div className="exam-room__title">
          <strong>Test trình độ miễn phí</strong>
          <span>
            Phần {sectionIndex + 1}/{sections.length}: {currentSection.title}
          </span>
        </div>
        <div className={`exam-room__timer ${lowTime ? 'is-low' : ''}`} role="timer" aria-label="Thời gian còn lại">
          {formatClock(remainingSeconds)}
        </div>
        <div className="exam-room__actions">
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
              <span>File nghe — bạn có thể tua, nghe lại và chỉnh tốc độ trong thời gian làm bài.</span>
              <ListeningAudio src={currentSection.audioUrl} label={currentSection.title} />
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
              {questionList}
            </div>
          ) : (
            questionList
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
                onClick={() =>
                  scrollIntoViewRespectingMotion(document.getElementById(`exam-question-${question.id}`), {
                    block: 'center'
                  })
                }
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
          title={isLastSection ? 'Nộp bài test?' : `Nộp phần "${currentSection.title}"?`}
          cancelLabel="Làm tiếp"
          confirmLabel={isLastSection ? 'Nộp bài' : 'Nộp phần này'}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={endSection}
        >
          <p>
            {answeredInSection}/{currentSection.questions.length} câu đã trả lời. Không thể quay lại phần đã nộp.
          </p>
        </ExamDialog>
      ) : null}
    </div>
  );
}
