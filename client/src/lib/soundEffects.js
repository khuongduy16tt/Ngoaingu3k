// Âm thanh cho phần flashcard, tổng hợp bằng Web Audio API thay vì file mp3:
// không thêm asset nào vào bundle, không phụ thuộc mạng, và đổi được cao độ /
// độ dài ngay trong code.
//
// Mọi hàm ở đây phải im lặng chịu lỗi: jsdom (khi chạy test) không có
// AudioContext, và trình duyệt chặn phát âm cho tới khi người dùng tương tác.

const MUTE_STORAGE_KEY = 'flashcard-sound-muted-v1';
const MUTE_CHANGE_EVENT = 'ngoaingu3k:flashcard-sound';

let audioContext = null;

export function isSoundMuted() {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSoundMuted(muted) {
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0');
  } catch {
    // Bỏ qua khi trình duyệt chặn localStorage.
  }
  try {
    window.dispatchEvent(new CustomEvent(MUTE_CHANGE_EVENT, { detail: Boolean(muted) }));
  } catch {
    // Bỏ qua ở môi trường không có window.
  }
}

export function onSoundMutedChange(handler) {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const listener = (event) => handler(Boolean(event.detail));
  window.addEventListener(MUTE_CHANGE_EVENT, listener);
  return () => window.removeEventListener(MUTE_CHANGE_EVENT, listener);
}

// Tạo AudioContext trễ, đúng lúc phát tiếng đầu tiên — tạo sớm khi tải trang sẽ
// bị trình duyệt cho vào trạng thái suspended.
function getContext() {
  if (isSoundMuted()) {
    return null;
  }

  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) {
      return null;
    }

    if (!audioContext) {
      audioContext = new Ctor();
    }

    if (audioContext.state === 'suspended') {
      void audioContext.resume();
    }

    return audioContext;
  } catch {
    return null;
  }
}

// Một nốt: dao động + đường bao âm lượng dạng tắt dần.
function playTone(ctx, { freq, endFreq, start = 0, duration = 0.2, gain = 0.12, type = 'sine' }) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  const at = ctx.currentTime + start;

  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (endFreq && endFreq !== freq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), at + duration);
  }

  // Vào nhanh, tắt dần theo hàm mũ — nghe gọn, không bị "cạch" ở đầu và cuối.
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  osc.connect(amp).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

// Tiếng nổ / tiếng xé gió: nhiễu trắng qua bộ lọc, tắt nhanh.
function playNoise(ctx, { start = 0, duration = 0.25, gain = 0.1, filterFreq = 1200, filterType = 'bandpass' }) {
  const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    // Nhiễu giảm dần theo thời gian để nghe như tiếng nổ tắt, không phải tiếng rít đều.
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  }

  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const amp = ctx.createGain();
  const at = ctx.currentTime + start;

  source.buffer = buffer;
  filter.type = filterType;
  filter.frequency.setValueAtTime(filterFreq, at);
  amp.gain.setValueAtTime(gain, at);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  source.connect(filter).connect(amp).connect(ctx.destination);
  source.start(at);
  source.stop(at + duration + 0.02);
}

// Lật thẻ: tiếng xé gió rất ngắn, đủ để cảm nhận chứ không gây mệt khi lật liên tục.
export function playFlipSound() {
  const ctx = getContext();
  if (!ctx) return;
  playNoise(ctx, { duration: 0.09, gain: 0.05, filterFreq: 900, filterType: 'highpass' });
}

// Trả lời đúng: hai nốt đi lên.
export function playCorrectSound() {
  const ctx = getContext();
  if (!ctx) return;
  playTone(ctx, { freq: 587.33, duration: 0.12, gain: 0.1 });
  playTone(ctx, { freq: 880, start: 0.09, duration: 0.18, gain: 0.09 });
}

// Trả lời sai: một nốt trầm đi xuống, nhẹ — không phải tiếng "sai" gay gắt.
export function playWrongSound() {
  const ctx = getContext();
  if (!ctx) return;
  playTone(ctx, { freq: 220, endFreq: 150, duration: 0.24, gain: 0.07, type: 'triangle' });
}

/**
 * Hoàn thành cả bộ thẻ: pháo hoa.
 * Mỗi quả gồm tiếng rít bay lên rồi tiếng nổ; bắn 5 quả lệch nhau, kết bằng hợp
 * âm trưởng để nghe như "xong rồi" chứ không chỉ là tiếng nổ rời rạc.
 */
export function playFireworksSound() {
  const ctx = getContext();
  if (!ctx) return;

  const launches = [0, 0.28, 0.52, 0.83, 1.05];

  launches.forEach((start, index) => {
    // Rít bay lên.
    playTone(ctx, {
      freq: 320 + index * 40,
      endFreq: 1250 + index * 90,
      start,
      duration: 0.2,
      gain: 0.045,
      type: 'sine'
    });
    // Nổ.
    playNoise(ctx, { start: start + 0.2, duration: 0.42, gain: 0.11, filterFreq: 1500 + index * 250 });
    playNoise(ctx, { start: start + 0.24, duration: 0.28, gain: 0.06, filterFreq: 480, filterType: 'lowpass' });
  });

  // Hợp âm kết (D major: D5 – F#5 – A5).
  [587.33, 739.99, 880].forEach((freq, index) => {
    playTone(ctx, { freq, start: 1.32 + index * 0.05, duration: 0.75, gain: 0.075, type: 'sine' });
  });
}
