import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListeningAudio } from '../components/ListeningAudio';
import { OPEN_CONSULTATION_EVENT } from '../components/ConsultationFab';
import { normalizeExamQuestion, scoreExamAnswers, scoreExamQuestion } from '../lib/examService';
import { submitConsultationRequest } from '../lib/leadService';
import { gradeSpeaking, gradeWriting } from '../lib/placementScoring';
import { scrollIntoViewRespectingMotion } from '../lib/scrollMotion';
import { usePageTitle } from '../hooks/usePageTitle';
import { placementTest, toBand } from '../data/placementTest';
import { SpeakingPart, isSpeakingAnswered } from './placement/SpeakingPart';
import { TestPicker } from './placement/TestPicker';
import { useAuth } from '../providers/AuthProvider';
import { ExamDialog, formatAnswerForReview, formatCorrectAnswer } from './ExamRoomPage';

// Bài test trình độ miễn phí (phải đăng nhập mới làm được), giao diện kiểu
// thi IELTS trên máy: chia Part/Passage, mỗi nhóm câu một khung hướng dẫn,
// thanh số câu ở đáy. Chấm ngay trên máy rồi gửi tên + SĐT + điểm về trung tâm
// qua form tư vấn (/api/leads/consultation).

const SESSION_KEY = `ngoaingu3k-placement-test-v3:${placementTest.id}`;
const PHONE_PATTERN = /^[0-9+\s-]{8,15}$/;
const TICK_MS = 500;
const BLANK = '____';

// ─── Lưu tạm trên máy ─────────────────────────────────────────────────────────

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

// ─── Tiện ích ─────────────────────────────────────────────────────────────────

