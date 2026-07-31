import * as XLSX from 'xlsx';

function cleanCell(value) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function createId(text, fallback) {
  const slug = cleanCell(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || fallback;
}

function findHeaderIndex(rows) {
  const index = rows.findIndex((row) =>
    row.some((cell) => /tên bài|dang bai|dạng bài|dap an|đáp án/i.test(cleanCell(cell)))
  );

  return index >= 0 ? index : -1;
}

function getOptionLabel(index) {
  return ['A', 'B', 'C', 'D'][index] || String(index + 1);
}

function normalizeAnswer(value) {
  const normalized = cleanCell(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  return ['A', 'B', 'C', 'D'].includes(normalized) ? normalized : cleanCell(value);
}

function getCorrectOption({ answer, options }) {
  const normalizedAnswer = normalizeAnswer(answer);
  const answerByLabel = options.find((option) => option.label === normalizedAnswer);

  if (answerByLabel) {
    return {
      correctAnswer: answerByLabel.label,
      correctOptionText: answerByLabel.text
    };
  }

  const answerByText = options.find(
    (option) => cleanCell(option.text).toLowerCase() === cleanCell(answer).toLowerCase()
  );

  return {
    correctAnswer: answerByText?.label || normalizedAnswer,
    correctOptionText: answerByText?.text || ''
  };
}

// Ô tiêu đề là ô CHỈ chứa tên cột. Trước đây chỉ cần chuỗi xuất hiện ở bất kỳ
// đâu trong dòng, nên câu hỏi kiểu "Chọn đáp án đúng cho câu sau" bị coi là
// dòng tiêu đề và biến mất khỏi bộ đề mà không báo gì.
const HEADER_CELL_PATTERNS = [
  /^t[eê]n b[aà]i/i,
  /^s[oố] b[aà]i$/i,
  /^d[aạ]ng b[aà]i/i,
  /^c[aâ]u s[oố]$/i,
  /^c[aâ]u h[oỏ]i$/i,
  /^lua chon\s*[a-d]?$/i,
  /^lựa chọn\s*[a-d]?$/i,
  /^dap an\s*[a-d]?$/i,
  /^đáp án\s*[a-d]?$/i,
  /^ghi ch[uú]/i,
  /^giai thich$/i,
  /^giải thích$/i,
  /^(question|prompt|answer|correct|note|explanation|option\s*[a-d]?)$/i
];

function isHeaderLikeRow(row) {
  const cells = [row[0], row[1], row[2], row[3], row[4], row[8], row[9]].map(cleanCell).filter(Boolean);
  if (!cells.length) {
    return false;
  }

  const headerCells = cells.filter((cell) => HEADER_CELL_PATTERNS.some((pattern) => pattern.test(cell)));
  // Dòng tiêu đề thật luôn có nhiều ô là tên cột; một ô lọt chữ "đáp án" giữa
  // nội dung câu hỏi thì không.
  return headerCells.length >= 2 || (cells.length === 1 && headerCells.length === 1);
}

function isOptionHeaderRow(row) {
  const optionHeaders = [row[4], row[5], row[6], row[7]].map(cleanCell);
  const hasChoiceHeaders =
    optionHeaders[0].toUpperCase() === 'A' &&
    optionHeaders[1].toUpperCase() === 'B' &&
    (!optionHeaders[2] || optionHeaders[2].toUpperCase() === 'C') &&
    (!optionHeaders[3] || optionHeaders[3].toUpperCase() === 'D');

  return hasChoiceHeaders && !cleanCell(row[8]) && !cleanCell(row[9]);
}

function parseQuestion(row, currentLesson, rowIndex) {
  const questionNumber = cleanCell(row[3]);
  const optionValues = [row[4], row[5], row[6], row[7]].map(cleanCell).filter(Boolean);
  const options = optionValues.map((option, index) => {
    const existingLabel = option.match(/^([A-D])\s*[.)]\s*(.+)$/i);

    return {
      label: existingLabel?.[1]?.toUpperCase() || getOptionLabel(index),
      text: existingLabel?.[2]?.trim() || option
    };
  });
  const answer = cleanCell(row[8]);
  const note = cleanCell(row[9]) || (row.length > 10 ? cleanCell(row[row.length - 1]) : '');

  if (!questionNumber && !options.length && !answer && !note) {
    return null;
  }

  const correctOption = getCorrectOption({ answer, options });
  const number = questionNumber.match(/\d+/)?.[0] || String(currentLesson.questions.length + 1);

  return {
    id: `${currentLesson.id}-q-${currentLesson.questions.length + 1}-${rowIndex}`,
    number,
    prompt: currentLesson.exerciseType ? `${currentLesson.exerciseType} - Câu ${number}` : `Câu ${number}`,
    options,
    answer,
    correctAnswer: correctOption.correctAnswer,
    correctOptionText: correctOption.correctOptionText,
    note
  };
}

function getLessonTitle({ lessonName, exerciseType, lessonNumber }) {
  if (lessonName) return lessonName.replace(/\s+/g, ' ');
  if (exerciseType) return exerciseType;
  return `Bài ${lessonNumber || ''}`.trim();
}

function createLesson({ sheetName, lessonName, lessonNumber, exerciseType, rowIndex }) {
  const fallbackId = `lesson-${rowIndex + 1}`;
  const title = getLessonTitle({ lessonName, exerciseType, lessonNumber });

  return {
    id: createId(`${sheetName}-${lessonNumber || rowIndex}-${title}`, fallbackId),
    title,
    lessonNumber: lessonNumber || '',
    exerciseType: exerciseType || 'Bài học',
    status: 'active',
    note: [lessonNumber ? `Bài ${lessonNumber}` : '', exerciseType].filter(Boolean).join(' · ') || sheetName,
    sourceSheet: sheetName,
    questions: [],
    exercises: []
  };
}

function pushLesson(section, lesson) {
  if (!lesson) return;

  const questionCount = lesson.questions.length;
  section.lessons.push({
    ...lesson,
    questionCount,
    exercises: lesson.questions,
    note: `${lesson.note}${questionCount ? ` · ${questionCount} câu` : ''}`
  });
}

function parseSheet(sheetName, sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const headerIndex = findHeaderIndex(rows);
  const contentRows = headerIndex >= 0 ? rows.slice(headerIndex + 1) : rows;
  const section = {
    title: sheetName,
    lessons: []
  };
  let currentLesson = null;
  let currentLessonName = '';
  let currentLessonNumber = '';
  let currentExerciseType = '';

  contentRows.forEach((row, rowIndex) => {
    if (isHeaderLikeRow(row) || isOptionHeaderRow(row)) {
      return;
    }

    const lessonName = cleanCell(row[0]);
    const lessonNumber = cleanCell(row[1]);
    const exerciseType = cleanCell(row[2]);
    const hasLessonMetadata = Boolean(lessonName || lessonNumber || exerciseType);
    const hasLessonBoundary =
      hasLessonMetadata &&
      (!currentLesson ||
        (lessonName && lessonName !== currentLessonName) ||
        (lessonNumber && lessonNumber !== currentLessonNumber) ||
        (exerciseType && exerciseType !== currentExerciseType));

    if (lessonName) currentLessonName = lessonName;
    if (lessonNumber) currentLessonNumber = lessonNumber;
    if (exerciseType) currentExerciseType = exerciseType;

    if (hasLessonBoundary) {
      pushLesson(section, currentLesson);
      currentLesson = createLesson({
        sheetName,
        lessonName,
        lessonNumber: currentLessonNumber,
        exerciseType: currentExerciseType,
        rowIndex
      });
    }

    if (!currentLesson && row.some((cell) => cleanCell(cell))) {
      currentLesson = createLesson({
        sheetName,
        lessonName: currentLessonName || sheetName,
        lessonNumber: currentLessonNumber || String(section.lessons.length + 1),
        exerciseType: currentExerciseType || 'Bài học',
        rowIndex
      });
    }

    const question = currentLesson ? parseQuestion(row, currentLesson, rowIndex) : null;
    if (question) {
      currentLesson.questions.push(question);
    }
  });

  pushLesson(section, currentLesson);

  return section.lessons.length ? section : null;
}

export async function parseExcelCourseFile(file) {
  if (!file) return [];

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  return workbook.SheetNames
    .map((sheetName) => parseSheet(sheetName, workbook.Sheets[sheetName]))
    .filter(Boolean);
}

function findColumn(headers, patterns) {
  return headers.findIndex((header) => patterns.some((pattern) => pattern.test(cleanCell(header))));
}

function getCell(row, index) {
  return index >= 0 ? cleanCell(row[index]) : '';
}

function normalizeQuestionOptions(values) {
  return values
    .map(cleanCell)
    .filter(Boolean)
    .map((text, index) => {
      const existingLabel = text.match(/^([A-D])\s*[.)]\s*(.+)$/i);

      return {
        label: existingLabel?.[1]?.toUpperCase() || getOptionLabel(index),
        text: existingLabel?.[2]?.trim() || text
      };
    });
}

