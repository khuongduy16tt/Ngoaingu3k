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

function isHeaderLikeRow(row) {
  const cells = [row[0], row[1], row[2], row[3], row[4], row[8], row[9]].map(cleanCell).join(' ');
  return /tên bài|dang bai|dạng bài|lua chon|lựa chọn|dap an|đáp án|ghi chú/i.test(cells);
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
