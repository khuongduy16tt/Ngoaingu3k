import { getStoredPurchasedCourseIds } from './courseService';
import { demoExams } from '../data/mock';
import { isSupabaseReady, supabase } from './supabase';
import { apiFetch } from './api';

export const MOCK_EXAMS_STORAGE_KEY = 'ngoaingu3k-mock-exams';
export const MOCK_EXAM_ATTEMPTS_STORAGE_KEY = 'ngoaingu3k-mock-exam-attempts';

export const EXAM_SECTION_TYPES = [
  { value: 'listening', label: 'Nghe (Listening)' },
  { value: 'reading', label: 'Đọc (Reading)' }
];

export const EXAM_QUESTION_TYPES = [
  { value: 'multiple_choice', label: 'Trắc nghiệm' },
  { value: 'true_false', label: 'Đúng / Sai' },
  { value: 'fill_blank', label: 'Điền đáp án' },
  { value: 'matching', label: 'Nối cặp' }
];

export function getSectionTypeLabel(type) {
  return EXAM_SECTION_TYPES.find((item) => item.value === type)?.label || type;
}

export function getQuestionTypeLabel(type) {
  return EXAM_QUESTION_TYPES.find((item) => item.value === type)?.label || type;
}

// ─── Normalization ────────────────────────────────────────────────────────────