function createQuestionFromParts({ prompt, optionValues, answer, note, index, sheetName }) {
  const options = normalizeQuestionOptions(optionValues);

  if (!prompt && !options.length) {
    return null;
  }

  const correctOption = getCorrectOption({ answer, options });

  return {
    id: createId(`${sheetName}-question-${index + 1}-${prompt}`, `excel-question-${Date.now()}-${index}`),
    number: String(index + 1),
    prompt: prompt || `Cau ${index + 1}`,
    options,
    answer,
    // Không đoán đáp án khi file thiếu cột "Đáp án": mặc định về A sẽ chấm sai
    // âm thầm cho cả bộ đề. Để trống thì câu bị loại khỏi tổng điểm và giáo
    // viên thấy ngay ô "Đáp án đúng" chưa chọn.
    correctAnswer: correctOption.correctAnswer,
    correctOptionText: correctOption.correctOptionText,
    note,
    explanation: note
  };
}

function parseQuestionSheet(sheetName, sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => /c[aâ]u\s*h[oỏ]i|question|prompt|dap an|đáp án|answer|correct/i.test(cleanCell(cell)))
  );
  const headers = headerIndex >= 0 ? rows[headerIndex] : [];
  const contentRows = headerIndex >= 0 ? rows.slice(headerIndex + 1) : rows;

  const promptIndex = findColumn(headers, [/c[aâ]u\s*h[oỏ]i/i, /question/i, /prompt/i, /noi dung/i, /n[oộ]i dung/i]);
  const answerIndex = findColumn(headers, [/dap an/i, /đáp án/i, /answer/i, /correct/i]);
  const noteIndex = findColumn(headers, [
    /giai thich/i,
    /giải thích/i,
    /note/i,
    /ghi chu/i,
    /ghi chú/i,
    /explanation/i
  ]);
  const optionIndexes = ['A', 'B', 'C', 'D'].map((label) =>
    findColumn(headers, [
      new RegExp(`^${label}$`, 'i'),
      new RegExp(`lua chon\\s*${label}`, 'i'),
      new RegExp(`lựa chọn\\s*${label}`, 'i'),
      new RegExp(`dap an\\s*${label}`, 'i'),
      new RegExp(`đáp án\\s*${label}`, 'i'),
      new RegExp(`option\\s*${label}`, 'i')
    ])
  );

  return contentRows
    .map((row, rowIndex) => {
      if (!row.some((cell) => cleanCell(cell))) {
        return null;
      }

      if (isHeaderLikeRow(row) || isOptionHeaderRow(row)) {
        return null;
      }

      if (promptIndex >= 0) {
        return createQuestionFromParts({
          prompt: getCell(row, promptIndex),
          optionValues: optionIndexes.map((index) => getCell(row, index)),
          answer: getCell(row, answerIndex),
          note: getCell(row, noteIndex),
          index: rowIndex,
          sheetName
        });
      }

      const courseFormatOptions = [row[4], row[5], row[6], row[7]].map(cleanCell);
      if (courseFormatOptions.some(Boolean) || cleanCell(row[8])) {
        const exerciseType = cleanCell(row[2]);
        const questionNumber = cleanCell(row[3]) || String(rowIndex + 1);
        return createQuestionFromParts({
          prompt: exerciseType ? `${exerciseType} - Câu ${questionNumber}` : `Câu ${questionNumber}`,
          optionValues: courseFormatOptions,
          answer: cleanCell(row[8]),
          note: cleanCell(row[9]),
          index: rowIndex,
          sheetName
        });
      }

      const firstCell = cleanCell(row[0]);
      const secondCell = cleanCell(row[1]);
      const firstIsNumber = /^\d+[.)]?$/.test(firstCell);
      const prompt = firstIsNumber ? secondCell : firstCell;
      const optionStart = firstIsNumber ? 2 : 1;

      return createQuestionFromParts({
        prompt,
        optionValues: [row[optionStart], row[optionStart + 1], row[optionStart + 2], row[optionStart + 3]],
        answer: cleanCell(row[optionStart + 4]),
        note: cleanCell(row[optionStart + 5]),
        index: rowIndex,
        sheetName
      });
    })
    .filter(Boolean);
}

export async function parseExcelQuestionFile(file) {
  if (!file) return [];

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  return workbook.SheetNames
    .flatMap((sheetName) => parseQuestionSheet(sheetName, workbook.Sheets[sheetName]))
    .map((question, index) => ({
      ...question,
      number: question.number || String(index + 1)
    }));
}
