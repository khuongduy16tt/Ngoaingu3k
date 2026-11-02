// Bộ quy chiếu riêng ước lượng band IELTS Writing & Speaking cho bài test /test.
// Không gọi dịch vụ bên ngoài: chấm bằng các chỉ số đo được từ bài làm, ánh xạ
// vào 4 tiêu chí của band descriptors công khai (mỗi tiêu chí 0–9, bước 0.5).
//
// Ngưỡng (ANCHORS) là điểm mốc "chỉ số → band" lấy theo mô tả band công khai và
// đặc điểm thường gặp của bài ở từng band. Khi có bài do giáo viên chấm, chỉnh
// các mốc này để khớp hơn (xem placementScoring.test.js).

// ─── Tiện ích ─────────────────────────────────────────────────────────────────

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const roundHalf = (value) => Math.round(clamp(Number(value) || 0, 0, 9) * 2) / 2;

// Nội suy tuyến tính theo các mốc [chỉ số, band] đã sắp tăng dần.
function scale(value, anchors) {
  if (value <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i += 1) {
    const [x1, y1] = anchors[i];
    const [x0, y0] = anchors[i - 1];
    if (value <= x1) return y0 + ((value - x0) / (x1 - x0)) * (y1 - y0);
  }
  return anchors[anchors.length - 1][1];
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .match(/[a-z]+(?:'[a-z]+)?/g) || [];
}

export function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function splitSentences(text) {
  return String(text || '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => countWords(sentence) > 0);
}

function splitParagraphs(text) {
  return String(text || '')
    .split(/\n\s*\n|\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => countWords(paragraph) >= 8);
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function stdev(values) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
}

// Đếm số cụm (1 hoặc nhiều từ) xuất hiện trong văn bản đã chuẩn hoá.
function countPhrases(normalized, phrases) {
  let hits = 0;
  const found = new Set();
  phrases.forEach((phrase) => {
    const pattern = new RegExp(`(^|[^a-z])${phrase.replace(/ /g, '\\s+')}([^a-z]|$)`, 'g');
    const matches = normalized.match(pattern);
    if (matches) {
      hits += matches.length;
      found.add(phrase);
    }
  });
  return { hits, distinct: found.size };
}

// Guiraud index = số từ khác nhau / căn bậc hai tổng số từ — đo độ đa dạng từ
// vựng mà ít bị ảnh hưởng bởi độ dài bài hơn tỉ lệ type/token thông thường.
function lexicalStats(tokens) {
  const types = new Set(tokens);
  const longWords = tokens.filter((token) => token.length >= 7).length;
  return {
    guiraud: tokens.length ? types.size / Math.sqrt(tokens.length) : 0,
    longRatio: tokens.length ? longWords / tokens.length : 0,
    avgLength: mean(tokens.map((token) => token.length))
  };
}

// ─── Danh sách từ dùng chung ──────────────────────────────────────────────────

const LINKERS = [
  'however', 'moreover', 'furthermore', 'in addition', 'additionally', 'therefore', 'thus', 'hence',
  'as a result', 'consequently', 'for example', 'for instance', 'such as', 'firstly', 'secondly', 'thirdly',
  'finally', 'lastly', 'in conclusion', 'to sum up', 'to conclude', 'overall', 'on the other hand',
  'in contrast', 'by contrast', 'whereas', 'while', 'although', 'even though', 'despite', 'in spite of',
  'because', 'since', 'due to', 'so that', 'in order to', 'not only', 'besides', 'meanwhile', 'similarly',
  'likewise', 'in other words', 'that is why', 'this means', 'as well as', 'apart from', 'nevertheless'
];

const COMPLEX_MARKERS = [
  'which', 'who', 'whom', 'whose', 'where', 'when', 'if', 'unless', 'although', 'though', 'because',
  'since', 'while', 'whereas', 'that', 'would', 'could', 'might', 'should', 'have been', 'has been',
  'had been', 'being', 'whether', 'so that', 'in order to', 'not only'
];

const ACADEMIC_WORDS = [
  'significant', 'significantly', 'approximately', 'considerably', 'substantially', 'respectively',
  'proportion', 'comparison', 'compared', 'contrast', 'consequently', 'furthermore', 'nevertheless',
  'considerable', 'crucial', 'essential', 'factor', 'factors', 'impact', 'affect', 'affects', 'issue',
  'issues', 'individual', 'individuals', 'pressure', 'demanding', 'workload', 'productivity', 'wellbeing',
  'well-being', 'beneficial', 'detrimental', 'tackle', 'measures', 'implement', 'alleviate', 'reduce',
  'contribute', 'contributes', 'excessive', 'balance', 'maintain', 'promote', 'encourage', 'society',
  'economic', 'financial', 'anxiety', 'mental', 'overall', 'notable', 'notably', 'figure', 'figures',
  'highest', 'lowest', 'largest', 'smallest', 'majority', 'minority', 'whereas', 'similarly', 'exceed',
  'exceeds', 'roughly', 'nearly', 'twice', 'triple', 'experience', 'opportunity', 'perspective',
  'environment', 'technology', 'communication', 'convenient', 'efficient', 'memorable', 'unforgettable',
  'fascinating', 'breathtaking', 'atmosphere', 'culture', 'cultural', 'tradition', 'traditional'
];

const FILLERS = ['um', 'uh', 'er', 'erm', 'hmm', 'ah', 'eh', 'mm', 'uhm'];

// ─── Writing ──────────────────────────────────────────────────────────────────

const TASK1 = {
  minWords: 150,
  // Từ khoá thể hiện đã nói đúng nội dung bảng số liệu tàu điện ngầm.
  keywords: [
    'table', 'metro', 'subway', 'underground', 'system', 'systems', 'line', 'lines', 'length', 'miles', 'journey',
    'journeys', 'passenger', 'passengers', 'ticket', 'tickets', 'price', 'cost', 'fare', 'dollar', 'dollars',
    'new york', 'london', 'tokyo', 'paris', 'mexico', 'beijing', 'billion', 'annual', 'annually', 'cities', 'city'
  ],
  overview: ['overall', 'in general', 'generally', 'it is clear', 'it is evident', 'it can be seen', 'in summary', 'to summarise', 'to summarize'],
  comparison: [
    'more than', 'less than', 'fewer', 'higher', 'lower', 'highest', 'lowest', 'largest', 'smallest', 'longest',
    'shortest', 'most', 'least', 'cheapest', 'most expensive', 'compared', 'whereas', 'while', 'in contrast',
    'similar', 'twice', 'double', 'the same'
  ],
  // Số liệu trong bảng: nhắc đúng số chứng tỏ có dẫn chứng dữ liệu.
  dataValues: ['24', '11', '13', '16', '12', '19', '659', '249', '189', '127', '140', '357', '1.65', '1.2', '3.1', '1.5', '1.6', '3.6', '2.50', '7.30', '1.64', '2.30', '0.23', '0.45']
};

const TASK2 = {
  minWords: 250,
  keywords: [
    'stress', 'stressful', 'stressed', 'pressure', 'work', 'job', 'jobs', 'workload', 'deadline', 'deadlines',
    'study', 'exam', 'exams', 'money', 'financial', 'cost', 'living', 'technology', 'social media', 'phone',
    'internet', 'competition', 'competitive', 'family', 'health', 'mental', 'sleep', 'exercise', 'relax',
    'relaxation', 'hobby', 'hobbies', 'government', 'employer', 'employers', 'company', 'companies', 'school'
  ],
  causes: ['cause', 'causes', 'caused', 'reason', 'reasons', 'because', 'due to', 'result', 'lead to', 'leads to', 'stem from', 'contribute'],
  solutions: [
    'measure', 'measures', 'solution', 'solutions', 'solve', 'tackle', 'address', 'reduce', 'should', 'could',
    'need to', 'needs to', 'must', 'encourage', 'provide', 'introduce', 'promote', 'help'
  ],
  conclusion: ['in conclusion', 'to conclude', 'to sum up', 'in summary', 'overall', 'all in all']
};

const BAND_FOR_LENGTH_RATIO = [[0, 0], [0.15, 1.5], [0.4, 3], [0.7, 4.5], [0.9, 5.5], [1, 6.5], [1.3, 7], [1.8, 7]];
const BAND_FOR_GUIRAUD = [[3, 3], [4.5, 4], [5.5, 5], [6.5, 6], [7.5, 7], [8.5, 8], [9.5, 8.5]];
const BAND_FOR_LONG_WORDS = [[0.05, 3.5], [0.1, 4.5], [0.15, 5.5], [0.2, 6.5], [0.25, 7.5], [0.3, 8]];
const BAND_FOR_LINKER_DENSITY = [[0, 3], [0.6, 4], [1.5, 5], [2.5, 6], [3.5, 7], [5, 7.5], [8, 7]];
const BAND_FOR_COMPLEX_RATIO = [[0, 3.5], [0.2, 4.5], [0.45, 5.5], [0.7, 6.5], [1, 7], [1.4, 7.5]];
const BAND_FOR_SENT_LENGTH = [[5, 3.5], [9, 4.5], [13, 5.5], [17, 6.5], [21, 7], [28, 7], [38, 6], [50, 5]];

// Lỗi bề mặt dễ phát hiện: câu không viết hoa đầu, "i" viết thường, từ lặp liền
// nhau, câu quá dài không ngắt (run-on), thiếu dấu chấm cuối bài.
function surfaceErrors(text, sentences) {
  let errors = 0;
  sentences.forEach((sentence) => {
    if (/^[a-z]/.test(sentence)) errors += 1;
    if (countWords(sentence) > 45) errors += 1;
  });
  errors += (String(text).match(/(^|\s)i(\s|')/g) || []).length;
  errors += (String(text).toLowerCase().match(/\b(\w+)\s+\1\b/g) || []).length;
  if (String(text).trim() && !/[.!?]["')]?\s*$/.test(String(text).trim())) errors += 1;
  return errors;
}

function gradeWritingTask(text, task, kind) {
  const words = countWords(text);
  const tokens = tokenize(text);
  const normalized = ` ${tokens.join(' ')} `;
  const sentences = splitSentences(text);
  const paragraphs = splitParagraphs(text);
  const lengthRatio = words / task.minWords;

  if (words < 20) {
    return {
      band: words === 0 ? 0 : 1,
      words,
      criteria: null,
      notes: { tooShort: true }
    };
  }

  const lexical = lexicalStats(tokens);
  const linkers = countPhrases(normalized, LINKERS);
  const complex = countPhrases(normalized, COMPLEX_MARKERS);
  const academic = countPhrases(normalized, ACADEMIC_WORDS);
  const keyword = countPhrases(normalized, task.keywords);
  const sentenceLengths = sentences.map(countWords);
  const avgSentence = mean(sentenceLengths);
  const errors = surfaceErrors(text, sentences);
  const errorRate = sentences.length ? errors / sentences.length : 1;
  const per100 = (value) => (value / Math.max(words, 1)) * 100;

  // Task Achievement / Task Response
  let taskScore = scale(lengthRatio, BAND_FOR_LENGTH_RATIO);
  const keywordCoverage = keyword.distinct / task.keywords.length;
  const relevance = scale(keywordCoverage, [[0, 3], [0.08, 4.5], [0.15, 5.5], [0.25, 6.5], [0.35, 7.5], [0.5, 8]]);
  let structureBonus = 0;
  const notes = {};
  if (kind === 'task1') {
    const overview = countPhrases(normalized, task.overview).distinct > 0;
    const comparisons = countPhrases(normalized, task.comparison).distinct;
    const dataHits = task.dataValues.filter((value) => String(text).includes(value)).length;
    structureBonus += overview ? 0.5 : -1;
    structureBonus += comparisons >= 4 ? 0.5 : comparisons >= 2 ? 0 : -0.5;
    structureBonus += dataHits >= 6 ? 0.5 : dataHits >= 3 ? 0 : -0.5;
    Object.assign(notes, { overview, comparisons, dataHits });
  } else {
    const causes = countPhrases(normalized, task.causes).distinct > 0;
    const solutions = countPhrases(normalized, task.solutions).distinct >= 2;
    const conclusion = countPhrases(normalized, task.conclusion).distinct > 0;
    structureBonus += causes ? 0.25 : -1;
    structureBonus += solutions ? 0.25 : -1;
    structureBonus += conclusion ? 0.25 : -0.5;
    structureBonus += paragraphs.length >= 4 ? 0.25 : paragraphs.length >= 3 ? 0 : -0.5;
    Object.assign(notes, { causes, solutions, conclusion });
  }
  taskScore = Math.min(taskScore, relevance + 1.5) * 0.6 + relevance * 0.4 + structureBonus;

  // Coherence & Cohesion
  const linkerDensity = per100(linkers.hits);
  let coherence = scale(linkerDensity, BAND_FOR_LINKER_DENSITY);
  coherence += linkers.distinct >= 6 ? 0.5 : linkers.distinct <= 2 ? -0.5 : 0;
  coherence += paragraphs.length >= (kind === 'task1' ? 3 : 4) ? 0.5 : paragraphs.length <= 1 ? -1 : 0;

  // Lexical Resource
  const lexicalScore =
    scale(lexical.guiraud, BAND_FOR_GUIRAUD) * 0.55 +
    scale(lexical.longRatio, BAND_FOR_LONG_WORDS) * 0.3 +
    scale(per100(academic.distinct), [[0, 4], [1, 5], [2.5, 6], [4, 7], [6, 7.5]]) * 0.15;

  // Grammatical Range & Accuracy
  const complexRatio = sentences.length ? complex.hits / sentences.length : 0;
  let grammar =
    scale(complexRatio, BAND_FOR_COMPLEX_RATIO) * 0.5 +
    scale(avgSentence, BAND_FOR_SENT_LENGTH) * 0.3 +
    scale(stdev(sentenceLengths), [[0, 4], [3, 5.5], [6, 6.5], [9, 7]]) * 0.2;
  grammar -= scale(errorRate, [[0, 0], [0.1, 0.25], [0.25, 0.75], [0.5, 1.5], [1, 2.5]]);

  // Bài quá ngắn so với yêu cầu thì các tiêu chí khác cũng bị giới hạn (như giám khảo thật).
  const lengthCap = scale(lengthRatio, [[0, 2], [0.3, 4], [0.6, 5], [0.85, 6.5], [1, 9]]);
  // Sàn 2.5 khi bài có viết thành đoạn (≥50 từ), trần 8.5 vì chỉ số bề mặt không
  // đủ chắc để cho 9 — giống cách giám khảo hiếm khi cho điểm cực trị.
  const floor = words >= 50 ? 2.5 : 1;
  const fit = (value) => roundHalf(clamp(value, floor, 8.5));
  const criteria = {
    task: fit(Math.min(taskScore, lengthCap)),
    coherence: fit(Math.min(coherence, lengthCap + 0.5)),
    lexical: fit(Math.min(lexicalScore, lengthCap + 0.5)),
    grammar: fit(Math.min(grammar, lengthCap + 0.5))
  };
  // Theo quy tắc chấm: band của Task = trung bình 4 tiêu chí, làm tròn xuống 0.5.
  const band = Math.floor(mean(Object.values(criteria)) * 2) / 2;

  return {
    band,
    words,
    criteria,
    notes: {
      ...notes,
      lengthRatio,
      linkerDistinct: linkers.distinct,
      paragraphs: paragraphs.length,
      errors,
      guiraud: lexical.guiraud,
      complexRatio
    }
  };
}

function writingFeedback(result, kind) {
  const { words, criteria, notes } = result;
  const min = kind === 'task1' ? TASK1.minWords : TASK2.minWords;
  if (!criteria) {
    return words === 0
      ? `Bạn chưa viết bài cho ${kind === 'task1' ? 'Task 1' : 'Task 2'}.`
      : `Bài quá ngắn (${words} từ) nên chưa thể đánh giá. Cần tối thiểu ${min} từ.`;
  }
  const parts = [];
  if (words < min) parts.push(`Bài mới có ${words} từ, chưa đủ ${min} từ nên bị trừ điểm nội dung.`);
  if (kind === 'task1') {
    if (!notes.overview) parts.push('Thiếu câu tổng quan (overview) nêu đặc điểm nổi bật nhất của bảng — bắt đầu bằng "Overall, ...".');
    if (notes.dataHits < 3) parts.push('Nên dẫn số liệu cụ thể từ bảng (số tuyến, chiều dài, giá vé...).');
    if (notes.comparisons < 2) parts.push('Cần so sánh giữa các thành phố (higher, the cheapest, whereas...).');
  } else {
    if (!notes.causes) parts.push('Chưa nêu rõ nguyên nhân gây căng thẳng.');
    if (!notes.solutions) parts.push('Chưa đưa ra đủ giải pháp cụ thể.');
    if (!notes.conclusion) parts.push('Nên có đoạn kết luận rõ ràng ("In conclusion, ...").');
  }
  if (notes.paragraphs <= 1) parts.push('Bài chưa chia đoạn — hãy tách mở bài, thân bài, kết bài.');
  if (notes.linkerDistinct <= 2) parts.push('Dùng thêm từ nối đa dạng (however, moreover, as a result...).');
  if (notes.errors >= 3) parts.push('Còn nhiều lỗi trình bày cơ bản (viết hoa đầu câu, dấu câu, câu quá dài).');
  if (!parts.length) parts.push('Bài đáp ứng tốt yêu cầu đề, bố cục rõ và dùng từ khá đa dạng.');
  return parts.slice(0, 3).join(' ');
}

export function gradeWriting({ task1 = '', task2 = '' } = {}) {
  const t1 = gradeWritingTask(task1, TASK1, 'task1');
  const t2 = gradeWritingTask(task2, TASK2, 'task2');
  // Band Writing: Task 2 nặng gấp đôi Task 1.
  const band = roundHalf((t1.band + t2.band * 2) / 3);

  const toCriteria = (result, firstName) =>
    result.criteria
      ? {
          [firstName]: result.criteria.task,
          'Coherence & Cohesion': result.criteria.coherence,
          'Lexical Resource': result.criteria.lexical,
          'Grammar': result.criteria.grammar
        }
      : null;

  const strengths = [];
  const improvements = [];
  const all = [t1, t2].filter((item) => item.criteria);
  if (all.some((item) => item.notes.linkerDistinct >= 6)) strengths.push('Sử dụng từ nối đa dạng, các ý liên kết mạch lạc.');
  if (all.some((item) => item.notes.guiraud >= 7)) strengths.push('Vốn từ vựng phong phú, ít lặp từ.');
  if (all.some((item) => item.notes.complexRatio >= 0.8)) strengths.push('Có dùng nhiều cấu trúc câu phức.');
  if (t1.notes?.overview) strengths.push('Task 1 có câu tổng quan rõ ràng.');
  if (t1.words < TASK1.minWords || t2.words < TASK2.minWords) improvements.push('Viết đủ số từ tối thiểu: 150 từ Task 1, 250 từ Task 2.');
  if (all.some((item) => item.notes.guiraud < 5.5)) improvements.push('Mở rộng vốn từ, tránh lặp lại một từ nhiều lần.');
  if (all.some((item) => item.notes.complexRatio < 0.45)) improvements.push('Tăng câu phức (which, although, if...) thay vì chỉ dùng câu đơn.');
  if (all.some((item) => item.notes.errors >= 3)) improvements.push('Soát lỗi viết hoa, dấu câu và ngắt câu trước khi nộp.');

  return {
    band,
    task1: { band: t1.band, words: t1.words, criteria: toCriteria(t1, 'Task Achievement'), feedback: writingFeedback(t1, 'task1') },
    task2: { band: t2.band, words: t2.words, criteria: toCriteria(t2, 'Task Response'), feedback: writingFeedback(t2, 'task2') },
    summary:
      band >= 6.5
        ? 'Bài viết ở mức khá tốt: đáp ứng yêu cầu đề, bố cục rõ, từ vựng và cấu trúc câu đa dạng.'
        : band >= 5
          ? 'Bài viết ở mức trung bình: ý cơ bản đầy đủ nhưng từ vựng, câu phức và liên kết còn hạn chế.'
          : 'Bài viết còn yếu: chưa đủ độ dài hoặc chưa đáp ứng đúng yêu cầu đề, cần luyện từ nền tảng.',
    strengths: strengths.slice(0, 4),
    improvements: improvements.slice(0, 4)
  };
}

// ─── Speaking ─────────────────────────────────────────────────────────────────

// Số từ "đủ ý" mong đợi cho mỗi kiểu câu.
const EXPECTED_WORDS = { 'Part 1': 30, 'Part 2': 150, 'Part 3': 55 };
const BAND_FOR_WPM = [[30, 3.5], [60, 4.5], [85, 5.5], [105, 6.5], [125, 7], [150, 7.5], [190, 7]];
const BAND_FOR_CONFIDENCE = [[0.4, 4], [0.6, 5], [0.75, 6], [0.85, 6.5], [0.92, 7.5], [0.97, 8]];

export function gradeSpeaking(answers = []) {
  const items = answers.map((item) => {
    const tokens = tokenize(item.transcript);
    return { ...item, tokens, words: tokens.length };
  });
  const totalWords = items.reduce((sum, item) => sum + item.words, 0);

  if (totalWords < 15) {
    return {
      band: 0,
      words: totalWords,
      criteria: { 'Fluency & Coherence': 0, 'Lexical Resource': 0, 'Grammar': 0, 'Pronunciation': 0 },
      feedback: {},
      summary: 'Phần Speaking gần như chưa có câu trả lời nên chưa thể đánh giá.',
      strengths: [],
      improvements: ['Hãy trả lời đầy đủ từng câu hỏi, mỗi câu Part 1 khoảng 2–3 câu, Part 2 nói đủ 1–2 phút.']
    };
  }

  const answered = items.filter((item) => item.words > 0);
  const answeredRatio = answered.length / Math.max(items.length, 1);
  const spokenSeconds = answered.reduce((sum, item) => sum + Math.max(item.seconds, 1), 0);
  const wpm = (totalWords / spokenSeconds) * 60;
  const completeness = mean(items.map((item) => clamp(item.words / (EXPECTED_WORDS[item.part] || 40), 0, 1.2)));
  const allTokens = items.flatMap((item) => item.tokens);
  const normalized = ` ${allTokens.join(' ')} `;
  const fillers = allTokens.filter((token) => FILLERS.includes(token)).length;
  const fillerRatio = fillers / Math.max(totalWords, 1);
  const linkers = countPhrases(normalized, LINKERS);
  const complex = countPhrases(normalized, COMPLEX_MARKERS);
  const lexical = lexicalStats(allTokens.filter((token) => !FILLERS.includes(token)));
  const academic = countPhrases(normalized, ACADEMIC_WORDS);
  const part2 = items.find((item) => item.part === 'Part 2');
  const part2Past = part2 ? countPhrases(` ${part2.tokens.join(' ')} `, ['went', 'was', 'were', 'did', 'had', 'visited', 'stayed', 'saw', 'took', 'travelled', 'traveled', 'ate', 'spent']).distinct : 0;
  const confidences = answered.map((item) => item.confidence).filter((value) => value > 0);
  const avgConfidence = confidences.length ? mean(confidences) : 0;

  // Fluency & Coherence
  let fluency =
    scale(wpm, BAND_FOR_WPM) * 0.45 +
    scale(completeness, [[0, 2], [0.3, 4], [0.55, 5], [0.75, 6], [0.95, 7], [1.1, 7.5]]) * 0.4 +
    scale((linkers.hits / Math.max(answered.length, 1)), [[0, 4], [0.5, 5], [1, 6], [1.8, 7], [2.5, 7.5]]) * 0.15;
  fluency -= scale(fillerRatio, [[0, 0], [0.03, 0.25], [0.06, 0.75], [0.12, 1.5]]);

  // Lexical Resource
  const lexicalScore =
    scale(lexical.guiraud, [[3, 3.5], [5, 4.5], [6.5, 5.5], [8, 6.5], [9.5, 7.5], [11, 8]]) * 0.6 +
    scale(lexical.longRatio, [[0.03, 4], [0.07, 5], [0.11, 6], [0.15, 7], [0.2, 7.5]]) * 0.25 +
    scale((academic.distinct / Math.max(totalWords, 1)) * 100, [[0, 4.5], [0.8, 5.5], [1.8, 6.5], [3, 7.5]]) * 0.15;

  // Grammatical Range & Accuracy (lời nói không có dấu câu → đo theo câu trả lời)
  const complexPerAnswer = complex.hits / Math.max(answered.length, 1);
  let grammar =
    scale(complexPerAnswer, [[0, 3.5], [0.5, 4.5], [1.2, 5.5], [2.2, 6.5], [3.5, 7], [5, 7.5]]) * 0.6 +
    scale(totalWords / Math.max(answered.length, 1), [[5, 3.5], [15, 4.5], [30, 5.5], [50, 6.5], [70, 7]]) * 0.4;
  if (part2 && part2.words > 30) grammar += part2Past >= 3 ? 0.25 : -0.25;

  // Pronunciation: ước tính từ độ rõ trình duyệt nhận dạng, kéo gần các tiêu chí khác.
  const others = mean([fluency, lexicalScore, grammar]);
  const pronunciation = avgConfidence ? scale(avgConfidence, BAND_FOR_CONFIDENCE) * 0.5 + others * 0.5 : others;

  // Bỏ nhiều câu không trả lời thì giới hạn band (như giám khảo thật).
  const cap = scale(answeredRatio, [[0, 2], [0.3, 4], [0.6, 5.5], [0.85, 7], [1, 9]]);
  const criteria = {
    'Fluency & Coherence': roundHalf(Math.min(fluency, cap)),
    'Lexical Resource': roundHalf(Math.min(lexicalScore, cap + 0.5)),
    'Grammar': roundHalf(Math.min(grammar, cap + 0.5)),
    'Pronunciation': roundHalf(Math.min(pronunciation, cap + 0.5))
  };
  const band = roundHalf(mean(Object.values(criteria)));

  const feedback = {
    'Fluency & Coherence':
      wpm < 70
        ? `Tốc độ nói còn chậm (khoảng ${Math.round(wpm)} từ/phút) và câu trả lời ngắn. Hãy luyện nói liền mạch, mở rộng ý bằng lý do và ví dụ.`
        : completeness < 0.6
          ? 'Câu trả lời còn ngắn so với yêu cầu. Mỗi câu Part 1 nên 2–3 câu, Part 3 nên nêu ý + giải thích + ví dụ.'
          : 'Nói khá trôi chảy, các ý có độ dài phù hợp.' + (fillerRatio > 0.04 ? ' Hạn chế "um, uh" khi suy nghĩ.' : ''),
    'Lexical Resource':
      lexical.guiraud < 6
        ? 'Vốn từ còn hạn chế, lặp từ nhiều. Học thêm từ theo chủ đề quê hương, du lịch, công nghệ.'
        : 'Dùng từ khá đa dạng theo chủ đề.' + (academic.distinct < 3 ? ' Thử dùng thêm từ ít phổ biến hơn (memorable, convenient, significant...).' : ''),
    'Grammar':
      complexPerAnswer < 1
        ? 'Chủ yếu dùng câu đơn. Luyện câu phức với because, although, if, which để nâng điểm ngữ pháp.'
        : 'Có kết hợp câu đơn và câu phức.' + (part2 && part2Past < 3 ? ' Part 2 kể chuyện đã qua nên dùng thì quá khứ (went, visited...).' : ''),
    'Pronunciation':
      avgConfidence && avgConfidence < 0.75
        ? 'Một số từ phát âm chưa rõ. Luyện âm cuối và trọng âm từ, nói chậm và rõ hơn.'
        : 'Phát âm nhìn chung dễ nghe. Tiếp tục luyện ngữ điệu và nhấn trọng âm câu.'
  };

  const strengths = [];
  const improvements = [];
  if (wpm >= 100 && completeness >= 0.75) strengths.push('Nói trôi chảy, trả lời đủ ý.');
  if (lexical.guiraud >= 7.5) strengths.push('Vốn từ phong phú.');
  if (complexPerAnswer >= 2) strengths.push('Dùng được nhiều cấu trúc câu phức.');
  if (answeredRatio < 1) improvements.push('Trả lời đủ tất cả câu hỏi, không bỏ trống.');
  if (completeness < 0.75) improvements.push('Mở rộng câu trả lời: ý chính → lý do → ví dụ.');
  if (complexPerAnswer < 1.2) improvements.push('Luyện câu phức để tăng điểm ngữ pháp.');
  if (fillerRatio > 0.04) improvements.push('Giảm các từ đệm "um, uh" khi suy nghĩ.');

  return {
    band,
    words: totalWords,
    criteria,
    feedback,
    summary:
      band >= 6.5
        ? 'Phần nói ở mức khá tốt: trôi chảy, từ vựng và ngữ pháp tương đối đa dạng.'
        : band >= 5
          ? 'Phần nói ở mức trung bình: giao tiếp được nhưng câu trả lời còn ngắn và đơn giản.'
          : 'Phần nói còn yếu: câu trả lời ngắn, ngập ngừng; cần luyện phản xạ từ nền tảng.',
    strengths: strengths.slice(0, 4),
    improvements: improvements.slice(0, 4)
  };
}