function parseJsonField(value, fallback) {
  if (!value) {
    return fallback;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  return value;
}

export function normalizeExamQuestion(question, index = 0) {
  const type = ['multiple_choice', 'true_false', 'fill_blank', 'matching'].includes(question?.type)
    ? question.type
    : 'multiple_choice';

  return {
    id: question?.id || `q-${index + 1}`,
    type,
    prompt: String(question?.prompt || '').trim(),
    imageUrl: String(question?.imageUrl || ''),
    imageName: String(question?.imageName || ''),
    options: Array.isArray(question?.options) ? question.options.map((option) => String(option)) : [],
    pairs: Array.isArray(question?.pairs)
      ? question.pairs
          .map((pair) => ({ left: String(pair?.left || '').trim(), right: String(pair?.right || '').trim() }))
          .filter((pair) => pair.left && pair.right)
      : [],
    correctAnswer: question?.correctAnswer !== undefined ? String(question.correctAnswer) : '',
    acceptedAnswers: Array.isArray(question?.acceptedAnswers)
      ? question.acceptedAnswers.map((answer) => String(answer)).filter(Boolean)
      : [],
    explanation: String(question?.explanation || '')
  };
}

export function normalizeExamSection(section, index = 0) {
  return {
    id: section?.id || `section-${index + 1}`,
    type: section?.type === 'reading' ? 'reading' : 'listening',
    title: String(section?.title || '').trim() || `Phần ${index + 1}`,
    durationMinutes: Math.max(1, Number(section?.durationMinutes) || 30),
    audioUrl: String(section?.audioUrl || ''),
    audioName: String(section?.audioName || ''),
    passage: String(section?.passage || ''),
    questions: (Array.isArray(section?.questions) ? section.questions : []).map((question, questionIndex) =>
      normalizeExamQuestion(question, questionIndex)
    )
  };
}

function normalizeExam(item) {
  const sections = parseJsonField(item.sections, []);

  return {
    id: item.id,
    teacherId: item.teacher_id || item.teacherId,
    title: item.title || 'Đề thi chưa đặt tên',
    description: item.description || '',
    courseKey: item.course_key || item.courseKey || '',
    assignmentScope: item.assignment_scope || item.assignmentScope || 'selected_students',
    status: item.status || 'draft',
    sections: (Array.isArray(sections) ? sections : []).map((section, index) => normalizeExamSection(section, index)),
    createdAt: item.created_at || item.createdAt,
    updatedAt: item.updated_at || item.updatedAt,
    recipients: (item.recipients || []).map((recipient) => ({
      studentEmail: recipient.student_email || recipient.studentEmail || ''
    }))
  };
}

function normalizeExamAttempt(item) {
  return {
    id: item.id || `${item.exam_id || item.examId}:${item.student_id || item.studentId}`,
    examId: item.exam_id || item.examId,
    studentId: item.student_id || item.studentId || '',
    studentEmail: item.student_email || item.studentEmail || '',
    answers: parseJsonField(item.answers, {}),
    sectionScores: parseJsonField(item.section_scores || item.sectionScores, []),
    score: Number(item.score || 0),
    maxScore: Number(item.max_score || item.maxScore || 0),
    status: item.status || 'submitted',
    startedAt: item.started_at || item.startedAt || '',
    submittedAt: item.submitted_at || item.submittedAt || ''
  };
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function normalizeFreeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function getQuestionMaxScore(question) {
  if (question.type === 'matching') {
    return question.pairs.length;
  }

  return 1;
}

export function scoreExamQuestion(question, answer) {
  const maxScore = getQuestionMaxScore(question);

  if (question.type === 'matching') {
    let score = 0;
    question.pairs.forEach((pair, index) => {
      if (answer && String(answer[index] ?? answer[String(index)] ?? '') === pair.right) {
        score += 1;
      }
    });
    return { score, maxScore };
  }

  if (question.type === 'fill_blank') {
    const normalized = normalizeFreeText(answer);
    const accepted = question.acceptedAnswers.length
      ? question.acceptedAnswers
      : [question.correctAnswer];
    const isCorrect = Boolean(normalized) && accepted.some((candidate) => normalizeFreeText(candidate) === normalized);
    return { score: isCorrect ? 1 : 0, maxScore };
  }

  // multiple_choice and true_false: exact match on the stored answer string.
  const isCorrect = String(answer ?? '') !== '' && String(answer) === question.correctAnswer;
  return { score: isCorrect ? 1 : 0, maxScore };
}

export function scoreExamAnswers(sections, answers = {}) {
  const sectionScores = sections.map((section) => {
    let score = 0;
    let maxScore = 0;

    section.questions.forEach((question) => {
      const result = scoreExamQuestion(question, answers[question.id]);
      score += result.score;
      maxScore += result.maxScore;
    });

    return {
      sectionId: section.id,
      type: section.type,
      title: section.title,
      score,
      maxScore
    };
  });

  return {
    sectionScores,
    score: sectionScores.reduce((total, section) => total + section.score, 0),
    maxScore: sectionScores.reduce((total, section) => total + section.maxScore, 0)
  };
}

export function getExamQuestionCount(exam) {
  return (exam?.sections || []).reduce((total, section) => total + section.questions.length, 0);
}

export function getExamDurationMinutes(exam) {
  return (exam?.sections || []).reduce((total, section) => total + section.durationMinutes, 0);
}

// ─── Local (mock) storage ─────────────────────────────────────────────────────

function readMockExams() {
  try {
    const rawValue = localStorage.getItem(MOCK_EXAMS_STORAGE_KEY);

    // First run: seed the demo exam so mock mode shows the whole flow.
    if (rawValue === null) {
      localStorage.setItem(MOCK_EXAMS_STORAGE_KEY, JSON.stringify(demoExams));
      return [...demoExams];
    }

    return JSON.parse(rawValue) || [];
  } catch {
    return [];
  }
}

function writeMockExams(exams = []) {
  try {
    localStorage.setItem(MOCK_EXAMS_STORAGE_KEY, JSON.stringify(exams));
    window.dispatchEvent(new CustomEvent('exams-updated', { detail: { exams } }));
  } catch {
    // ignore storage failures
  }
}

function buildMockExamRecord({ teacherId, exam, recipients = [], id }) {
  return {
    id: id || `mock-exam-${Date.now()}`,
    teacher_id: teacherId,
    title: exam.title,
    description: exam.description,
    course_key: exam.courseKey,
    assignment_scope: exam.assignmentScope,
    status: exam.status || 'draft',
    sections: exam.sections || [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    recipients: (recipients || []).map((email) => ({ student_email: email }))
  };
}

function persistMockExam(record) {
  const mockExams = readMockExams();
  const existing = mockExams.find((exam) => exam.id === record.id);
  const merged = existing ? { ...existing, ...record, updated_at: new Date().toISOString() } : record;

  writeMockExams([merged, ...mockExams.filter((exam) => exam.id !== record.id)]);
  return merged.id;
}

function removeMockExam(examId) {
  writeMockExams(readMockExams().filter((exam) => exam.id !== examId));
}

// Mock attempts live in ONE shared list (not per-student keys like assignments) so
// teacher/admin dashboards can show results after a mock-mode role switch.
function readMockExamAttempts() {
  try {
    const rawValue = localStorage.getItem(MOCK_EXAM_ATTEMPTS_STORAGE_KEY);
    return rawValue ? JSON.parse(rawValue) : [];
  } catch {
    return [];
  }
}

function writeMockExamAttempts(attempts = []) {
  try {
    localStorage.setItem(MOCK_EXAM_ATTEMPTS_STORAGE_KEY, JSON.stringify(attempts));
    window.dispatchEvent(new CustomEvent('exam-attempts-updated', { detail: { attempts } }));
  } catch {
    // ignore storage failures
  }
}

function persistMockExamAttempt(attempt) {
  const attempts = readMockExamAttempts();
  const key = `${attempt.examId}:${attempt.studentId || attempt.studentEmail}`;
  const withoutCurrent = attempts.filter(
    (item) => `${item.examId}:${item.studentId || item.studentEmail}` !== key
  );

  writeMockExamAttempts([attempt, ...withoutCurrent]);
  return attempt;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function withTimeout(promise, timeoutMs, timeoutMessage) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function mergeExamLists(primary = [], secondary = []) {
  const examMap = new Map();

  // secondary trước để primary (bản remote) thắng khi trùng id — bản local chỉ là
  // fallback offline, không được che dữ liệu mới từ server.
  [...secondary, ...primary].forEach((exam) => {
    if (exam?.id) {
      examMap.set(exam.id, exam);
    }
  });

  return Array.from(examMap.values()).sort(
    (left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0)
  );
}

function isExamVisibleToStudent(exam, normalizedEmail, ownedCourseIds) {
  if (exam.status !== 'published') {
    return false;
  }

  if (exam.assignmentScope === 'course_buyers') {
    return ownedCourseIds.has(String(exam.courseKey || '').toLowerCase());
  }

  return exam.recipients.some((recipient) => recipient.studentEmail.toLowerCase() === normalizedEmail);
}

const examSelect = `
  id,
  teacher_id,
  title,
  description,
  course_key,
  assignment_scope,
  status,
  sections,
  created_at,
  updated_at,
  recipients:exam_recipients(student_email)
`;

const attemptSelect =
  'id, exam_id, student_id, student_email, answers, section_scores, score, max_score, status, started_at, submitted_at';

function isMissingExamTables(error) {
  return /exam_attempts|exam_recipients|\bexams\b/i.test(error?.message || '');
}

// ─── Exams: read ──────────────────────────────────────────────────────────────

export async function getExamsForTeacher(teacherId) {
  const localExams = readMockExams()
    .map(normalizeExam)
    .filter((exam) => !teacherId || exam.teacherId === teacherId);

  if (!isSupabaseReady() || !teacherId) {
    return localExams;
  }

  const { data, error } = await withTimeout(
    supabase.from('exams').select(examSelect).eq('teacher_id', teacherId).order('created_at', { ascending: false }),
    8000,
    'Tải danh sách đề thi quá lâu.'
  ).catch((timeoutError) => ({ data: null, error: timeoutError }));

  if (error) {
    if (!isMissingExamTables(error)) {
      console.warn('[getExamsForTeacher]', error.message);
    }
    return localExams;
  }

  return mergeExamLists((data || []).map(normalizeExam), localExams).filter(
    (exam) => exam.teacherId === teacherId
  );
}

export async function getAllExams() {
  const localExams = readMockExams().map(normalizeExam);

  if (!isSupabaseReady()) {
    return localExams;
  }

  const { data, error } = await withTimeout(
    supabase.from('exams').select(examSelect).order('created_at', { ascending: false }),
    8000,
    'Tải danh sách đề thi quá lâu.'
  ).catch((timeoutError) => ({ data: null, error: timeoutError }));

  if (error) {
    if (!isMissingExamTables(error)) {
      console.warn('[getAllExams]', error.message);
    }
    return localExams;
  }

  return mergeExamLists((data || []).map(normalizeExam), localExams);
}

export async function getExamsForStudent(studentEmail, ownedCourseIds = getStoredPurchasedCourseIds()) {
  const normalizedEmail = String(studentEmail || '').toLowerCase();
  const ownedCourseIdSet = new Set(
    (ownedCourseIds || []).map((courseId) => String(courseId).toLowerCase()).filter(Boolean)
  );

  const localExams = readMockExams()
    .map(normalizeExam)
    .filter((exam) => isExamVisibleToStudent(exam, normalizedEmail, ownedCourseIdSet));

  if (!isSupabaseReady() || !studentEmail) {
    return localExams;
  }

  const { data, error } = await withTimeout(
    supabase.from('exams').select(examSelect).order('created_at', { ascending: false }),
    8000,
    'Tải danh sách đề thi quá lâu.'
  ).catch((timeoutError) => ({ data: null, error: timeoutError }));

  if (error) {
    if (!isMissingExamTables(error)) {
      console.warn('[getExamsForStudent]', error.message);
    }
    return localExams;
  }

  return mergeExamLists((data || []).map(normalizeExam), localExams).filter((exam) =>
    isExamVisibleToStudent(exam, normalizedEmail, ownedCourseIdSet)
  );
}

export async function getExamById(examId, { studentEmail, ownedCourseIds } = {}) {
  if (!examId) {
    return null;
  }

  const localExam = readMockExams()
    .map(normalizeExam)
    .find((exam) => exam.id === examId);

  if (!isSupabaseReady()) {
    return localExam || null;
  }

  const { data, error } = await withTimeout(
    supabase.from('exams').select(examSelect).eq('id', examId).maybeSingle(),
    8000,
    'Tải đề thi quá lâu.'
  ).catch((timeoutError) => ({ data: null, error: timeoutError }));

  if (error || !data) {
    return localExam || null;
  }

  return normalizeExam(data);
}

// ─── Exams: write ─────────────────────────────────────────────────────────────

export async function createExam({ teacherId, exam, recipients = [], accessToken } = {}) {
  const localRecord = buildMockExamRecord({ teacherId, exam, recipients });

  // Khi có phiên Supabase thật, lỗi remote phải nổi lên UI thay vì âm thầm rơi về
  // localStorage — nếu không giáo viên tưởng đã lưu nhưng server không có gì.
  if (accessToken && accessToken !== 'dev-token' && isSupabaseReady()) {
    const result = await apiFetch('/api/exams', {
      method: 'POST',
      token: accessToken,
      body: { teacherId, exam, recipients },
      timeoutMs: 10000
    });
    const createdId = result?.id || localRecord.id;
    persistMockExam({ ...localRecord, id: createdId });
    return createdId;
  }

  return persistMockExam(localRecord);
}

export async function updateExam({ examId, exam, recipients = [], accessToken } = {}) {
  const existing = readMockExams().find((item) => item.id === examId);

  if (accessToken && accessToken !== 'dev-token' && isSupabaseReady()) {
    await apiFetch(`/api/exams/${examId}`, {
      method: 'PUT',
      token: accessToken,
      body: { exam, recipients },
      timeoutMs: 10000
    });
  }

  persistMockExam({
    ...(existing || {}),
    id: examId,
    teacher_id: existing?.teacher_id || exam.teacherId,
    title: exam.title,
    description: exam.description,
    course_key: exam.courseKey,
    assignment_scope: exam.assignmentScope,
    status: exam.status,
    sections: exam.sections || [],
    created_at: existing?.created_at || new Date().toISOString(),
    recipients: (recipients || []).map((email) => ({ student_email: email }))
  });

  return examId;
}

export async function setExamStatus({ examId, status, accessToken } = {}) {
  const existing = readMockExams().find((item) => item.id === examId);

  if (accessToken && accessToken !== 'dev-token' && isSupabaseReady()) {
    await apiFetch(`/api/exams/${examId}`, {
      method: 'PUT',
      token: accessToken,
      body: { exam: { status } },
      timeoutMs: 10000
    });
  }

  if (existing) {
    persistMockExam({ ...existing, status });
  }

  return examId;
}

export async function deleteExam({ examId, accessToken } = {}) {
  if (accessToken && accessToken !== 'dev-token' && isSupabaseReady()) {
    await apiFetch(`/api/exams/${examId}`, {
      method: 'DELETE',
      token: accessToken,
      timeoutMs: 10000
    });
  }

  removeMockExam(examId);
  return examId;
}

// ─── Attempts ─────────────────────────────────────────────────────────────────

export async function saveExamAttempt({
  examId,
  studentId,
  studentEmail,
  answers,
  sectionScores,
  score,
  maxScore,
  status = 'submitted',
  startedAt
}) {
  const submittedAt = new Date().toISOString();
  const localAttempt = normalizeExamAttempt({
    examId,
    studentId: studentId || '',
    studentEmail: studentEmail || '',
    answers,
    sectionScores,
    score,
    maxScore,
    status,
    startedAt: startedAt || '',
    submittedAt
  });

  persistMockExamAttempt(localAttempt);

  if (!isSupabaseReady() || !studentId || String(studentId).startsWith('local-')) {
    return localAttempt;
  }

  const { data, error } = await supabase
    .from('exam_attempts')
    .upsert(
      {
        exam_id: examId,
        student_id: studentId,
        student_email: studentEmail || '',
        answers,
        section_scores: sectionScores,
        score,
        max_score: maxScore,
        status,
        started_at: startedAt || null,
        submitted_at: submittedAt
      },
      { onConflict: 'exam_id,student_id' }
    )
    .select(attemptSelect)
    .single();

  if (error) {
    if (!isMissingExamTables(error)) {
      console.warn('[saveExamAttempt]', error.message);
    }
    return localAttempt;
  }

  return normalizeExamAttempt(data);
}

export async function getExamAttemptsForStudent(studentId, studentEmail) {
  const normalizedEmail = String(studentEmail || '').toLowerCase();
  const localAttempts = readMockExamAttempts()
    .map(normalizeExamAttempt)
    .filter(
      (attempt) =>
        (studentId && attempt.studentId === studentId) ||
        (normalizedEmail && attempt.studentEmail.toLowerCase() === normalizedEmail)
    );

  if (!isSupabaseReady() || !studentId || String(studentId).startsWith('local-')) {
    return localAttempts;
  }

  const { data, error } = await supabase
    .from('exam_attempts')
    .select(attemptSelect)
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false });

  if (error) {
    if (!isMissingExamTables(error)) {
      console.warn('[getExamAttemptsForStudent]', error.message);
    }
    return localAttempts;
  }

  return (data || []).map(normalizeExamAttempt);
}

export async function getExamAttemptsForExams(examIds = []) {
  const examIdSet = new Set(examIds);
  const localAttempts = readMockExamAttempts()
    .map(normalizeExamAttempt)
    .filter((attempt) => examIdSet.has(attempt.examId));

  if (!isSupabaseReady() || !examIds.length) {
    return localAttempts;
  }

  const { data, error } = await supabase
    .from('exam_attempts')
    .select(attemptSelect)
    .in('exam_id', examIds)
    .order('submitted_at', { ascending: false });

  if (error) {
    if (!isMissingExamTables(error)) {
      console.warn('[getExamAttemptsForExams]', error.message);
    }
    return localAttempts;
  }

  const remoteAttempts = (data || []).map(normalizeExamAttempt);
  const seen = new Set(remoteAttempts.map((attempt) => `${attempt.examId}:${attempt.studentId || attempt.studentEmail}`));

  return [
    ...remoteAttempts,
    ...localAttempts.filter(
      (attempt) => !seen.has(`${attempt.examId}:${attempt.studentId || attempt.studentEmail}`)
    )
  ];
}

export async function getAllExamAttempts() {
  const localAttempts = readMockExamAttempts().map(normalizeExamAttempt);

  if (!isSupabaseReady()) {
    return localAttempts;
  }

  const { data, error } = await supabase
    .from('exam_attempts')
    .select(attemptSelect)
    .order('submitted_at', { ascending: false });

  if (error) {
    if (!isMissingExamTables(error)) {
      console.warn('[getAllExamAttempts]', error.message);
    }
    return localAttempts;
  }

  const remoteAttempts = (data || []).map(normalizeExamAttempt);
  const seen = new Set(remoteAttempts.map((attempt) => `${attempt.examId}:${attempt.studentId || attempt.studentEmail}`));

  return [
    ...remoteAttempts,
    ...localAttempts.filter(
      (attempt) => !seen.has(`${attempt.examId}:${attempt.studentId || attempt.studentEmail}`)
    )
  ];
}
