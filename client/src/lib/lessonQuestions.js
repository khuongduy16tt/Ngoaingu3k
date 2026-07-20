// Mô hình câu hỏi bài giảng (lưu trong lessons.content.exercises) — nhiều dạng bài
// theo kiểu PREP: trắc nghiệm, đúng/sai, điền khuyết, nối cặp, nghe & gõ lại, viết.
// Bản ghi cũ không có `type` (chỉ options + correctAnswer dạng nhãn A/B/C) được coi
// là multiple_choice để tương thích ngược.

export const LESSON_QUESTION_TYPES = [
  { value: 'multiple_choice', label: 'Trắc nghiệm' },
  { value: 'true_false', label: 'Đúng / Sai' },
  { value: 'fill_blank', label: 'Điền khuyết' },
  { value: 'matching', label: 'Nối cặp' },
  { value: 'listening', label: 'Nghe & gõ lại' },
  { value: 'writing', label: 'Viết (tự luận)' }
];

const OPTION_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export function getLessonQuestionTypeLabel(type) {
  return LESSON_QUESTION_TYPES.find((item) => item.value === type)?.label || 'Trắc nghiệm';
}

function normalizeOption(option, index) {
  if (option && typeof option === 'object') {
    return {
      label: String(option.label || OPTION_LABELS[index] || index + 1).trim().toUpperCase(),
      text: String(option.text || option.value || option.label || '').trim()
    };
  }

  return {
    label: OPTION_LABELS[index] || String(index + 1),
    text: String(option || '').trim()
  };
}

export function normalizeLessonQuestion(question, index = 0) {
  const type = LESSON_QUESTION_TYPES.some((item) => item.value === question?.type)
    ? question.type
    : 'multiple_choice';

  const options = Array.isArray(question?.options)
    ? question.options.map(normalizeOption).filter((option) => option.text)
    : [];

  const pairs = Array.isArray(question?.pairs)
    ? question.pairs
        .map((pair) => ({
          // Bài tập giao (assignments) lưu cặp dạng {term, answer} — chấp nhận cả hai.
          left: String(pair?.left ?? pair?.term ?? '').trim(),
          right: String(pair?.right ?? pair?.answer ?? '').trim()
        }))
        .filter((pair) => pair.left && pair.right)
    : [];

  const acceptedAnswers = Array.isArray(question?.acceptedAnswers)
    ? question.acceptedAnswers.map((answer) => String(answer).trim()).filter(Boolean)
    : [];

  return {
    id: String(question?.id || `lesson-question-${index + 1}`).trim(),
    type,
    prompt: String(question?.prompt || question?.question || '').trim(),
    options,
    correctAnswer: String(question?.correctAnswer ?? question?.answer ?? '').trim(),
    acceptedAnswers,
    pairs,
    audioUrl: String(question?.audioUrl || '').trim(),
    audioName: String(question?.audioName || '').trim(),
    sampleAnswer: String(question?.sampleAnswer || '').trim(),
    explanation: String(question?.explanation || question?.note || '').trim()
  };
}

// Nhãn đáp án đúng của câu trắc nghiệm: chấp nhận cả nhãn ("A") lẫn nội dung
// ("xin chào") vì dữ liệu cũ lưu lẫn lộn hai kiểu.
export function getCorrectOptionLabel(question) {
  const rawAnswer = String(question?.correctAnswer || '').trim();
  if (!rawAnswer) {
    return '';
  }

  const byLabel = question.options.find(
    (option) => option.label.toUpperCase() === rawAnswer.toUpperCase()
  );
  if (byLabel) {
    return byLabel.label;
  }

  const byText = question.options.find(
    (option) => option.text.trim().toLowerCase() === rawAnswer.toLowerCase()
  );
  return byText?.label || '';
}

// So sánh câu trả lời tự do: bỏ hoa/thường, dấu câu và khoảng trắng thừa —
// dạng nghe-gõ-lại không nên trượt vì thiếu dấu chấm.
export function normalizeFreeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[.,!?;:"'“”‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getAcceptedAnswers(question) {
  if (question.acceptedAnswers.length) {
    return question.acceptedAnswers;
  }
  return question.correctAnswer ? [question.correctAnswer] : [];
}

// Điểm tối đa của một câu. Trả 0 khi câu không tự chấm được: dạng viết (tự luận)
// hoặc câu thiếu dữ liệu đáp án — các câu này bị loại khỏi tổng điểm.
export function getLessonQuestionMaxScore(question) {
  switch (question.type) {
    case 'matching':
      return question.pairs.length;
    case 'writing':
      return 0;
    case 'fill_blank':
    case 'listening':
      return getAcceptedAnswers(question).length ? 1 : 0;
    case 'true_false':
      return ['true', 'false'].includes(question.correctAnswer) ? 1 : 0;
    default:
      return question.options.length && getCorrectOptionLabel(question) ? 1 : 0;
  }
}

export function isLessonQuestionAnswered(question, answer) {
  if (question.type === 'matching') {
    return question.pairs.every((_, index) => Boolean(answer?.[index] ?? answer?.[String(index)]));
  }

  return String(answer ?? '').trim() !== '';
}

export function scoreLessonQuestion(question, answer) {
  const maxScore = getLessonQuestionMaxScore(question);

  if (!maxScore) {
    return { score: 0, maxScore: 0 };
  }

  if (question.type === 'matching') {
    let score = 0;
    question.pairs.forEach((pair, index) => {
      if (answer && String(answer[index] ?? answer[String(index)] ?? '') === pair.right) {
        score += 1;
      }
    });
    return { score, maxScore };
  }

  if (question.type === 'fill_blank' || question.type === 'listening') {
    const normalized = normalizeFreeText(answer);
    const isCorrect =
      Boolean(normalized) &&
      getAcceptedAnswers(question).some((candidate) => normalizeFreeText(candidate) === normalized);
    return { score: isCorrect ? 1 : 0, maxScore };
  }

  if (question.type === 'true_false') {
    const isCorrect = String(answer ?? '') === question.correctAnswer;
    return { score: isCorrect ? 1 : 0, maxScore };
  }

  // multiple_choice: câu trả lời là nhãn lựa chọn (A/B/C...).
  const isCorrect =
    String(answer ?? '') !== '' && String(answer).toUpperCase() === getCorrectOptionLabel(question);
  return { score: isCorrect ? 1 : 0, maxScore };
}

export function scoreLessonQuestions(questions, answers = {}) {
  return questions.reduce(
    (result, question) => {
      const { score, maxScore } = scoreLessonQuestion(question, answers[question.id]);
      return {
        score: result.score + score,
        maxScore: result.maxScore + maxScore,
        gradedCount: result.gradedCount + (maxScore ? 1 : 0),
        selfGradedCount: result.selfGradedCount + (maxScore ? 0 : 1)
      };
    },
    { score: 0, maxScore: 0, gradedCount: 0, selfGradedCount: 0 }
  );
}

// Hiển thị đáp án đúng cho học viên sau khi nộp.
export function formatLessonCorrectAnswer(question) {
  switch (question.type) {
    case 'matching':
      return question.pairs.map((pair) => `${pair.left} → ${pair.right}`).join(' · ');
    case 'true_false':
      return question.correctAnswer === 'true' ? 'Đúng' : 'Sai';
    case 'fill_blank':
    case 'listening':
      return getAcceptedAnswers(question).join(' / ');
    case 'writing':
      return question.sampleAnswer;
    default: {
      const label = getCorrectOptionLabel(question);
      const option = question.options.find((item) => item.label === label);
      return option ? `${option.label}. ${option.text}` : question.correctAnswer;
    }
  }
}
