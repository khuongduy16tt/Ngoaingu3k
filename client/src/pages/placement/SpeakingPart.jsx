import React, { useEffect, useRef, useState } from 'react';

// Một phần thi Speaking (Part 1/2/3) của bài test /test.
// Câu hỏi được đọc to (giọng đọc của trình duyệt); học viên bấm "Bắt đầu nói",
// trình duyệt chuyển giọng nói thành chữ ngay lúc nói. Mỗi câu trả lời lưu
// { text, seconds, confidence } để server chấm.

export function getSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isSpeakingAnswered(answer) {
  return Boolean(answer && String(answer.text || '').trim());
}

// Safari (máy Mac và mọi trình duyệt trên iPhone) — cần hướng dẫn quyền micro riêng.
function isSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) || (/Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg|Android/i.test(ua));
}

function formatSeconds(total) {
  const safe = Math.max(0, Math.ceil(total));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

function speakQuestion(text) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';
    utterance.rate = 0.95;
    const voice = synth.getVoices().find((item) => /^en(-|_)(GB|US)/i.test(item.lang));
    if (voice) utterance.voice = voice;
    synth.speak(utterance);
  } catch {
    // Không đọc được thì học viên vẫn đọc câu hỏi trên màn hình.
  }
}

export function SpeakingPart({ part, answers, onAnswer, onFinishPart, isLastPart }) {
  const questions = part.speaking.questions;
  const isCueCard = part.speaking.kind === 'cue-card';
  const firstOpen = Math.max(0, questions.findIndex((question) => !isSpeakingAnswered(answers[question.id])));
  const [index, setIndex] = useState(firstOpen === -1 ? 0 : firstOpen);
  const [status, setStatus] = useState('idle'); // idle | prep | recording
  const [prepLeft, setPrepLeft] = useState(part.speaking.prepSeconds || 0);
  const [elapsed, setElapsed] = useState(0);
  const [liveText, setLiveText] = useState('');
  const [error, setError] = useState('');

  const question = questions[index];
  const saved = answers[question.id];
  // Mỗi câu trả lời là một "phiên" (session); trong phiên có thể có nhiều lượt
  // nhận dạng (run) vì trình duyệt tự ngắt sau khoảng lặng rồi web bật lại.
  // - Safari chỉ cho bật micro NGAY TRONG cú bấm của người dùng → luôn bật lượt
  //   mới trực tiếp trong onClick, không chờ lượt cũ tắt.
  // - Chrome chỉ chạy một lượt một lúc → lượt mới bật hụt thì tự thử lại sau 300ms.
  // - Safari gửi lại cả danh sách kết quả từ đầu lượt → mỗi lần ghép lại toàn bộ
  //   chữ của lượt đó (không cộng dồn) để không bị lặp chữ.
  const engineRef = useRef(null);
  const sessionRef = useRef(null);
  const finalizeTimerRef = useRef(null);
  const onAnswerRef = useRef(onAnswer);
  onAnswerRef.current = onAnswer;
  const answersRef = useRef(answers);
  answersRef.current = answers;

  // Đổi phần (Part) thì về câu chưa làm đầu tiên.
  useEffect(() => {
    const open = questions.findIndex((item) => !isSpeakingAnswered(answers[item.id]));
    setIndex(open === -1 ? 0 : open);
    setStatus('idle');
    setPrepLeft(part.speaking.prepSeconds || 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [part.id]);

  // Đọc to câu hỏi khi chuyển câu (Part 2 đọc đề thẻ).
  useEffect(() => {
    if (status === 'idle' && !isSpeakingAnswered(saved)) {
      speakQuestion(isCueCard ? part.speaking.card.topic : question.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  // Rời màn: lưu câu đang nói dở, tắt hẳn micro và giọng đọc.
  useEffect(
    () => () => {
      if (sessionRef.current) finalize(sessionRef.current);
      abortEngine();
      try {
        window.speechSynthesis?.cancel();
      } catch {
        // ignore
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Đồng hồ chuẩn bị (Part 2).
  useEffect(() => {
    if (status !== 'prep') return undefined;
    if (prepLeft <= 0) {
      if (isSafari()) {
        setStatus('ready');
      } else {
        startRecording();
      }
      return undefined;
    }
    const id = setTimeout(() => setPrepLeft((value) => value - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, prepLeft]);

  // Đồng hồ khi đang nói; hết giờ thì tự dừng.
  useEffect(() => {
    if (status !== 'recording') return undefined;
    const id = setInterval(() => {
      const session = sessionRef.current;
      if (!session || session.stopping) return;
      const seconds = (Date.now() - session.startedAt) / 1000;
      setElapsed(seconds);
      if (seconds >= session.maxSeconds) stopRecording();
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, question.id]);

  function sessionText(session) {
    return session.runs
      .map((run) => run.text)
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function abortEngine() {
    const run = engineRef.current;
    engineRef.current = null;
    if (!run || run.ended) return;
    run.detached = true;
    try {
      run.rec.abort();
    } catch {
      // ignore
    }
  }

  function startRun(session) {
    const Recognition = getSpeechRecognition();
    if (!Recognition || session.finished) return;
    const rec = new Recognition();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    const run = { rec, started: false, ended: false, detached: false, text: '', confidences: [] };
    session.runs.push(run);

    rec.onstart = () => {
      run.started = true;
    };

    rec.onresult = (event) => {
      if (run.detached || session.finished) return;
      const parts = [];
      const confidences = [];
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = String(result[0]?.transcript || '').trim();
        if (text) parts.push(text);
        if (result.isFinal && typeof result[0].confidence === 'number' && result[0].confidence > 0) {
          confidences.push(result[0].confidence);
        }
      }
      run.text = parts.join(' ');
      run.confidences = confidences;
      if (sessionRef.current === session) setLiveText(sessionText(session));
    };

    rec.onerror = (event) => {
      if (run.detached) return;
      const isRestart = session.runs.some((item) => item !== run && item.started);
      if ((event.error === 'not-allowed' || event.error === 'service-not-allowed') && isRestart) {
        session.autoEnded = true;
      } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        session.blocked = true;
        setError(
          isSafari()
            ? 'Safari chưa cho dùng micro. Vào Cài đặt → Safari → Micrô chọn "Cho phép", và bật Siri / Đọc chính tả, rồi tải lại trang.'
            : 'Bạn chưa cho phép dùng micro. Hãy bấm biểu tượng ổ khoá trên thanh địa chỉ, cho phép micro rồi thử lại.'
        );
      } else if (event.error === 'audio-capture') {
        session.blocked = true;
        setError('Không tìm thấy micro. Hãy cắm tai nghe có micro rồi thử lại.');
      } else if (event.error === 'network') {
        setError('Mất kết nối mạng nên chưa nghe được. Kiểm tra mạng rồi bấm "Nói lại".');
      }
      // 'no-speech' / 'aborted': để onend quyết định bật lại.
    };

    rec.onend = () => {
      run.ended = true;
      if (engineRef.current === run) engineRef.current = null;
      if (run.detached || session.finished) return;
      if (session.stopping || session.blocked || session.autoEnded) {
        session.stoppedAt = session.stoppedAt || Date.now();
        finalize(session);
        if (session.blocked || session.autoEnded) setStatus('idle');
        if (session.autoEnded && sessionText(session)) {
          setError('Đã lưu phần bạn vừa nói. Bấm "Câu tiếp" để sang câu sau, hoặc "Nói lại" nếu muốn trả lời lại.');
        }
        return;
      }
      const seconds = (Date.now() - session.startedAt) / 1000;
      if (seconds >= session.maxSeconds - 0.5) {
        session.stopping = true;
        session.stoppedAt = Date.now();
        finalize(session);
        setStatus('idle');
        return;
      }
      // Còn giờ: trình duyệt tự ngắt (khoảng lặng) hoặc lượt này bật hụt → bật lại.
      if (!run.started) session.failedStarts += 1;
      if (session.failedStarts > 6) {
        finalize(session);
        setStatus('idle');
        setError('Chưa bật được micro. Hãy đóng các tab khác đang dùng micro rồi bấm "Nói lại".');
        return;
      }
      setTimeout(() => {
        if (!session.finished && !session.stopping && sessionRef.current === session) startRun(session);
      }, run.started ? 0 : 300);
    };

    engineRef.current = run;
    try {
      rec.start();
    } catch {
      run.ended = true;
      if (engineRef.current === run) engineRef.current = null;
      session.failedStarts += 1;
      setTimeout(() => {
        if (!session.finished && !session.stopping && sessionRef.current === session) startRun(session);
      }, 300);
    }
  }

  // Lưu câu trả lời của một phiên.
  function finalize(session) {
    if (!session || session.finished) return;
    session.finished = true;
    clearTimeout(finalizeTimerRef.current);
    if (sessionRef.current === session) sessionRef.current = null;
    const text = sessionText(session);
    const confidences = session.runs.flatMap((run) => run.confidences);
    const confidence = confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : 0;
    const seconds = Math.min(session.maxSeconds, ((session.stoppedAt || Date.now()) - session.startedAt) / 1000);
    // Nói lại mà không nghe được gì thì giữ câu trả lời cũ.
    if (text || !isSpeakingAnswered(answersRef.current[session.questionId])) {
      onAnswerRef.current(session.questionId, {
        text,
        seconds: Math.round(seconds),
        confidence: Math.round(confidence * 100) / 100
      });
    }
    if (!sessionRef.current) setLiveText('');
    if (!text && !session.blocked && !sessionRef.current) {
      setError('Chưa nghe được câu trả lời. Hãy nói to, rõ hơn rồi bấm "Nói lại".');
    }
  }

  // Gọi trực tiếp trong cú bấm của người dùng (Safari bắt buộc).
  function startRecording() {
    if (!getSpeechRecognition()) return;
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // ignore
    }
    if (sessionRef.current) finalize(sessionRef.current);
    abortEngine();
    setError('');
    setLiveText('');
    setElapsed(0);
    const session = {
      questionId: question.id,
      maxSeconds: question.seconds,
      startedAt: Date.now(),
      runs: [],
      failedStarts: 0,
      stopping: false,
      finished: false,
      blocked: false
    };
    sessionRef.current = session;
    setStatus('recording');
    startRun(session);
  }

  function stopRecording() {
    const session = sessionRef.current;
    setStatus('idle');
    if (!session || session.stopping) return;
    session.stopping = true;
    session.stoppedAt = Date.now();
    const run = engineRef.current;
    if (!run || run.ended) {
      finalize(session);
      return;
    }
    try {
      run.rec.stop();
    } catch {
      // ignore
    }
    // Chờ trình duyệt trả nốt chữ cuối; Safari đôi khi không báo kết thúc → 1,2 giây thì lưu luôn.
    finalizeTimerRef.current = setTimeout(() => {
      finalize(session);
      // Chỉ tắt đúng lượt nhận dạng của câu này, không đụng tới câu đang nói sau đó.
      if (!run.ended) {
        run.detached = true;
        try {
          run.rec.abort();
        } catch {
          // ignore
        }
      }
      if (engineRef.current === run) engineRef.current = null;
    }, 1200);
  }

  function goTo(nextIndex) {
    if (status === 'recording') stopRecording();
    setError('');
    setLiveText('');
    setIndex(nextIndex);
  }

  const supported = Boolean(getSpeechRecognition());
  const answeredHere = questions.filter((item) => isSpeakingAnswered(answers[item.id])).length;
  const isLastQuestion = index >= questions.length - 1;
  const remaining = question.seconds - elapsed;

  if (!supported) {
    return (
      <section className="ptest-speak">
        <div className="ptest-speak__notice" role="alert">
          <strong>Trình duyệt này chưa hỗ trợ trả lời bằng giọng nói.</strong>
          <p>Hãy mở trang bằng Chrome (máy tính, Android) hoặc Safari (iPhone) để làm phần Speaking.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="ptest-speak">
      <p className="ptest-speak__intro">{part.speaking.intro}</p>

      <div className="ptest-speak__steps" aria-label="Câu hỏi">
        {questions.map((item, itemIndex) => (
          <button
            key={item.id}
            type="button"
            className={`ptest-speak__step ${itemIndex === index ? 'is-current' : ''} ${
              isSpeakingAnswered(answers[item.id]) ? 'is-done' : ''
            }`}
            aria-label={`Câu ${itemIndex + 1}${isSpeakingAnswered(answers[item.id]) ? ' (đã trả lời)' : ''}`}
            onClick={() => goTo(itemIndex)}
          >
            {itemIndex + 1}
          </button>
        ))}
      </div>

      <article className="ptest-speak__card">
        {isCueCard ? (
          <div className="ptest-speak__cue">
            <h3>{part.speaking.card.topic}</h3>
            <p>You should say:</p>
            <ul>
              {part.speaking.card.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <p>{part.speaking.card.ending}</p>
          </div>
        ) : (
          <>
            <span className="ptest-speak__count">
              Câu {index + 1}/{questions.length}
            </span>
            <h3 className="ptest-speak__question">{question.text}</h3>
          </>
        )}

        <button
          type="button"
          className="ptest-speak__listen"
          onClick={() => speakQuestion(isCueCard ? part.speaking.card.topic : question.text)}
          disabled={status === 'recording'}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
          </svg>
          Nghe lại câu hỏi
        </button>

        <div className={`ptest-speak__mic is-${status}`}>
          {status === 'prep' ? (
            <>
              <span className="ptest-speak__clock">{formatSeconds(prepLeft)}</span>
              <p>Thời gian chuẩn bị — ghi chú ý chính ra giấy nếu muốn.</p>
              <button type="button" className="pt-btn pt-btn--primary" onClick={() => startRecording()}>
                Bắt đầu nói ngay
              </button>
            </>
          ) : status === 'ready' ? (
            <>
              <span className="ptest-speak__clock">Hết giờ chuẩn bị</span>
              <button type="button" className="pt-btn pt-btn--primary ptest-speak__start" onClick={() => startRecording()}>
                Bấm để bắt đầu nói
              </button>
            </>
          ) : status === 'recording' ? (
            <>
              <span className="ptest-speak__pulse" aria-hidden="true" />
              <span className="ptest-speak__clock">Còn {formatSeconds(remaining)}</span>
              <button type="button" className="pt-btn pt-btn--primary" onClick={() => stopRecording()}>
                Xong câu này
              </button>
            </>
          ) : (
            <button
              type="button"
              className="pt-btn pt-btn--primary ptest-speak__start"
              onClick={() => (isCueCard && !isSpeakingAnswered(saved) ? setStatus('prep') : startRecording())}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3" />
              </svg>
              {isSpeakingAnswered(saved) ? 'Nói lại' : isCueCard ? 'Bắt đầu 1 phút chuẩn bị' : 'Bắt đầu nói'}
            </button>
          )}
        </div>

        {status === 'recording' || liveText ? (
          <p className="ptest-speak__live" aria-live="polite">
            {liveText || 'Đang nghe…'}
          </p>
        ) : isSpeakingAnswered(saved) ? (
          <p className="ptest-speak__saved">
            <b>Đã ghi câu trả lời</b> ({saved.seconds} giây): {saved.text}
          </p>
        ) : null}

        {error ? (
          <p className="ptest-speak__error" role="alert">
            {error}
          </p>
        ) : null}
      </article>

      <div className="ptest-speak__nav">
        <button type="button" className="button-ghost" onClick={() => goTo(index - 1)} disabled={index === 0}>
          ← Câu trước
        </button>
        <span>
          {answeredHere}/{questions.length} câu đã trả lời
        </span>
        {isLastQuestion ? (
          <button type="button" className="button" onClick={onFinishPart} disabled={status === 'recording'}>
            {isLastPart ? 'Nộp bài' : 'Sang phần tiếp →'}
          </button>
        ) : (
          <button type="button" className="button" onClick={() => goTo(index + 1)}>
            Câu tiếp →
          </button>
        )}
      </div>
    </section>
  );
}
