// Logic thuần của 4 chế độ học flashcard (Flashcards / Learn / Test / Match),
// tách khỏi UI để test được: trộn thẻ, chọn đáp án nhiễu, xếp hàng đợi cho chế
// độ Learn, sinh đề cho Test và chấm điểm.

export const STUDY_MODES = [
  { value: 'flashcards', label: 'Thẻ ghi nhớ' },
  { value: 'learn', label: 'Học' },
  { value: 'test', label: 'Kiểm tra' },
  { value: 'match', label: 'Ghép cặp' }
];

// Số lần trả lời đúng liên tiếp để coi là đã thuộc (Quizlet cũng dùng 2 mức:
// nhận diện bằng trắc nghiệm rồi tự gõ lại).
export const MASTERY_STREAK = 2;
export const MATCH_PAIR_COUNT = 6;

// Trộn ổn định theo seed: cùng seed cho cùng thứ tự, nên React re-render không
// làm nhảy thứ tự thẻ, mà đổi seed thì ra bộ mới.
export function seededShuffle(items, seed = 1) {
  let value = Number(seed) || 1;
  const next = () => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value / 2147483648;
  };

  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createEmptyProgress(cards = []) {
  return cards.reduce((map, card) => {
    map[card.id] = { correctStreak: 0, wrongCount: 0, mastered: false };
    return map;
  }, {});
}

export function getCardProgress(progress, cardId) {
  return progress?.[cardId] || { correctStreak: 0, wrongCount: 0, mastered: false };
}

export function summarizeProgress(cards = [], progress = {}) {
  return cards.reduce(
    (summary, card) => {
      const state = getCardProgress(progress, card.id);
      if (state.mastered) {
        summary.mastered += 1;
      } else if (state.correctStreak > 0 || state.wrongCount > 0) {
        summary.learning += 1;
      } else {
        summary.untouched += 1;
      }
      return summary;
    },
    { mastered: 0, learning: 0, untouched: 0, total: cards.length }
  );
}

/**
 * Cập nhật tiến độ một thẻ sau khi trả lời.
 * Sai thì reset chuỗi đúng về 0 — phải làm đúng lại từ đầu mới được tính thuộc.
 */
export function applyAnswer(progress, cardId, isCorrect) {
  const current = getCardProgress(progress, cardId);
  const correctStreak = isCorrect ? current.correctStreak + 1 : 0;

  return {
    ...progress,
    [cardId]: {
      correctStreak,
      wrongCount: current.wrongCount + (isCorrect ? 0 : 1),
      mastered: correctStreak >= MASTERY_STREAK
    }
  };
}

// Chọn đáp án nhiễu từ định nghĩa của các thẻ khác. Loại trùng nội dung để
// không hiện hai lựa chọn giống hệt nhau khi bộ thẻ có thẻ lặp.
export function pickDistractors(cards, answerCard, count, seed = 1) {
  const seen = new Set([String(answerCard?.definition || '').trim().toLowerCase()]);
  const pool = [];

  seededShuffle(cards, seed).forEach((card) => {
    if (card.id === answerCard?.id) {
      return;
    }
    const key = String(card.definition || '').trim().toLowerCase();
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    pool.push(card);
  });

  return pool.slice(0, count);
}

/**
 * Hàng đợi cho chế độ Learn: thẻ chưa đụng tới trước, rồi tới thẻ đang học (sai
 * nhiều lên trước), thẻ đã thuộc thì bỏ ra. Trả rỗng khi đã thuộc hết.
 */
export function buildLearnQueue(cards = [], progress = {}, seed = 1) {
  const remaining = cards.filter((card) => !getCardProgress(progress, card.id).mastered);

  const untouched = [];
  const learning = [];

  remaining.forEach((card) => {
    const state = getCardProgress(progress, card.id);
    if (state.correctStreak === 0 && state.wrongCount === 0) {
      untouched.push(card);
    } else {
      learning.push(card);
    }
  });

  learning.sort((left, right) => {
    const a = getCardProgress(progress, left.id);
    const b = getCardProgress(progress, right.id);
    return b.wrongCount - a.wrongCount;
  });

  return [...seededShuffle(untouched, seed), ...learning];
}