function formatClock(totalSeconds) {
  const safe = Math.max(0, totalSeconds);
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function formatBand(band) {
  return band ? band.toFixed(1) : 'dưới 2.5';
}

// Band tổng ước tính từ 2 kỹ năng, làm tròn theo kiểu IELTS (.25 → .5, .75 → lên 1).
function overallBand(bands) {
  const average = bands.reduce((total, band) => total + band, 0) / bands.length;
  return Math.round(average * 2) / 2;
}

// Band tổng: trung bình các kỹ năng đã có điểm (Writing/Speaking chỉ tính khi đã chấm xong).
function computeOverall(result) {
  const bands = [result.listeningBand, result.readingBand];
  if (result.writing?.status === 'done') bands.push(Number(result.writing.band) || 0);
  if (result.speaking?.status === 'done') bands.push(Number(result.speaking.band) || 0);
  return overallBand(bands);
}

function overallLabel(result) {
  const names = ['Listening', 'Reading'];
  if (result.writing?.status === 'done') names.push('Writing');
  if (result.speaking?.status === 'done') names.push('Speaking');
  return `Trung bình ${names.join(' + ')}`;
}

function getSuggestion(band) {
  if (band >= 6.5) return { course: 'Luyện đề nâng cao', text: 'Bạn đã có nền tảng tốt — phù hợp lộ trình luyện đề, bứt phá band 7.0+.' };
  if (band >= 5) return { course: 'IELTS Trung cấp', text: 'Bạn đang ở mức trung cấp — phù hợp khoá IELTS Trung cấp để lên 6.0–6.5.' };
  if (band >= 3.5) return { course: 'IELTS Cơ bản', text: 'Bạn đã có kiến thức cơ bản — phù hợp khoá IELTS Cơ bản để chắc nền và lên 5.0+.' };
  return { course: 'IELTS Nền tảng', text: 'Nên bắt đầu từ khoá IELTS Nền tảng để xây chắc ngữ pháp, từ vựng và kỹ năng nghe – đọc.' };
}

// "A – post the customer something" → { code: 'A', text: 'post the customer something' }
function splitOption(option) {
  const [code, ...rest] = String(option).split(' – ');
  return rest.length ? { code, text: rest.join(' – ') } : { code: option, text: '' };
}

function isAnswered(answer) {
  return String(answer ?? '').trim() !== '';
}

function partQuestions(part) {
  return part.groups.flatMap((group) => group.questions);
}

function emptyState() {
  return {
    phase: 'intro',
    skillIndex: 0,
    partIndex: 0,
    answers: {},
    deadline: null,
    info: { fullName: '', phone: '' },
    result: null
  };
}

// ─── Câu hỏi ──────────────────────────────────────────────────────────────────

function GapInput({ question, value, onChange }) {
  return (
    <input
      className={`ptest-gap ${isAnswered(value) ? 'is-filled' : ''}`}
      type="text"
      value={String(value ?? '')}
      placeholder={String(question.number)}
      aria-label={`Câu ${question.number}`}
      autoComplete="off"
      autoCapitalize="off"
      spellCheck={false}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

// Câu điền từ: thay "____" trong câu bằng ô nhập ngay tại chỗ.
function GapSentence({ question, value, onChange }) {
  const pieces = question.prompt.split(BLANK);
  return (
    <p className="ptest-gap-line">
      {pieces.map((piece, index) => (
        <React.Fragment key={index}>
          {piece.split('\n').map((line, lineIndex, lines) => (
            <React.Fragment key={lineIndex}>
              {line}
              {lineIndex < lines.length - 1 ? <br /> : null}
            </React.Fragment>
          ))}
          {index < pieces.length - 1 ? <GapInput question={question} value={value} onChange={onChange} /> : null}
        </React.Fragment>
      ))}
    </p>
  );
}

function ChoicePills({ question, value, onChange, showCode = true }) {
  return (
    <div className="ptest-pills" role="radiogroup" aria-label={`Câu ${question.number}`}>
      {question.options.map((option) => {
        const { code } = splitOption(option);
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            title={option}
            className={`ptest-pill ${selected ? 'is-selected' : ''}`}
            onClick={() => onChange(selected ? '' : option)}
          >
            {showCode ? code : option}
          </button>
        );
      })}
    </div>
  );
}

function QuestionNumber({ question, answered }) {
  return <span className={`ptest-num ${answered ? 'is-answered' : ''}`}>{question.number}</span>;
}

function QuestionGroup({ group, answers, setAnswer }) {
  const gapAnswers = group.summary
    ? Object.fromEntries(group.questions.map((question) => [question.number, splitOption(answers[question.id] || '').code]))
    : null;

  return (
    <section className={`ptest-group ptest-group--${group.display}`}>
      <header className="ptest-group__head">
        <h3>{group.title}</h3>
        <p>{group.instruction}</p>
      </header>

      {group.legend ? (
        <dl className="ptest-legend">
          {group.legend.map(([term, meaning]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{meaning}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {group.summary ? (
        <p className="ptest-summary">
          {group.summary.split(/\((\d+)\) ____/).map((piece, index) =>
            index % 2 === 1 ? (
              <span key={index} className={`ptest-summary__gap ${gapAnswers[piece] ? 'is-filled' : ''}`}>
                {gapAnswers[piece] ? `${piece} · ${gapAnswers[piece]}` : piece}
              </span>
            ) : (
              <React.Fragment key={index}>{piece}</React.Fragment>
            )
          )}
        </p>
      ) : null}

      {group.list ? (
        <div className="ptest-list">
          <h4>{group.list.title}</h4>
          <ul>
            {group.list.items.map((item) => (
              <li key={item.code}>
                <b>{item.code}</b>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {group.heading ? <h4 className="ptest-group__title">{group.heading}</h4> : null}
      {group.image ? <img className="ptest-group__image" src={group.image} alt={group.heading || group.title} /> : null}

      <div className="ptest-items">
        {group.questions.map((question) => {
          const value = answers[question.id];
          const answered = isAnswered(value);
          const onChange = (next) => setAnswer(question.id, next);
          const steps = group.steps?.[question.id] || [];

          if (question.type === 'fill_blank') {
            return (
              <React.Fragment key={question.id}>
                {group.display === 'flow'
                  ? steps.map((step) => (
                      <div key={step} className="ptest-item ptest-item--step">
                        <p>{step}</p>
                      </div>
                    ))
                  : null}
                <div
                  id={`ptq-${question.id}`}
                  className="ptest-item ptest-item--gap"
                >
                  <GapSentence question={question} value={value} onChange={onChange} />
                </div>
              </React.Fragment>
            );
          }

          if (group.display === 'options') {
            return (
              <div key={question.id} id={`ptq-${question.id}`} className="ptest-item ptest-item--mc">
                <div className="ptest-item__prompt">
                  <QuestionNumber question={question} answered={answered} />
                  <p>{question.prompt}</p>
                </div>
                <div className="ptest-options">
                  {question.options.map((option) => {
                    const { code, text } = splitOption(option);
                    const selected = value === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        className={`ptest-option ${selected ? 'is-selected' : ''}`}
                        aria-pressed={selected}
                        onClick={() => onChange(selected ? '' : option)}
                      >
                        <b>{code}</b>
                        <span>{text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          }

          return (
            <div key={question.id} id={`ptq-${question.id}`} className="ptest-item ptest-item--row">
              <div className="ptest-item__prompt">
                <QuestionNumber question={question} answered={answered} />
                <p>{question.prompt}</p>
              </div>
              <ChoicePills question={question} value={value} onChange={onChange} showCode={group.display === 'letters'} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Passage({ passage, partTitle }) {
  return (
    <article className="ptest-passage">
      <span className="ptest-passage__eyebrow">Reading {partTitle}</span>
      <h2>{passage.title}</h2>
      {passage.paragraphs.map((paragraph, index) => (
        <p key={index} className={paragraph.label ? 'has-label' : ''}>
          {paragraph.label ? <b className="ptest-passage__label">{paragraph.label}</b> : null}
          <span>{paragraph.text}</span>
        </p>
      ))}
    </article>
  );
}

// Số band đếm dần từ 0 lên khi vào màn kết quả (bỏ qua nếu người dùng tắt chuyển động).
function CountUpBand({ value }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !value) {
      setShown(value);
      return undefined;
    }
    const start = performance.now();
    const duration = 900;
    let frame = 0;
    const tick = (time) => {
      const progress = Math.min(1, (time - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(Math.round(value * eased * 2) / 2);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return shown ? shown.toFixed(1) : '<2.5';
}

function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function WritingPrompt({ part }) {
  return (
    <article className="ptest-passage ptest-writing-prompt">
      <span className="ptest-passage__eyebrow">Writing {part.title}</span>
      <h2>{part.title === 'Task 1' ? 'Mô tả bảng số liệu' : 'Viết bài luận'}</h2>
      <p className="ptest-writing-prompt__meta">
        {part.writing.instruction} Viết tối thiểu {part.minWords} từ.
      </p>
      <div className="ptest-writing-prompt__box">
        {part.writing.prompt.split(/\n{2,}/).map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
      {part.writing.image ? (
        <img className="ptest-writing-prompt__image" src={part.writing.image} alt={part.writing.imageAlt || part.title} />
      ) : null}
    </article>
  );
}

function WritingEditor({ part, value, onChange }) {
  const words = countWords(value);
  const enough = words >= part.minWords;
  return (
    <div className="ptest-editor">
      <label className="ptest-editor__label" htmlFor={`ptw-${part.id}`}>
        Bài làm {part.title}
      </label>
      <textarea
        id={`ptw-${part.id}`}
        className="ptest-editor__area"
        value={String(value ?? '')}
        placeholder={`Viết bài ${part.title} bằng tiếng Anh tại đây...`}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="ptest-editor__foot">
        <span className={`ptest-editor__count ${enough ? 'is-enough' : ''}`}>
          <strong>{words}</strong> / {part.minWords} từ
        </span>
        <span className="ptest-editor__meter" aria-hidden="true">
          <span style={{ width: `${Math.min(100, (words / part.minWords) * 100)}%` }} />
        </span>
      </div>
    </div>
  );
}

// ─── Trang ────────────────────────────────────────────────────────────────────

export default function PlacementTestPage() {
  usePageTitle('Test Band IELTS Free');

  const skills = placementTest.skills;
  // Câu hỏi đã chuẩn hoá theo định dạng của phòng thi để dùng chung hàm chấm.
  const scoringSections = useMemo(
    () =>
      skills.filter((skill) => skill.id !== 'writing').map((skill) => ({
        id: skill.id,
        type: skill.id,
        title: skill.title,
        questions: skill.parts.flatMap(partQuestions).map((question, index) => normalizeExamQuestion(question, index))
      })),
    [skills]
  );
  const normalizedById = useMemo(
    () => Object.fromEntries(scoringSections.flatMap((section) => section.questions.map((question) => [question.id, question]))),
    [scoringSections]
  );

  const [state, setState] = useState(() => {
    const saved = readSession();
    return saved && saved.phase ? { ...emptyState(), ...saved } : emptyState();
  });
  const [resumed, setResumed] = useState(() => ['room', 'break'].includes(readSession()?.phase));
  const [now, setNow] = useState(() => Date.now());
  const [formError, setFormError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState('passage');
  const [leadStatus, setLeadStatus] = useState('idle');
  const leadSentRef = useRef(false);
  const questionsRef = useRef(null);

  const auth = useAuth();
  const { phase, skillIndex, partIndex, answers, deadline, info, result } = state;
  const skill = skills[skillIndex];
  const part = skill?.parts[partIndex] || skill?.parts[0];
  const isLastSkill = skillIndex >= skills.length - 1;
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
      previous.info.fullName || previous.info.phone ? {} : { info: { fullName: profileName, phone: profilePhone } }
    );
  }, [auth.profile?.full_name, auth.profile?.phone]);

  useEffect(() => {
    if (phase !== 'intro') writeSession(state);
  }, [state, phase]);

  // Thông báo "đã khôi phục" chỉ cần hiện một lúc.
  useEffect(() => {
    if (!resumed) return undefined;
    const id = setTimeout(() => setResumed(false), 6000);
    return () => clearTimeout(id);
  }, [resumed]);

  // Đánh dấu trang để CSS ẩn linh vật header trên điện thoại (đè lên tiêu đề).
  useEffect(() => {
    document.body.classList.add('ptest-page');
    return () => document.body.classList.remove('ptest-page');
  }, []);

  // Chế độ tập trung: ẩn header, footer và các nút nổi của site trong lúc làm bài.
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
    if (phase === 'room' && deadline && remainingSeconds <= 0) endSkill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, deadline, remainingSeconds]);

  // Gửi kết quả về trung tâm một lần, sau khi Writing đã chấm xong (hoặc lỗi).
  useEffect(() => {
    if (phase !== 'result' || !result || result.leadSent || leadSentRef.current) return;
    leadSentRef.current = true;
    setLeadStatus('sending');
    const writingText =
      result.writing?.status === 'done' ? `Writing band ${formatBand(result.writing.band)}` : 'Writing chưa chấm được';
    const speakingText =
      result.speaking?.status === 'done'
        ? `Speaking band ${formatBand(result.speaking.band)}`
        : result.speaking?.status === 'skipped'
          ? 'Speaking bỏ qua'
          : 'Speaking chưa chấm được';
    const needs = `[Test trình độ ${placementTest.title}] Listening ${result.listening}/40 (band ${formatBand(result.listeningBand)}) · Reading ${result.reading}/40 (band ${formatBand(result.readingBand)}) · ${writingText} · ${speakingText} · Band ước tính ${formatBand(result.overall)}`;
    submitConsultationRequest({
      fullName: info.fullName,
      phone: info.phone,
      email: '',
      program: 'IELTS',
      needs,
      source: 'test-trinh-do'
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
    setResumed(false);
    setNow(Date.now());
    update({
      phase: 'room',
      skillIndex: 0,
      partIndex: 0,
      answers: {},
      result: null,
      info: { fullName, phone },
      deadline: Date.now() + skills[0].durationMinutes * 60_000
    });
    scrollTop();
  }

  function startNextSkill() {
    setResumed(false);
    setNow(Date.now());
    setMobilePane('passage');
    update({ phase: 'room', partIndex: 0, deadline: Date.now() + skill.durationMinutes * 60_000 });
    scrollTop();
  }

  function endSkill() {
    setConfirmOpen(false);
    if (!isLastSkill) {
      update({ phase: 'break', skillIndex: skillIndex + 1, partIndex: 0, deadline: null });
      scrollTop();
      return;
    }

    const scored = scoreExamAnswers(scoringSections, answers);
    const byId = Object.fromEntries(scored.sectionScores.map((section) => [section.sectionId, section.score]));
    const listening = byId.listening || 0;
    const reading = byId.reading || 0;
    const listeningBand = toBand(listening);
    const readingBand = toBand(reading);
    const speakingSkill = skills.find((item) => item.id === 'speaking');
    const spokeSomething = Boolean(
      speakingSkill?.parts.some((p) => p.speaking.questions.some((q) => isSpeakingAnswered(answers[q.id])))
    );
    const writing = { status: 'done', ...gradeWriting({ task1: answers['w-task1'] || '', task2: answers['w-task2'] || '' }) };
    const speaking = spokeSomething
      ? {
          status: 'done',
          ...gradeSpeaking(
            speakingSkill.parts.flatMap((p) =>
              p.speaking.questions.map((q) => ({
                part: p.title,
                question: q.text,
                transcript: answers[q.id]?.text || '',
                seconds: answers[q.id]?.seconds || 0,
                confidence: answers[q.id]?.confidence || 0
              }))
            )
          )
        }
      : { status: 'skipped' };
    const scoredResult = { listeningBand: toBand(listening), readingBand: toBand(reading), writing, speaking };
    update({
      phase: 'result',
      deadline: null,
      result: {
        listening,
        reading,
        listeningBand,
        readingBand,
        overall: computeOverall(scoredResult),
        writing,
        speaking,
        leadSent: false
      }
    });
    scrollTop();
  }

  function restart() {
    clearSession();
    leadSentRef.current = false;
    setLeadStatus('idle');
    setRestartOpen(false);
    setState((previous) => ({ ...emptyState(), info: previous.info }));
    scrollTop();
  }

  function setAnswer(questionId, value) {
    update((previous) => ({ answers: { ...previous.answers, [questionId]: value } }));
  }

  function goToPart(index) {
    update({ partIndex: index });
    setMobilePane(skill.parts[index].passage || skill.parts[index].writing ? 'passage' : 'questions');
    questionsRef.current?.scrollTo({ top: 0 });
    document.querySelector('.ptest-passage')?.parentElement?.scrollTo({ top: 0 });
    scrollTop();
  }

  function jumpToQuestion(targetPartIndex, questionId) {
    if (targetPartIndex !== partIndex) update({ partIndex: targetPartIndex });
    setMobilePane('questions');
    // Đợi tab mới render xong rồi mới cuộn tới câu.
    setTimeout(() => {
      const element = document.getElementById(`ptq-${questionId}`);
      scrollIntoViewRespectingMotion(element, { block: 'center' });
      element?.querySelector('input')?.focus({ preventScroll: true });
    }, 30);
  }

  // ─── Màn giới thiệu ─────────────────────────────────────────────────────────
  // Mọi thông tin cần thiết nằm gọn trong một màn hình, không phải kéo xuống:
  // máy tính 2 cột (giới thiệu | form), điện thoại xếp dọc (tiêu đề, 3 phần, form).
  if (phase === 'intro') {
    const skillMeta = {
      listening: '40 câu · 40 phút',
      reading: '40 câu · 60 phút',
      writing: '2 bài viết · 60 phút',
      speaking: '3 phần · 20 phút'
    };
    return (
      <div className="pt-landing">
        <section className="pt-landing__hero">
          <div className="pt-landing__copy">
            <TestPicker active="ielts" />
            <p className="pt-kicker pt-rise" style={{ '--d': 0 }}>
              Miễn phí · Tiếng Anh
            </p>
            <h1 className="pt-landing__title pt-rise" style={{ '--d': 1 }}>
              Test Band IELTS <span>Free</span>
            </h1>
            <p className="pt-landing__lead pt-rise" style={{ '--d': 2 }}>
              Bài test chuẩn format IELTS đủ 4 kỹ năng. Nộp xong có ngay band từng kỹ năng, đáp án chi tiết và nhận xét Writing, Speaking.
            </p>
            <ol className="pt-skills pt-rise" style={{ '--d': 3 }}>
              {skills.map((item, index) => (
                <li key={item.id} className="pt-3d">
                  <span className="pt-skills__num">0{index + 1}</span>
                  <strong>{item.title}</strong>
                  <span className="pt-skills__meta">{skillMeta[item.id]}</span>
                </li>
              ))}
            </ol>
            <ul className="pt-checks pt-rise" style={{ '--d': 4 }}>
              <li>Có band ngay khi nộp</li>
              <li>Nhận xét Writing &amp; Speaking</li>
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
              Làm bài test ngay
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
            <p className="pt-form__privacy">
              Tổng 180 phút, có nghỉ giữa các phần. Chuẩn bị tai nghe có micro cho Listening và Speaking. Lỡ tải lại trang, bài làm vẫn
              được giữ.
            </p>
          </form>
        </section>
      </div>
    );
  }

  // ─── Kết quả ────────────────────────────────────────────────────────────────
  if (phase === 'result' && result) {
    const writing = result.writing || { status: 'failed' };
    const writingDone = writing.status === 'done';
    const speaking = result.speaking || { status: 'skipped' };
    const speakingDone = speaking.status === 'done';
    const suggestion = getSuggestion(result.overall);
    const skillResults = [
      { id: 'listening', title: 'Listening', detail: `${result.listening}/40`, ratio: result.listening / 40, band: result.listeningBand },
      { id: 'reading', title: 'Reading', detail: `${result.reading}/40`, ratio: result.reading / 40, band: result.readingBand },
      {
        id: 'writing',
        title: 'Writing',
        detail: writingDone ? '2 bài viết' : 'Chưa làm',
        ratio: writingDone ? (Number(writing.band) || 0) / 9 : 0,
        band: writingDone ? Number(writing.band) || 0 : null,
        pending: false
      },
      {
        id: 'speaking',
        title: 'Speaking',
        detail: speakingDone ? '3 phần' : 'Bỏ qua',
        ratio: speakingDone ? (Number(speaking.band) || 0) / 9 : 0,
        band: speakingDone ? Number(speaking.band) || 0 : null,
        pending: false
      }
    ];

    return (
      <div className="pt-result">
        <section className="pt-result__head pt-3d pt-rise" style={{ '--d': 0 }}>
          <div className="pt-result__band">
            <p className="pt-kicker">Band ước tính</p>
            <strong aria-live="polite">
              <CountUpBand value={result.overall} />
            </strong>
            <span>
              {overallLabel(result)}
            </span>
          </div>

          <div className="pt-result__main">
            <p className="pt-kicker">Kết quả test trình độ</p>
            <h1 className="pt-result__title">
              {info.fullName ? `${info.fullName}, bạn đã hoàn thành bài test` : 'Bạn đã hoàn thành bài test'}
            </h1>

            <table className="pt-scores">
              <thead>
                <tr>
                  <th scope="col">Kỹ năng</th>
                  <th scope="col">Kết quả</th>
                  <th scope="col">Band</th>
                </tr>
              </thead>
              <tbody>
                {skillResults.map((item, index) => (
                  <tr key={item.id}>
                    <th scope="row">{item.title}</th>
                    <td>
                      <div className="pt-scores__bar">
                        <span className="pt-scores__value">{item.detail}</span>
                        <span className={`pt-meter ${item.pending ? 'is-pending' : ''}`} aria-hidden="true">
                          <span style={{ width: `${item.ratio * 100}%`, '--d': index }} />
                        </span>
                      </div>
                    </td>
                    <td className="pt-scores__band">{item.band === null ? '—' : formatBand(item.band)}</td>
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
              <Link className="pt-btn pt-btn--outline" to="/courses">
                Xem khoá học
              </Link>
              <button type="button" className="pt-btn pt-btn--text" onClick={() => setRestartOpen(true)}>
                Làm lại bài test
              </button>
            </div>
          </div>
        </section>

        <section className="pt-writing pt-rise" style={{ '--d': 1 }}>
          <h2 className="pt-section-title">Writing — nhận xét chi tiết</h2>
          {writingDone ? (
            <>
              {writing.summary ? <p className="pt-writing__summary">{writing.summary}</p> : null}
              <div className="pt-writing__tasks">
                {[
                  { key: 'task1', title: 'Task 1', data: writing.task1 },
                  { key: 'task2', title: 'Task 2', data: writing.task2 }
                ].map(({ key, title, data }) =>
                  data ? (
                    <article key={key} className="pt-writing__task pt-3d">
                      <header>
                        <div>
                          <strong>{title}</strong>
                          <span>{data.words} từ</span>
                        </div>
                        <b>{formatBand(Number(data.band) || 0)}</b>
                      </header>
                      {data.criteria ? (
                        <dl className="pt-criteria">
                          {Object.entries(data.criteria).map(([name, score]) => (
                            <div key={name}>
                              <dt>{name}</dt>
                              <dd>
                                <span className="pt-criteria__bar" aria-hidden="true">
                                  <span style={{ width: `${(Number(score) / 9) * 100}%` }} />
                                </span>
                                <b>{Number(score).toFixed(1)}</b>
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                      <p>{data.feedback}</p>
                    </article>
                  ) : null
                )}
              </div>
              {writing.strengths?.length || writing.improvements?.length ? (
                <div className="pt-writing__lists">
                  {writing.strengths?.length ? (
                    <div className="pt-3d pt-3d--green">
                      <h3>Điểm mạnh</h3>
                      <ul>
                        {writing.strengths.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {writing.improvements?.length ? (
                    <div className="pt-3d pt-3d--blue">
                      <h3>Cần cải thiện</h3>
                      <ul>
                        {writing.improvements.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </section>

        <section className="pt-writing pt-rise" style={{ '--d': 2 }}>
          <h2 className="pt-section-title">Speaking — nhận xét chi tiết</h2>
          {speaking.status === 'skipped' ? (
            <div className="pt-writing__loading pt-3d" role="status">
              <div>
                <strong>Bạn chưa làm phần Speaking.</strong>
                <span>Band tổng được tính từ các kỹ năng đã làm. Giảng viên sẽ kiểm tra Speaking khi tư vấn.</span>
              </div>
            </div>
          ) : (
            <>
              {speaking.summary ? <p className="pt-writing__summary">{speaking.summary}</p> : null}
              <div className="pt-writing__tasks">
                {Object.entries(speaking.criteria || {}).map(([name, score]) => (
                  <article key={name} className="pt-writing__task pt-3d">
                    <header>
                      <div>
                        <strong>{name}</strong>
                      </div>
                      <b>{Number(score).toFixed(1)}</b>
                    </header>
                    {speaking.feedback?.[name] ? <p>{speaking.feedback[name]}</p> : null}
                  </article>
                ))}
              </div>
              {speaking.strengths?.length || speaking.improvements?.length ? (
                <div className="pt-writing__lists">
                  {speaking.strengths?.length ? (
                    <div className="pt-3d pt-3d--green">
                      <h3>Điểm mạnh</h3>
                      <ul>
                        {speaking.strengths.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {speaking.improvements?.length ? (
                    <div className="pt-3d pt-3d--blue">
                      <h3>Cần cải thiện</h3>
                      <ul>
                        {speaking.improvements.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </section>

        <section className="pt-review pt-rise" style={{ '--d': 3 }}>
          <h2 className="pt-section-title">Đáp án chi tiết</h2>
          {skills
            .filter((item) => item.id === 'listening' || item.id === 'reading')
            .map((item) => (
              <div key={item.id} className="pt-review__skill">
                <h3>{item.title}</h3>
                {item.parts.map((reviewPart) => (
                  <div key={reviewPart.id} className="pt-review__part">
                    <h4>
                      {reviewPart.title} <span>câu {reviewPart.range}</span>
                    </h4>
                    <div className="pt-review__grid">
                      {partQuestions(reviewPart).map((question) => {
                        const normalized = normalizedById[question.id];
                        const answer = answers[question.id];
                        const correct = scoreExamQuestion(normalized, answer).score === 1;
                        return (
                          <div key={question.id} className={`pt-review__cell ${correct ? 'is-correct' : 'is-wrong'}`}>
                            <span className="pt-review__num">{question.number}</span>
                            <div className="pt-review__text">
                              <span className="pt-review__answer">
                                <span className="pt-review__mark" aria-label={correct ? 'Đúng' : 'Sai'}>
                                  {correct ? '✓' : '✗'}
                                </span>{' '}
                                {formatAnswerForReview(normalized, answer)}
                              </span>
                              {!correct ? (
                                <span className="pt-review__key">
                                  Đáp án:{' '}
                                  {normalized.type === 'fill_blank' ? normalized.correctAnswer : formatCorrectAnswer(normalized)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
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

  // ─── Nghỉ giữa hai phần ─────────────────────────────────────────────────────
  if (phase === 'break') {
    const breakDetail =
      skill.id === 'speaking'
        ? `Part 1, 2, 3 · trả lời bằng giọng nói qua micro · ${skill.durationMinutes} phút. Cần tai nghe có micro và chỗ yên tĩnh.`
        : skill.id === 'writing'
        ? `Task 1 + Task 2 · gõ bài trực tiếp · ${skill.durationMinutes} phút`
        : `${skill.parts.length} ${skill.id === 'reading' ? 'bài đọc' : 'phần'} · 40 câu · ${skill.durationMinutes} phút`;
    return (
      <div className="pt-result pt-break">
        <div className="pt-break__card pt-3d pt-rise" style={{ '--d': 0 }}>
          <p className="pt-kicker">
            Đã nộp phần {skillIndex}/{skills.length}
          </p>
          <h1 className="pt-result__title">Tiếp theo: {skill.title}</h1>
          <p className="pt-break__detail">{breakDetail}</p>
          <p className="pt-break__hint">Nghỉ một chút nếu cần — đồng hồ chỉ bắt đầu khi bạn bấm nút bên dưới.</p>
          <button type="button" className="pt-btn pt-btn--primary pt-btn--block" onClick={startNextSkill}>
            Bắt đầu {skill.title}
          </button>
        </div>
      </div>
    );
  }

  // ─── Phòng thi ──────────────────────────────────────────────────────────────
  const isWriting = skill.id === 'writing';
  const isSpeaking = skill.id === 'speaking';
  const answeredFn = isSpeaking ? isSpeakingAnswered : isAnswered;
  // Writing: mỗi Task tính là một "câu" (đã làm = có chữ). Speaking: mỗi câu hỏi nói.
  const allSkillQuestions = isWriting
    ? skill.parts.map((item, index) => ({ question: { id: item.id, number: item.title }, partIndex: index }))
    : isSpeaking
      ? skill.parts.flatMap((item, index) => item.speaking.questions.map((question) => ({ question, partIndex: index })))
      : skill.parts.flatMap((item, index) => partQuestions(item).map((question) => ({ question, partIndex: index })));
  const answeredCount = allSkillQuestions.filter(({ question }) => answeredFn(answers[question.id])).length;
  const speakingDoneIn = (item) => item.speaking.questions.filter((question) => isSpeakingAnswered(answers[question.id])).length;
  const lowTime = remainingSeconds <= 300;
  const hasPassage = Boolean(part.passage || part.writing);

  return (
    <div className={`ptest-room ${hasPassage ? 'ptest-room--split' : ''}`}>
      <header className="ptest-bar">
        <div className="ptest-bar__title">
          <strong>{skill.title}</strong>
          <span>
            Phần {skillIndex + 1}/{skills.length} ·{' '}
            {isWriting
              ? skill.parts.map((item) => `${item.title}: ${countWords(answers[item.id])} từ`).join(' · ')
              : `${answeredCount}/${allSkillQuestions.length} câu đã ${isSpeaking ? 'trả lời' : 'làm'}`}
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
          {isLastSkill ? 'Nộp bài' : 'Nộp phần này'}
        </button>
      </header>

      {skill.audioUrl ? (
        <div className="ptest-audio">
          <ListeningAudio src={skill.audioUrl} label="Listening" />
        </div>
      ) : null}

      {resumed ? (
        <p className="ptest-note" role="status">
          Đã khôi phục bài làm đang dở. Đồng hồ vẫn chạy trong lúc bạn rời đi.
        </p>
      ) : null}

      <nav className="ptest-tabs" aria-label="Chọn phần">
        {skill.parts.map((item, index) => {
          const questions = partQuestions(item);
          const done = questions.filter((question) => isAnswered(answers[question.id])).length;
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
                {item.writing
                  ? `${countWords(answers[item.id])}/${item.minWords} từ`
                  : item.speaking
                    ? `${speakingDoneIn(item)}/${item.speaking.questions.length}`
                    : `${done}/${questions.length}`}
              </span>
            </button>
          );
        })}
      </nav>

      {hasPassage ? (
        <div className="ptest-pane-switch" role="tablist" aria-label="Chuyển giữa bài đọc và câu hỏi">
          <button
            type="button"
            role="tab"
            aria-selected={mobilePane === 'passage'}
            className={mobilePane === 'passage' ? 'is-active' : ''}
            onClick={() => setMobilePane('passage')}
          >
            {isWriting ? 'Đề bài' : 'Bài đọc'}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobilePane === 'questions'}
            className={mobilePane === 'questions' ? 'is-active' : ''}
            onClick={() => setMobilePane('questions')}
          >
            {isWriting ? 'Bài viết' : `Câu hỏi ${part.range}`}
          </button>
        </div>
      ) : null}

      <div className={`ptest-body show-${mobilePane}`}>
        {hasPassage ? (
          <div className="ptest-body__passage">
            {part.writing ? <WritingPrompt part={part} /> : <Passage passage={part.passage} partTitle={part.title} />}
          </div>
        ) : null}
        <div className="ptest-body__questions" ref={questionsRef}>
          {part.writing ? (
            <WritingEditor part={part} value={answers[part.id]} onChange={(value) => setAnswer(part.id, value)} />
          ) : null}
          {part.speaking ? (
            <SpeakingPart
              part={part}
              answers={answers}
              onAnswer={setAnswer}
              isLastPart={partIndex >= skill.parts.length - 1}
              onFinishPart={() => (partIndex < skill.parts.length - 1 ? goToPart(partIndex + 1) : setConfirmOpen(true))}
            />
          ) : null}
          {part.groups.map((group) => (
            <QuestionGroup key={group.title} group={group} answers={answers} setAnswer={setAnswer} />
          ))}
          {part.speaking ? null : partIndex < skill.parts.length - 1 ? (
            <button type="button" className="button-ghost ptest-next" onClick={() => goToPart(partIndex + 1)}>
              Sang {skill.parts[partIndex + 1].title} →
            </button>
          ) : (
            <button type="button" className="button ptest-next" onClick={() => setConfirmOpen(true)}>
              {isLastSkill ? 'Nộp bài' : 'Nộp phần này'}
            </button>
          )}
        </div>
      </div>

      <footer className="ptest-nav" aria-label="Danh sách câu hỏi">
        {isSpeaking
          ? skill.parts.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`ptest-nav__chip ptest-nav__chip--task ${index === partIndex ? 'is-active' : ''}`}
                onClick={() => goToPart(index)}
              >
                {item.title} <span>{speakingDoneIn(item)}/{item.speaking.questions.length} câu</span>
              </button>
            ))
          : isWriting
          ? skill.parts.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`ptest-nav__chip ptest-nav__chip--task ${index === partIndex ? 'is-active' : ''}`}
                onClick={() => goToPart(index)}
              >
                {item.title} <span>{countWords(answers[item.id])}/{item.minWords} từ</span>
              </button>
            ))
          : skill.parts.map((item, index) => {
          const questions = partQuestions(item);
          const done = questions.filter((question) => isAnswered(answers[question.id])).length;
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
                {questions.map((question) => (
                  <button
                    key={question.id}
                    type="button"
                    className={`ptest-nav__num ${isAnswered(answers[question.id]) ? 'is-answered' : ''}`}
                    aria-label={`Câu ${question.number}${isAnswered(answers[question.id]) ? ' (đã làm)' : ''}`}
                    onClick={() => jumpToQuestion(index, question.id)}
                  >
                    {question.number}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </footer>

      {confirmOpen ? (
        <ExamDialog
          title={isLastSkill ? 'Nộp bài test?' : `Nộp phần ${skill.title}?`}
          cancelLabel="Làm tiếp"
          confirmLabel={isLastSkill ? 'Nộp bài' : 'Nộp phần này'}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={endSkill}
        >
          <p>
            {isSpeaking
              ? `Bạn đã trả lời ${answeredCount}/${allSkillQuestions.length} câu. Phần Speaking sẽ được chấm ngay sau khi nộp.`
              : isWriting
              ? `Task 1: ${countWords(answers['w-task1'])} từ · Task 2: ${countWords(answers['w-task2'])} từ. Bài viết sẽ được chấm ngay sau khi nộp.`
              : `Bạn đã làm ${answeredCount}/${allSkillQuestions.length} câu.${
                  answeredCount < allSkillQuestions.length ? ' Câu bỏ trống sẽ không được tính điểm.' : ''
                }`}{' '}
            Không thể quay lại phần đã nộp.
          </p>
        </ExamDialog>
      ) : null}
    </div>
  );
}
