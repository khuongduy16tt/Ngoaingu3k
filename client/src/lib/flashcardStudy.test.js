import { describe, it, expect } from 'vitest';
import {
  applyAnswer,
  buildLearnQueue,
  buildLearnQuestion,
  buildMatchBoard,
  buildTest,
  createEmptyProgress,
  gradeTest,
  gradeTestQuestion,
  isMatchPair,
  isWrittenAnswerCorrect,
  MASTERY_STREAK,
  pickDistractors,
  seededShuffle,
  summarizeProgress
} from './flashcardStudy';

const cards = [
  { id: 'c1', term: '你好', definition: 'xin chào' },
  { id: 'c2', term: '谢谢', definition: 'cảm ơn' },
  { id: 'c3', term: '再见', definition: 'tạm biệt' },
  { id: 'c4', term: '对不起', definition: 'xin lỗi' },
  { id: 'c5', term: '请', definition: 'mời' },
  { id: 'c6', term: '是', definition: 'là' }
];

describe('seededShuffle', () => {
  it('giữ nguyên phần tử, cùng seed cho cùng thứ tự', () => {
    const a = seededShuffle(cards, 7);
    const b = seededShuffle(cards, 7);
    expect(a.map((c) => c.id).sort()).toEqual(cards.map((c) => c.id).sort());
    expect(a).toEqual(b);
  });

  it('seed khác cho thứ tự khác', () => {
    expect(seededShuffle(cards, 1)).not.toEqual(seededShuffle(cards, 999));
  });
});

describe('tiến độ từng thẻ', () => {
  it('đúng liên tiếp đủ ngưỡng thì thành đã thuộc', () => {
    let progress = createEmptyProgress(cards);
    for (let i = 0; i < MASTERY_STREAK; i += 1) {
      progress = applyAnswer(progress, 'c1', true);
    }
    expect(progress.c1.mastered).toBe(true);
  });

  it('sai thì reset chuỗi đúng và cộng số lần sai', () => {
    let progress = applyAnswer(createEmptyProgress(cards), 'c1', true);
    progress = applyAnswer(progress, 'c1', false);
    expect(progress.c1.correctStreak).toBe(0);
    expect(progress.c1.wrongCount).toBe(1);
    expect(progress.c1.mastered).toBe(false);
  });

  it('đếm đúng số thẻ đã thuộc / đang học / chưa đụng', () => {
    let progress = createEmptyProgress(cards);
    progress = applyAnswer(progress, 'c1', true);
    progress = applyAnswer(progress, 'c1', true);
    progress = applyAnswer(progress, 'c2', false);

    expect(summarizeProgress(cards, progress)).toEqual({
      mastered: 1,
      learning: 1,
      untouched: 4,
      total: 6
    });
  });
});

