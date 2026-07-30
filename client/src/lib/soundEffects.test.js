import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isSoundMuted,
  onSoundMutedChange,
  playCorrectSound,
  playFireworksSound,
  playFlipSound,
  playWrongSound,
  setSoundMuted
} from './soundEffects';

// jsdom không có AudioContext, nên các hàm phát tiếng phải im lặng không làm gì
// chứ không được ném lỗi — nếu ném thì cả phần học flashcard sẽ chết theo.

describe('tắt/bật tiếng', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('mặc định là bật tiếng', () => {
    expect(isSoundMuted()).toBe(false);
  });

  it('ghi nhớ lựa chọn tắt tiếng', () => {
    setSoundMuted(true);
    expect(isSoundMuted()).toBe(true);
    setSoundMuted(false);
    expect(isSoundMuted()).toBe(false);
  });

  it('phát sự kiện để mọi nút tắt tiếng đồng bộ với nhau', () => {
    const seen = [];
    const off = onSoundMutedChange((muted) => seen.push(muted));
    setSoundMuted(true);
    setSoundMuted(false);
    off();
    setSoundMuted(true);
    expect(seen).toEqual([true, false]);
  });
});

describe('phát tiếng khi trình duyệt không hỗ trợ', () => {
  it('không ném lỗi dù thiếu AudioContext (jsdom)', () => {
    expect(() => {
      playFlipSound();
      playCorrectSound();
      playWrongSound();
      playFireworksSound();
    }).not.toThrow();
  });
});

// Module giữ lại một AudioContext dùng chung (cố ý — không tạo context mới mỗi
// lần phát tiếng), nên mỗi test phải nạp lại module để đếm từ đầu.
describe('phát tiếng với AudioContext giả', () => {
  let created;
  let sounds;

  beforeEach(async () => {
    localStorage.clear();
    created = [];
    vi.resetModules();

    class FakeGain {
      constructor() {
        this.gain = {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn()
        };
      }
      connect(next) {
        return next;
      }
    }

    class FakeAudioContext {
      constructor() {
        this.currentTime = 0;
        this.sampleRate = 44100;
        this.state = 'running';
        this.destination = {};
        created.push(this);
      }
      createOscillator() {
        const osc = {
          type: 'sine',
          frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: (next) => next,
          start: vi.fn(),
          stop: vi.fn()
        };
        this.lastOscillator = osc;
        (this.oscillators = this.oscillators || []).push(osc);
        return osc;
      }
      createGain() {
        return new FakeGain();
      }
      createBiquadFilter() {
        return { type: 'bandpass', frequency: { setValueAtTime: vi.fn() }, connect: (next) => next };
      }
      createBuffer(channels, length) {
        return { getChannelData: () => new Float32Array(length) };
      }
      createBufferSource() {
        const src = { buffer: null, connect: (next) => next, start: vi.fn(), stop: vi.fn() };
        (this.sources = this.sources || []).push(src);
        return src;
      }
      resume() {
        return Promise.resolve();
      }
    }

    window.AudioContext = FakeAudioContext;
    sounds = await import('./soundEffects');
  });

  afterEach(() => {
    delete window.AudioContext;
  });

  it('tiếng trả lời đúng dùng hai nốt', () => {
    sounds.playCorrectSound();
    expect(created).toHaveLength(1);
    expect(created[0].oscillators).toHaveLength(2);
  });

  it('pháo hoa bắn nhiều quả kèm hợp âm kết', () => {
    sounds.playFireworksSound();
    const ctx = created[0];
    // 5 tiếng rít + 3 nốt hợp âm
    expect(ctx.oscillators).toHaveLength(8);
    // mỗi quả 2 lớp tiếng nổ
    expect(ctx.sources).toHaveLength(10);
  });

  it('tắt tiếng thì không tạo AudioContext nào', () => {
    sounds.setSoundMuted(true);
    sounds.playCorrectSound();
    sounds.playFireworksSound();
    expect(created).toHaveLength(0);
  });

  it('dùng lại một AudioContext cho nhiều lần phát', () => {
    sounds.playFlipSound();
    sounds.playCorrectSound();
    sounds.playWrongSound();
    expect(created).toHaveLength(1);
  });
});
