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
  const recognitionRef = useRef(null);
  const sessionRef = useRef(null);

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

  // Dừng ghi và tắt giọng đọc khi rời màn.
  useEffect(
    () => () => {
      stopRecognition(false);
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
      startRecording();
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
      if (!session) return;
      const seconds = (Date.now() - session.startedAt) / 1000;
      setElapsed(seconds);
      if (seconds >= question.seconds) stopRecognition(true);
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, question.id]);

  function startRecording() {
    const Recognition = getSpeechRecognition();
    if (!Recognition) return;
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // ignore
    }
    setError('');
    setLiveText('');
    setElapsed(0);
    sessionRef.current = { startedAt: Date.now(), finals: [], confidences: [], interim: '', active: true, questionId: question.id };
    startEngine(Recognition);
    setStatus('recording');
  }

  // Trình duyệt hay tự ngắt nhận dạng sau một khoảng lặng: còn giờ thì bật lại.
  function startEngine(Recognition) {
    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const session = sessionRef.current;
      if (!session) return;
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          session.finals.push(result[0].transcript.trim());
          if (typeof result[0].confidence === 'number' && result[0].confidence > 0) {
            session.confidences.push(result[0].confidence);
          }
        } else {
          interim += result[0].transcript;
        }
      }
      session.interim = interim;
      setLiveText([...session.finals, interim.trim()].filter(Boolean).join(' '));
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('Bạn chưa cho phép dùng micro. Hãy bấm biểu tượng ổ khoá trên thanh địa chỉ, cho phép micro rồi thử lại.');
        stopRecognition(false);
      } else if (event.error === 'audio-capture') {
        setError('Không tìm thấy micro. Hãy cắm tai nghe có micro rồi thử lại.');
        stopRecognition(false);
      }
      // 'no-speech' / 'aborted' / 'network': để onend tự bật lại khi còn giờ.
    };

    recognition.onend = () => {
      const session = sessionRef.current;
      if (session?.active && (Date.now() - session.startedAt) / 1000 < question.seconds - 1) {
        try {
          startEngine(Recognition);
        } catch {
          stopRecognition(true);
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      // start() hai lần liên tiếp sẽ ném lỗi — bỏ qua.
    }
  }

  function stopRecognition(save) {
    const session = sessionRef.current;
    if (session) session.active = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    recognitionRef.current = null;
    if (save && session) {
      const text = [...session.finals, session.interim.trim()].filter(Boolean).join(' ').trim();
      const seconds = Math.min(question.seconds, Math.round((Date.now() - session.startedAt) / 1000));
      const confidence = session.confidences.length
        ? session.confidences.reduce((sum, value) => sum + value, 0) / session.confidences.length
        : 0;
      onAnswer(session.questionId, { text, seconds, confidence: Math.round(confidence * 100) / 100 });
      setLiveText('');
      if (!text) setError('Chưa nghe được câu trả lời. Hãy nói to, rõ hơn rồi bấm "Nói lại".');
    }
    sessionRef.current = null;
    setStatus('idle');
  }

  function goTo(nextIndex) {
    if (status === 'recording') stopRecognition(true);
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
              <button type="button" className="pt-btn pt-btn--primary" onClick={() => setPrepLeft(0)}>
                Bắt đầu nói ngay
              </button>
            </>
          ) : status === 'recording' ? (
            <>
              <span className="ptest-speak__pulse" aria-hidden="true" />
              <span className="ptest-speak__clock">Còn {formatSeconds(remaining)}</span>
              <button type="button" className="pt-btn pt-btn--primary" onClick={() => stopRecognition(true)}>
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
