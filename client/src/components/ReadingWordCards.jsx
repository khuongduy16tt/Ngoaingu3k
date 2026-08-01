import React from 'react';

/**
 * Đọc chữ Hán bằng giọng đọc sẵn có của trình duyệt. Máy không cài giọng tiếng
 * Trung thì im lặng — học viên vẫn nhìn chữ mà đọc được.
 */
export function speakChinese(text) {
  try {
    const synth = window.speechSynthesis;
    if (!synth || !text) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(String(text));
    utterance.lang = 'zh-CN';
    utterance.rate = 0.8;
    const zhVoice = synth.getVoices().find((voice) => /zh|chinese/i.test(`${voice.lang} ${voice.name}`));
    if (zhVoice) utterance.voice = zhVoice;
    synth.speak(utterance);
  } catch {
    // Trình duyệt không hỗ trợ TTS — bỏ qua, học viên vẫn đọc được chữ.
  }
}

export function isSpeechSupported() {
  return typeof window !== 'undefined' && Boolean(window.speechSynthesis);
}

/**
 * Dãy ô luyện đọc: mỗi ô một từ, bấm vào là nghe phát âm. Dùng chung cho khung
 * làm bài của học viên và bản xem trước của giáo viên.
 *
 * @param {Array<{ text: string, pinyin?: string, meaning?: string }>} words
 */
export function ReadingWordCards({ words }) {
  const items = Array.isArray(words) ? words.filter((word) => word?.text) : [];
  const ttsSupported = isSpeechSupported();

  if (!items.length) {
    return <div className="empty-state">Câu này chưa có từ nào để luyện đọc.</div>;
  }

  return (
    <div className="reading-grid">
      {items.map((word, index) => (
        <button
          type="button"
          key={`${word.text}-${index}`}
          className="reading-card"
          onClick={() => speakChinese(word.text)}
          title={`Nghe "${word.text}"`}
        >
          <span className="reading-card__text">{word.text}</span>
          {word.pinyin ? <span className="reading-card__pinyin">{word.pinyin}</span> : null}
          {word.meaning ? <span className="reading-card__meaning">{word.meaning}</span> : null}
          {ttsSupported ? (
            <span className="reading-card__play" aria-hidden="true">
              🔊
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