describe('pickDistractors', () => {
  it('không lấy chính thẻ đang hỏi và không trùng nội dung', () => {
    const distractors = pickDistractors(cards, cards[0], 3, 5);
    expect(distractors).toHaveLength(3);
    expect(distractors.map((c) => c.id)).not.toContain('c1');
    const texts = distractors.map((c) => c.definition);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('loại thẻ có định nghĩa trùng đáp án đúng', () => {
    const dup = [...cards, { id: 'dup', term: 'x', definition: 'Xin Chào' }];
    const distractors = pickDistractors(dup, cards[0], 5, 3);
    expect(distractors.map((c) => c.id)).not.toContain('dup');
  });

  it('bộ thẻ ít hơn số nhiễu yêu cầu thì trả về tối đa có thể', () => {
    expect(pickDistractors(cards.slice(0, 2), cards[0], 3, 1)).toHaveLength(1);
  });
});

describe('chế độ Learn', () => {
  it('bỏ thẻ đã thuộc ra khỏi hàng đợi', () => {
    let progress = createEmptyProgress(cards);
    progress = applyAnswer(progress, 'c1', true);
    progress = applyAnswer(progress, 'c1', true);
    expect(buildLearnQueue(cards, progress).map((c) => c.id)).not.toContain('c1');
  });

  it('trả rỗng khi đã thuộc hết', () => {
    let progress = createEmptyProgress(cards);
    cards.forEach((card) => {
      progress = applyAnswer(progress, card.id, true);
      progress = applyAnswer(progress, card.id, true);
    });
    expect(buildLearnQueue(cards, progress)).toHaveLength(0);
  });

  it('thẻ chưa đụng tới đứng trước thẻ đang học', () => {
    const progress = applyAnswer(createEmptyProgress(cards), 'c6', false);
    const queue = buildLearnQueue(cards, progress, 3);
    expect(queue[queue.length - 1].id).toBe('c6');
  });

  it('trong nhóm đang học, thẻ sai nhiều hơn lên trước', () => {
    let progress = createEmptyProgress(cards);
    progress = applyAnswer(progress, 'c1', false);
    progress = applyAnswer(progress, 'c2', false);
    progress = applyAnswer(progress, 'c2', false);

    const learning = buildLearnQueue(cards, progress, 1).filter((c) => ['c1', 'c2'].includes(c.id));
    expect(learning[0].id).toBe('c2');
  });

  it('thẻ mới hỏi trắc nghiệm, thẻ từng đúng thì bắt gõ lại', () => {
    const fresh = buildLearnQuestion(cards[0], cards, createEmptyProgress(cards), 2);
    expect(fresh.kind).toBe('choice');
    expect(fresh.options).toHaveLength(4);
    expect(fresh.options.map((o) => o.id)).toContain('c1');

    const progress = applyAnswer(createEmptyProgress(cards), 'c1', true);
    expect(buildLearnQuestion(cards[0], cards, progress, 2).kind).toBe('written');
  });
});

describe('so khớp câu trả lời gõ tay', () => {
  it('bỏ qua hoa thường, dấu câu và khoảng trắng thừa', () => {
    expect(isWrittenAnswerCorrect(cards[0], 'Xin chào')).toBe(true);
    expect(isWrittenAnswerCorrect(cards[0], '  xin  chào.  ')).toBe(true);
  });

  it('sai vẫn là sai, rỗng không được tính đúng', () => {
    expect(isWrittenAnswerCorrect(cards[0], 'tạm biệt')).toBe(false);
    expect(isWrittenAnswerCorrect(cards[0], '')).toBe(false);
  });
});

describe('chế độ Kiểm tra', () => {
  it('sinh đúng số câu và rải đều các dạng đã bật', () => {
    const test = buildTest(cards, { length: 6, seed: 4 });
    expect(test).toHaveLength(6);
    const kinds = new Set(test.map((q) => q.kind));
    expect(kinds).toEqual(new Set(['choice', 'true_false', 'written']));
  });

  it('chỉ dùng dạng câu được bật', () => {
    const test = buildTest(cards, { length: 4, kinds: ['written'], seed: 1 });
    expect(test.every((q) => q.kind === 'written')).toBe(true);
  });

  it('không sinh nhiều câu hơn số thẻ có', () => {
    expect(buildTest(cards.slice(0, 3), { length: 20, seed: 1 })).toHaveLength(3);
  });

  it('chấm đúng cả ba dạng câu', () => {
    const choice = buildTest(cards, { length: 1, kinds: ['choice'], seed: 2 })[0];
    expect(gradeTestQuestion(choice, choice.card.id)).toBe(true);
    expect(gradeTestQuestion(choice, 'sai-id')).toBe(false);

    const tf = buildTest(cards, { length: 1, kinds: ['true_false'], seed: 2 })[0];
    expect(gradeTestQuestion(tf, tf.expected)).toBe(true);
    expect(gradeTestQuestion(tf, tf.expected === 'true' ? 'false' : 'true')).toBe(false);

    const written = buildTest(cards, { length: 1, kinds: ['written'], seed: 2 })[0];
    expect(gradeTestQuestion(written, written.card.definition)).toBe(true);
  });

  it('câu đúng/sai hiện định nghĩa khớp với đáp án mong đợi', () => {
    buildTest(cards, { length: 6, kinds: ['true_false'], seed: 9 }).forEach((q) => {
      if (q.expected === 'true') {
        expect(q.shownDefinition).toBe(q.card.definition);
      } else {
        expect(q.shownDefinition).not.toBe(q.card.definition);
      }
    });
  });

  it('tổng điểm cộng đúng', () => {
    const test = buildTest(cards, { length: 3, kinds: ['choice'], seed: 6 });
    const answers = { [test[0].id]: test[0].card.id, [test[1].id]: 'sai' };
    expect(gradeTest(test, answers)).toEqual({ correct: 1, total: 3 });
  });
});

describe('chế độ Ghép cặp', () => {
  it('mỗi thẻ ra hai ô, tổng ô gấp đôi số cặp', () => {
    const board = buildMatchBoard(cards, { pairs: 4, seed: 8 });
    expect(board.pairCount).toBe(4);
    expect(board.tiles).toHaveLength(8);
    expect(board.tiles.filter((t) => t.side === 'term')).toHaveLength(4);
  });

  it('không lấy nhiều cặp hơn số thẻ có', () => {
    expect(buildMatchBoard(cards.slice(0, 3), { pairs: 6, seed: 1 }).pairCount).toBe(3);
  });

  it('chỉ nhận ghép thuật ngữ với định nghĩa của cùng một thẻ', () => {
    const { tiles } = buildMatchBoard(cards, { pairs: 6, seed: 2 });
    const term = tiles.find((t) => t.cardId === 'c1' && t.side === 'term');
    const def = tiles.find((t) => t.cardId === 'c1' && t.side === 'definition');
    const otherDef = tiles.find((t) => t.cardId === 'c2' && t.side === 'definition');

    expect(isMatchPair(term, def)).toBe(true);
    expect(isMatchPair(term, otherDef)).toBe(false);
    expect(isMatchPair(term, term)).toBe(false);
  });
});