/**
 * Một câu hỏi của chế độ Learn. Thẻ chưa từng trả lời đúng thì hỏi trắc nghiệm
 * (nhận diện); đã đúng ít nhất một lần thì bắt gõ lại (nhớ chủ động).
 */
export function buildLearnQuestion(card, cards, progress, seed = 1) {
  const state = getCardProgress(progress, card.id);
  const kind = state.correctStreak >= 1 ? 'written' : 'choice';

  if (kind === 'written') {
    return { kind, card, options: [] };
  }

  const distractors = pickDistractors(cards, card, 3, seed);
  return {
    kind,
    card,
    options: seededShuffle([card, ...distractors], seed + 17)
  };
}

// So khớp câu trả lời gõ tay: bỏ hoa/thường, dấu câu và khoảng trắng thừa để
// thiếu một dấu chấm không bị tính sai.
export function normalizeWrittenAnswer(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[.,!?;:"'“”‘’()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isWrittenAnswerCorrect(card, answer) {
  const normalized = normalizeWrittenAnswer(answer);
  return Boolean(normalized) && normalized === normalizeWrittenAnswer(card?.definition);
}

export const TEST_QUESTION_KINDS = ['choice', 'true_false', 'written'];

/**
 * Sinh đề cho chế độ Kiểm tra: trộn thẻ rồi rải đều các dạng câu đã bật.
 * Câu đúng/sai lấy định nghĩa của thẻ khác làm mệnh đề sai (~50%).
 */
export function buildTest(cards = [], { length = 10, kinds = TEST_QUESTION_KINDS, seed = 1 } = {}) {
  const enabled = TEST_QUESTION_KINDS.filter((kind) => kinds.includes(kind));

  if (!cards.length || !enabled.length) {
    return [];
  }

  const picked = seededShuffle(cards, seed).slice(0, Math.min(length, cards.length));

  return picked.map((card, index) => {
    const kind = enabled[index % enabled.length];
    const questionSeed = seed + index * 7919;

    if (kind === 'choice') {
      const distractors = pickDistractors(cards, card, 3, questionSeed);
      return {
        id: `${card.id}-${index}`,
        kind,
        card,
        options: seededShuffle([card, ...distractors], questionSeed + 13)
      };
    }

    if (kind === 'true_false') {
      const [other] = pickDistractors(cards, card, 1, questionSeed);
      // Không có thẻ khác để lấy mệnh đề sai thì buộc phải hỏi mệnh đề đúng.
      const showTrue = !other || index % 2 === 0;
      return {
        id: `${card.id}-${index}`,
        kind,
        card,
        shownDefinition: showTrue ? card.definition : other.definition,
        expected: showTrue ? 'true' : 'false'
      };
    }

    return { id: `${card.id}-${index}`, kind, card };
  });
}

export function gradeTestQuestion(question, answer) {
  if (!question) {
    return false;
  }

  if (question.kind === 'choice') {
    return String(answer ?? '') === question.card.id;
  }

  if (question.kind === 'true_false') {
    return String(answer ?? '') === question.expected;
  }

  return isWrittenAnswerCorrect(question.card, answer);
}

export function gradeTest(questions = [], answers = {}) {
  const correct = questions.filter((question) => gradeTestQuestion(question, answers[question.id])).length;
  return { correct, total: questions.length };
}

/**
 * Bàn chơi Ghép cặp: lấy N thẻ, tách thành ô thuật ngữ và ô định nghĩa rồi trộn
 * chung. Mỗi ô giữ `cardId` để biết ô nào ghép với ô nào.
 */
export function buildMatchBoard(cards = [], { pairs = MATCH_PAIR_COUNT, seed = 1 } = {}) {
  const picked = seededShuffle(cards, seed).slice(0, Math.min(pairs, cards.length));

  const tiles = picked.flatMap((card) => [
    { id: `${card.id}-term`, cardId: card.id, side: 'term', text: card.term },
    { id: `${card.id}-definition`, cardId: card.id, side: 'definition', text: card.definition }
  ]);

  return { pairCount: picked.length, tiles: seededShuffle(tiles, seed + 31) };
}

export function isMatchPair(left, right) {
  return Boolean(left) && Boolean(right) && left.cardId === right.cardId && left.side !== right.side;
}
