import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { getDashboardPathForRole, getEffectiveRole } from '../lib/permissions';
import {
  createAssignment,
  getAssignmentAttemptsForStudent,
  getAssignmentsForStudent,
  getAssignmentsForTeacher,
  getCourseOptions,
  MOCK_ASSIGNMENTS_STORAGE_KEY,
  saveAssignmentAttempt
} from '../lib/assignmentService';
import {
  getCourseBySlug,
  getCourseCatalog,
  getOwnedCourseIds,
  readAllTeacherManagedCourses,
  PURCHASED_COURSES_STORAGE_KEY,
  saveLessonQuestionsToSupabase
} from '../lib/courseService';
import { getLessonProgress, saveLessonProgress } from '../lib/progressService';
import {
  formatLessonCorrectAnswer,
  getCorrectOptionLabel,
  getLessonQuestionTypeLabel,
  isLessonQuestionAnswered,
  LESSON_QUESTION_TYPES,
  normalizeLessonQuestion,
  scoreLessonQuestion,
  scoreLessonQuestions
} from '../lib/lessonQuestions';
import { uploadLessonAudio } from '../lib/storageService';
import { AudioUploadField } from '../components/AudioUploadField';
import { logActivity } from '../lib/activityService';
import { usePageTitle } from '../hooks/usePageTitle';
import { PaginationControls, usePagination } from '../components/Pagination';
import { parseExcelQuestionFile } from '../lib/excelCourseParser';
import { getEmbeddableVideoUrl, getVideoEmbedIssue, getVideoSourceLabel } from '../lib/videoLinks';
import { courseDetail as mockCourseDetail } from '../data/mock';

const fallbackLessons = [
  { id: 'lesson-1', title: 'Bài 1. Giới thiệu bản thân', status: 'done', note: 'Khởi động và mẫu câu chào hỏi cơ bản' },
  { id: 'lesson-2', title: 'Bài 2. Phát âm trọng tâm', status: 'active', note: 'Bài học chính kèm luyện nghe và nhại âm' },
  { id: 'lesson-3', title: 'Bài 3. Hội thoại ngắn', status: 'locked', note: 'Mở khóa sau khi được cấp quyền học' },
  { id: 'lesson-4', title: 'Bài 4. Kiểm tra nhanh', status: 'locked', note: 'Bài đánh giá cuối chương' }
];

const defaultOcrText = `Hello = Xin chào
Teacher = Giảng viên
Practice = Luyện tập
Good morning = Chào buổi sáng`;

const ocrFallbackPairs = [
  { term: 'Hello', answer: 'Xin chào' },
  { term: 'Teacher', answer: 'Giảng viên' },
  { term: 'Practice', answer: 'Luyện tập' },
  { term: 'Good morning', answer: 'Chào buổi sáng' }
];

const ocrStatusLabels = {
  idle: 'Chờ tài liệu',
  processing: 'Đang giải nén / OCR',
  ready: 'Đã sinh bài tập',
  error: 'Cần kiểm tra lại'
};

const storageKeys = {
  audioByLesson: 'learning-audio-by-lesson',
  filesByLesson: 'learning-files-by-lesson',
  purchasedCourses: PURCHASED_COURSES_STORAGE_KEY
};

const learningRoomCachePrefix = 'learning-room-cache-v1';

function getLearningRoomCacheKey(courseKey = 'default', scope = 'global') {
  return `${learningRoomCachePrefix}:${String(scope || 'global').toLowerCase()}:${String(courseKey || 'default').toLowerCase()}`;
}

function readStoredJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    if (!value) return fallback;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function writeStoredJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage failures
  }
}

function readLearningRoomCache(courseKey, scope = 'global') {
  try {
    const rawValue = localStorage.getItem(getLearningRoomCacheKey(courseKey, scope));
    if (!rawValue) return null;
    const parsedValue = JSON.parse(rawValue);
    return parsedValue && typeof parsedValue === 'object' ? parsedValue : null;
  } catch {
    return null;
  }
}

function writeLearningRoomCache(courseKey, scope = 'global', snapshot) {
  try {
    localStorage.setItem(getLearningRoomCacheKey(courseKey, scope), JSON.stringify({
      ...snapshot,
      savedAt: new Date().toISOString()
    }));
  } catch {
    // ignore storage failures
  }
}

function getCourseRouteKey(course) {
  return course?.id || course?.slug || course?.databaseId || '';
}

function getCourseAccessKeys(course) {
  return [course?.id, course?.slug, course?.databaseId]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
}

function cloneFallbackLessons() {
  return (mockCourseDetail.sections || []).map((section) => ({
    ...section,
    lessons: Array.isArray(section.lessons)
      ? section.lessons.map((lesson) => ({ ...lesson }))
      : []
  }));
}

function createTeacherFallbackCourse(courseOptions = [], routeCourseKey = '') {
  const normalizedRouteKey = String(routeCourseKey || '').trim().toLowerCase();
  const matchedOption = courseOptions.find(
    (course) => String(course.key || '').trim().toLowerCase() === normalizedRouteKey
  );
  const fallbackOption = matchedOption || courseOptions[0] || null;

  return {
    ...mockCourseDetail,
    id: fallbackOption?.key || routeCourseKey || mockCourseDetail.id,
    databaseId: fallbackOption?.key || routeCourseKey || mockCourseDetail.id,
    slug: fallbackOption?.key || routeCourseKey || mockCourseDetail.slug,
    title: fallbackOption?.title || mockCourseDetail.title,
    hero: fallbackOption?.title
      ? `${fallbackOption.title} đang ở chế độ mẫu để giáo viên/quản trị vẫn có thể thao tác.`
      : mockCourseDetail.hero,
    summary: fallbackOption?.title || mockCourseDetail.hero,
    sections: cloneFallbackLessons()
  };
}

function createTeacherWorkspaceFallback(course, routeCourseKey = '') {
  const baseCourse = course || createTeacherFallbackCourse([], routeCourseKey);
  return {
    ...baseCourse,
    id: baseCourse.id || routeCourseKey || mockCourseDetail.id,
    databaseId: baseCourse.databaseId || baseCourse.id || routeCourseKey || mockCourseDetail.id,
    slug: baseCourse.slug || routeCourseKey || mockCourseDetail.slug,
    sections: cloneFallbackLessons()
  };
}

function formatAssignmentScope(scope) {
  return scope === 'course_buyers' ? 'Học viên đã mua khóa' : 'Học viên được chọn';
}

function getInitialTeacherDraft() {
  const firstCourse = getCourseOptions()[0] || { key: 'english-foundation', title: 'Tiếng Anh nền tảng A1-A2' };

  return {
    courseKey: firstCourse.key,
    courseTitle: firstCourse.title,
    title: 'Bài tập từ tài liệu OCR',
    description: 'Học viên hoàn thành các câu hỏi được tạo từ PDF, ảnh hoặc tài liệu Drive của giáo viên.',
    assignmentScope: 'course_buyers',
    recipientsText: '',
    attachmentName: '',
    attachmentUrl: ''
  };
}

function normalizeSourceText(text) {
  return String(text || '')
    .replace(/[^\S\r\n]+/g, ' ')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

function extractPdfText(rawText) {
  const plainText = String(rawText || '')
    .replace(/\\([()\\])/g, '$1')
    .replace(/[^\x20-\x7EÀ-ỹ\r\n]+/g, ' ');
  const directText = [...plainText.matchAll(/\(([^()]{3,140})\)\s*Tj/g)].map((match) => match[1]);
  const groupedText = [...plainText.matchAll(/\[((?:.|\n){3,600}?)\]\s*TJ/g)]
    .flatMap((match) => [...match[1].matchAll(/\(([^()]{2,140})\)/g)].map((textMatch) => textMatch[1]));
  const extracted = normalizeSourceText([...directText, ...groupedText].join('\n'));

  return extracted.length > 24 ? extracted : '';
}

function extractLearningPairs(text) {
  const rows = normalizeSourceText(text).split('\n');
  const pairs = rows
    .map((line) => line.match(/^(.{2,42}?)(?:\s*[=:–-]\s*|\s{2,})(.{2,70})$/))
    .filter(Boolean)
    .map((match) => ({
      term: match[1].replace(/^\d+[.)]\s*/, '').trim(),
      answer: match[2].trim()
    }))
    .filter((pair) => pair.term && pair.answer && pair.term.toLowerCase() !== pair.answer.toLowerCase());

  if (pairs.length >= 3) {
    return pairs.slice(0, 6);
  }

  return ocrFallbackPairs;
}

function makeQuestionOptions(correctAnswer, index) {
  const uniquePool = Array.from(
    new Set([
      correctAnswer,
      ...ocrFallbackPairs.map((pair) => pair.answer),
      'Tạm biệt',
      'Cảm ơn',
      'Phát âm',
      'Hội thoại'
    ].filter(Boolean))
  );
  const rotatedPool = [...uniquePool.slice(index), ...uniquePool.slice(0, index)];
  const options = rotatedPool.slice(0, 4);

  return options.includes(correctAnswer)
    ? options
    : [correctAnswer, ...options.filter((option) => option !== correctAnswer).slice(0, 3)];
}

function buildOcrExercises(text, sourceName = 'tài liệu') {
  return extractLearningPairs(text).slice(0, 4).map((pair, index) => ({
    id: `ocr-${index + 1}`,
    enabled: true,
    prompt: `Theo ${sourceName}, "${pair.term}" có nghĩa là gì?`,
    options: makeQuestionOptions(pair.answer, index),
    correctAnswer: pair.answer,
    explanation: `Câu hỏi được tạo từ nội dung OCR của ${sourceName}.`
  }));
}

function normalizeLessonStatus(status, index) {
  const normalized = String(status || '').toLowerCase();

  if (['done', 'active', 'locked'].includes(normalized)) {
    return normalized;
  }

  if (normalized.includes('hoàn thành')) {
    return 'done';
  }

  if (normalized.includes('đang học') || normalized.includes('active')) {
    return 'active';
  }

  return index <= 1 ? 'active' : 'locked';
}

function isLessonComplete(lesson, lessonProgressMap) {
  return Boolean(lessonProgressMap[lesson.id]?.completed || lesson.status === 'done');
}

function buildLessonsFromCourse(course) {
  if (!course) {
    return [];
  }

  const flattenedLessons = (course?.sections || [])
    .flatMap((section, sectionIndex) =>
      (section.lessons || []).map((lesson) => ({
        ...lesson,
        sectionTitle: section.title,
        // Khóa nhóm chương ổn định — khác sectionTitle (chuỗi), vốn có thể trùng
        // nhau giữa 2 chương nếu giáo viên đặt tên giống nhau.
        sectionIndex
      }))
    )
    .filter((lesson) => lesson.title);

  return flattenedLessons.map((lesson, index) => ({
    ...lesson,
    id: lesson.id || lesson.databaseId || `lesson-${index + 1}`,
    databaseId: lesson.databaseId || (/^[0-9a-f-]{36}$/i.test(lesson.id || '') ? lesson.id : ''),
    title: lesson.title,
    status: normalizeLessonStatus(lesson.status, index),
    note: lesson.note || lesson.sectionTitle || `Bước ${index + 1} trong lộ trình ${course.title}`,
    lessonNumber: lesson.lessonNumber || String(index + 1),
    exerciseType: lesson.exerciseType || lesson.type || 'Bài học',
    questionCount: Number(lesson.questionCount || lesson.exercises?.length || lesson.questions?.length || 0),
    exercises: Array.isArray(lesson.exercises)
      ? lesson.exercises
      : Array.isArray(lesson.questions)
        ? lesson.questions
        : []
  }));
}

function parseRecipients(recipientsText) {
  return String(recipientsText || '')
    .split(/[\n,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

// Chuyển exerciseConfig của bài tập giao (mcq/tf/match/blank) sang model câu hỏi
// typed dùng chung với bài giảng, để học viên làm được mọi dạng chứ không chỉ MCQ.
function getAssignmentQuestions(assignment) {
  const config = assignment.exerciseConfig || {};
  const generatedQuestions = Array.isArray(config.generatedQuestions) ? config.generatedQuestions : [];

  if (generatedQuestions.length) {
    return generatedQuestions
      .filter((question) => question?.prompt)
      .map((question, index) =>
        normalizeLessonQuestion(
          {
            id: `q-${index}`,
            type: 'multiple_choice',
            prompt: question.prompt,
            options: (question.options || []).filter(Boolean),
            correctAnswer: question.correctAnswer,
            explanation: question.explanation || ''
          },
          index
        )
      );
  }

  const type = config.type || 'mcq';

  if (type === 'tf') {
    return [
      normalizeLessonQuestion({
        id: 'q-0',
        type: 'true_false',
        prompt: config.prompt || 'Nhận định sau đúng hay sai?',
        correctAnswer: /đúng|true/i.test(String(config.trueFalseAnswer || 'Đúng')) ? 'true' : 'false',
        explanation: config.explanation || ''
      })
    ];
  }

  if (type === 'match') {
    const pairs = (config.pairs || []).filter((pair) => pair?.term && pair?.answer);
    if (!pairs.length) {
      return [];
    }
    return [
      normalizeLessonQuestion({
        id: 'q-0',
        type: 'matching',
        prompt: config.prompt || 'Nối mỗi mục với đáp án phù hợp.',
        pairs,
        explanation: config.explanation || ''
      })
    ];
  }

  if (type === 'blank') {
    if (!config.blankAnswer) {
      return [];
    }
    return [
      normalizeLessonQuestion({
        id: 'q-0',
        type: 'fill_blank',
        prompt: config.blankText || config.prompt || '',
        acceptedAnswers: [config.blankAnswer],
        explanation: config.explanation || ''
      })
    ].filter((question) => question.prompt);
  }

  if (type === 'flash') {
    // Thẻ ghi nhớ không có đáp án chấm được — không tạo câu hỏi tương tác.
    return [];
  }

  return [
    normalizeLessonQuestion({
      id: 'q-0',
      type: 'multiple_choice',
      prompt: config.prompt || 'Chọn đáp án đúng.',
      options: (config.options || []).filter(Boolean),
      correctAnswer: config.correctAnswer,
      explanation: config.explanation || ''
    })
  ].filter((question) => question.prompt && question.options.length);
}

function normalizeExerciseAnswer(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

const OPTION_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function normalizeExerciseOption(option, index) {
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

function getCorrectLabelFromAnswer(rawAnswer, options) {
  const normalizedAnswer = normalizeExerciseAnswer(rawAnswer);

  if (normalizedAnswer) {
    const byLabel = options.find((option) => normalizeExerciseAnswer(option.label) === normalizedAnswer);
    if (byLabel) {
      return byLabel.label;
    }
  }

  const byText = options.find(
    (option) => option.text.trim().toLowerCase() === String(rawAnswer || '').trim().toLowerCase()
  );

  return byText?.label || normalizedAnswer;
}

function createVideoQuestionOption(index, text = '') {
  return {
    label: OPTION_LABELS[index] || String(index + 1),
    text
  };
}

function createVideoQuestion(index = 0) {
  return {
    id: `video-question-${Date.now()}-${index}`,
    type: 'multiple_choice',
    prompt: '',
    options: [0, 1, 2, 3].map((optionIndex) => createVideoQuestionOption(optionIndex)),
    correctAnswer: 'A',
    acceptedAnswersText: '',
    pairsText: '',
    sampleAnswer: '',
    audioUrl: '',
    audioName: '',
    explanation: ''
  };
}

// Bản ghi đã lưu (typed hoặc MCQ cũ) → state của editor. Các field danh sách được
// chuyển sang dạng text để giáo viên sửa nhanh (pairs → "trái = phải" từng dòng,
// acceptedAnswers → chuỗi phân cách dấu phẩy).
function normalizeVideoQuestionDraft(question, index = 0) {
  const normalized = normalizeLessonQuestion(question, index);
  const options = normalized.options.length
    ? normalized.options.map((option, optionIndex) => ({
        label: OPTION_LABELS[optionIndex] || String(optionIndex + 1),
        text: option.text
      }))
    : [0, 1, 2, 3].map((optionIndex) => createVideoQuestionOption(optionIndex));
  const firstOptionLabel = options[0]?.label || 'A';

  let correctAnswer = normalized.correctAnswer;
  if (normalized.type === 'multiple_choice') {
    const label = getCorrectLabelFromAnswer(normalized.correctAnswer || firstOptionLabel, options);
    correctAnswer = options.some((option) => option.label === label) ? label : firstOptionLabel;
  } else if (normalized.type === 'true_false') {
    correctAnswer = ['true', 'false'].includes(normalized.correctAnswer) ? normalized.correctAnswer : 'true';
  }

  return {
    id: String(question?.id || `video-question-${Date.now()}-${index}`).trim(),
    type: normalized.type,
    prompt: normalized.prompt,
    options,
    correctAnswer,
    acceptedAnswersText: normalized.acceptedAnswers.join(', '),
    pairsText: normalized.pairs.map((pair) => `${pair.left} = ${pair.right}`).join('\n'),
    sampleAnswer: normalized.sampleAnswer,
    audioUrl: normalized.audioUrl,
    audioName: normalized.audioName,
    explanation: normalized.explanation
  };
}

function prepareVideoQuestionsForSave(questions) {
  return (Array.isArray(questions) ? questions : [])
    .map((question, index) => {
      const type = LESSON_QUESTION_TYPES.some((item) => item.value === question.type)
        ? question.type
        : 'multiple_choice';

      const base = {
        id: question.id || `video-question-${index + 1}`,
        type,
        prompt: String(question.prompt || '').trim(),
        options: [],
        correctAnswer: '',
        acceptedAnswers: [],
        pairs: [],
        sampleAnswer: '',
        audioUrl: String(question.audioUrl || '').trim(),
        audioName: String(question.audioName || '').trim(),
        explanation: String(question.explanation || '').trim()
      };

      if (type === 'multiple_choice') {
        const options = (Array.isArray(question.options) ? question.options : [])
          .map(normalizeExerciseOption)
          .filter((option) => option.text)
          .map((option, optionIndex) => ({
            label: OPTION_LABELS[optionIndex] || option.label || String(optionIndex + 1),
            text: option.text
          }));
        const correctAnswer = getCorrectLabelFromAnswer(question.correctAnswer, options);
        base.options = options;
        base.correctAnswer = options.some((option) => option.label === correctAnswer)
          ? correctAnswer
          : options[0]?.label || '';
      } else if (type === 'true_false') {
        base.correctAnswer = question.correctAnswer === 'false' ? 'false' : 'true';
      } else if (type === 'fill_blank' || type === 'listening') {
        base.acceptedAnswers = String(question.acceptedAnswersText || '')
          .split(',')
          .map((answer) => answer.trim())
          .filter(Boolean);
      } else if (type === 'matching') {
        base.pairs = String(question.pairsText || '')
          .split('\n')
          .map((line) => {
            const [left, right] = line.split('=');
            return { left: (left || '').trim(), right: (right || '').trim() };
          })
          .filter((pair) => pair.left && pair.right);
      } else if (type === 'writing') {
        base.sampleAnswer = String(question.sampleAnswer || '').trim();
      }

      return base;
    })
    .filter((question) => question.prompt);
}

function parsePastedVideoQuestions(text) {
  const blocks = [];
  let currentBlock = [];

  String(text || '')
    .split(/\r?\n/)
    .forEach((rawLine) => {
      const line = rawLine.trim();
      const startsNewQuestion = /^(?:câu|cau|question)?\s*\d+[\).:\-]\s+/i.test(line);

      if (!line) {
        if (currentBlock.length) {
          blocks.push(currentBlock);
          currentBlock = [];
        }
        return;
      }

      if (startsNewQuestion && currentBlock.length) {
        blocks.push(currentBlock);
        currentBlock = [line];
        return;
      }

      currentBlock.push(line);
    });

  if (currentBlock.length) {
    blocks.push(currentBlock);
  }

  return blocks
    .filter((lines) => lines.length)
    .map((lines, blockIndex) => {
      const promptLines = [];
      const options = [];
      let correctAnswer = '';
      let explanation = '';

      lines.forEach((line) => {
        const answerMatch = line.match(/^(?:đáp\s*án|dap\s*an|answer|correct)\s*[:：-]\s*(.+)$/i);
        const explanationMatch = line.match(/^(?:giải\s*thích|giai\s*thich|explanation)\s*[:：-]\s*(.+)$/i);
        const optionMatch = line.match(/^([A-Z])[\).:\-]\s*(.+)$/i);

        if (answerMatch) {
          correctAnswer = answerMatch[1].trim();
          return;
        }

        if (explanationMatch) {
          explanation = explanationMatch[1].trim();
          return;
        }

        if (optionMatch) {
          options.push({
            label: optionMatch[1].trim().toUpperCase(),
            text: optionMatch[2].trim()
          });
          return;
        }

        promptLines.push(line.replace(/^(?:câu|cau|question)?\s*\d+[\).:\-]?\s*/i, '').trim());
      });

      const normalizedOptions = options.length
        ? options.map((option, optionIndex) => ({
            label: OPTION_LABELS[optionIndex] || option.label || String(optionIndex + 1),
            text: option.text
          }))
        : [0, 1, 2, 3].map((optionIndex) => createVideoQuestionOption(optionIndex));
      const normalizedCorrectAnswer = getCorrectLabelFromAnswer(
        correctAnswer || normalizedOptions[0]?.label,
        normalizedOptions
      );

      return normalizeVideoQuestionDraft({
        id: `video-question-paste-${Date.now()}-${blockIndex}`,
        prompt: promptLines.join(' '),
        options: normalizedOptions,
        correctAnswer: normalizedCorrectAnswer,
        explanation
      }, blockIndex);
    })
    .filter((question) => question.prompt);
}

function LessonVideoPlayer({ lesson, isTeacher, dashboardPath }) {
  const rawVideoUrl = lesson?.videoUrl || lesson?.videoEmbedUrl || '';
  const videoUrl = getEmbeddableVideoUrl(rawVideoUrl);
  const videoIssue = getVideoEmbedIssue(rawVideoUrl);

  if (!videoUrl) {
    return (
      <section className="content-card content-card--enterprise lesson-video-empty">
        <span className="eyebrow">Video bài học</span>
        <h2>{lesson?.title || 'Bài học'}</h2>
        <p>
          {videoIssue ||
            (isTeacher
            ? 'Bài này chưa có link video Google Drive. Hãy mở bảng giảng viên để gắn video cho từng bài.'
            : 'Bài học này chưa có video. Bạn vẫn có thể làm phần bài tập bên dưới nếu đã được mở khóa.')}
        </p>
        {rawVideoUrl ? (
          <a className="button-ghost" href={rawVideoUrl} target="_blank" rel="noreferrer">
            Mở link gốc
          </a>
        ) : isTeacher ? (
          <Link className="button-ghost" to={dashboardPath || '/dashboard/teacher'}>
            Sửa video bài học
          </Link>
        ) : null}
      </section>
    );
  }

  return (
    <section className="content-card content-card--enterprise lesson-video-panel">
      <div className="section-head">
        <div>
          <span className="eyebrow">Video bài học</span>
          <h2>{lesson?.videoTitle || lesson?.title || 'Bài học'}</h2>
          <p>{lesson?.note || 'Xem video trước, sau đó làm bài tập bên dưới.'}</p>
        </div>
        <span className="pill">{getVideoSourceLabel(rawVideoUrl)}</span>
      </div>
      <div className="lesson-video-panel__frame">
        <iframe
          src={videoUrl}
          title={lesson?.videoTitle || lesson?.title || 'Video bài học'}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    </section>
  );
}

// Trộn ổn định vế phải của câu nối — thứ tự không đổi giữa các lần render
// nhưng khác thứ tự gốc để không lộ đáp án.
function stableShuffleValues(values, seed) {
  function hash(text) {
    let value = 0;
    for (let i = 0; i < text.length; i++) {
      value = (value * 31 + text.charCodeAt(i)) >>> 0;
    }
    return value;
  }

  return [...values].sort((left, right) => hash(`${seed}:${left}`) - hash(`${seed}:${right}`));
}

function LessonMatchingInput({ question, answer, onChange, disabled }) {
  const rightOptions = useMemo(
    () => stableShuffleValues(question.pairs.map((pair) => pair.right), question.id),
    [question]
  );

  function setPairAnswer(index, value) {
    onChange({ ...(answer || {}), [index]: value });
  }

  return (
    <div className="exam-matching">
      {question.pairs.map((pair, index) => (
        <div key={`${pair.left}-${index}`} className="exam-matching__row">
          <span className="exam-matching__left">{pair.left}</span>
          <select
            value={String(answer?.[index] ?? answer?.[String(index)] ?? '')}
            onChange={(event) => setPairAnswer(index, event.target.value)}
            disabled={disabled}
          >
            <option value="">-- Chọn --</option>
            {rightOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

// Ô nhập câu trả lời theo dạng bài — dùng chung cho bài tập bài giảng và bài tập giao.
// revealAnswer: tô màu đáp án đúng/sai trên các nút chọn (sau khi nộp hoặc giáo viên xem).
function LessonQuestionInput({ question, answer, onChange, disabled, revealAnswer }) {
  if (question.type === 'true_false') {
    const correctValue = revealAnswer ? question.correctAnswer : '';
    return (
      <div className="excel-option-grid">
        {[
          { value: 'true', label: 'Đúng' },
          { value: 'false', label: 'Sai' }
        ].map((choice) => {
          const isSelected = String(answer ?? '') === choice.value;
          return (
            <button
              key={choice.value}
              type="button"
              className={[
                'answer-pill',
                isSelected ? 'is-active' : '',
                correctValue === choice.value ? 'is-correct' : '',
                revealAnswer && isSelected && correctValue !== choice.value ? 'is-wrong' : ''
              ].filter(Boolean).join(' ')}
              onClick={() => onChange(choice.value)}
              disabled={disabled}
            >
              {choice.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (question.type === 'fill_blank' || question.type === 'listening') {
    return (
      <input
        className="exam-fill-input"
        type="text"
        value={String(answer ?? '')}
        placeholder={
          question.type === 'listening' ? 'Gõ lại những gì bạn nghe được...' : 'Gõ đáp án của bạn...'
        }
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    );
  }

  if (question.type === 'matching') {
    return <LessonMatchingInput question={question} answer={answer} onChange={onChange} disabled={disabled} />;
  }

  if (question.type === 'writing') {
    return (
      <textarea
        className="lesson-input lesson-writing-input"
        rows={4}
        value={String(answer ?? '')}
        placeholder="Viết câu trả lời của bạn..."
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    );
  }

  const correctLabel = revealAnswer ? getCorrectOptionLabel(question) : '';
  return (
    <div className="excel-option-grid">
      {question.options.map((option) => {
        const isSelected = String(answer ?? '') === option.label;
        return (
          <button
            key={`${question.id}-${option.label}`}
            type="button"
            className={[
              'answer-pill',
              isSelected ? 'is-active' : '',
              correctLabel === option.label ? 'is-correct' : '',
              revealAnswer && isSelected && correctLabel && correctLabel !== option.label ? 'is-wrong' : ''
            ].filter(Boolean).join(' ')}
            onClick={() => onChange(option.label)}
            disabled={disabled}
          >
            {option.label}. {option.text}
          </button>
        );
      })}
    </div>
  );
}

function LessonQuestionFeedback({ question, answer }) {
  const { score, maxScore } = scoreLessonQuestion(question, answer);

  if (!maxScore) {
    if (question.type === 'writing' && question.sampleAnswer) {
      return (
        <div className="exercise-feedback">
          <strong>Đáp án mẫu:</strong> {question.sampleAnswer}
          {question.explanation ? <div className="exercise-feedback__note">{question.explanation}</div> : null}
        </div>
      );
    }
    return question.explanation ? <div className="exercise-feedback">{question.explanation}</div> : null;
  }

  const isCorrect = score === maxScore;
  const message = isCorrect
    ? question.type === 'matching'
      ? `Chính xác cả ${maxScore} cặp.`
      : 'Chính xác.'
    : question.type === 'matching'
      ? `Đúng ${score}/${maxScore} cặp. Đáp án: ${formatLessonCorrectAnswer(question)}`
      : `Chưa đúng. Đáp án: ${formatLessonCorrectAnswer(question)}`;

  return (
    <div className={isCorrect ? 'exercise-feedback success' : 'exercise-feedback'}>
      {message}
      {question.explanation ? <div className="exercise-feedback__note">{question.explanation}</div> : null}
    </div>
  );
}

// Bài luyện đọc / bảng phiên âm (import HSK vỡ lòng): không có video hay câu hỏi
// chấm điểm — hiển thị bảng phiên âm + danh sách chữ/âm để đọc, có nút phát âm
// bằng giọng đọc tiếng Trung sẵn có của trình duyệt (không cần file audio).
function isReadingLesson(lesson) {
  const hasReading = Array.isArray(lesson?.readingItems) && lesson.readingItems.length > 0;
  const hasTable = Boolean(lesson?.pinyinTable);
  const hasExercises = Array.isArray(lesson?.exercises) && lesson.exercises.length > 0;
  return (hasReading || hasTable) && !hasExercises;
}

function speakChinese(text) {
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

const PINYIN_INITIALS = [
  ['b', 'p', 'm', 'f'],
  ['d', 't', 'n', 'l'],
  ['g', 'k', 'h'],
  ['j', 'q', 'x'],
  ['zh', 'ch', 'sh', 'r'],
  ['z', 'c', 's']
];
const PINYIN_FINALS = [
  ['a', 'o', 'e', 'i', 'u', 'ü'],
  ['ai', 'ei', 'ao', 'ou'],
  ['an', 'en', 'ang', 'eng', 'ong'],
  ['ia', 'ie', 'iao', 'iu', 'ian', 'in', 'iang', 'ing', 'iong'],
  ['ua', 'uo', 'uai', 'ui', 'uan', 'un', 'uang', 'ueng'],
  ['üe', 'üan', 'ün']
];
const PINYIN_TONES = [
  { mark: 'mā', name: 'Thanh 1 (ngang)' },
  { mark: 'má', name: 'Thanh 2 (sắc)' },
  { mark: 'mǎ', name: 'Thanh 3 (hỏi/uốn)' },
  { mark: 'mà', name: 'Thanh 4 (huyền/nặng)' },
  { mark: 'ma', name: 'Thanh nhẹ' }
];

function PinyinCell({ text }) {
  return (
    <button type="button" className="pinyin-cell" onClick={() => speakChinese(text)} title={`Nghe "${text}"`}>
      {text}
    </button>
  );
}

function PinyinReferenceTable() {
  return (
    <div className="pinyin-reference">
      <div className="pinyin-block">
        <h3>Thanh mẫu (声母)</h3>
        <div className="pinyin-rows">
          {PINYIN_INITIALS.map((row) => (
            <div key={row.join('')} className="pinyin-row">
              {row.map((item) => (
                <PinyinCell key={item} text={item} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="pinyin-block">
        <h3>Vận mẫu (韵母)</h3>
        <div className="pinyin-rows">
          {PINYIN_FINALS.map((row) => (
            <div key={row.join('')} className="pinyin-row">
              {row.map((item) => (
                <PinyinCell key={item} text={item} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="pinyin-block">
        <h3>Thanh điệu (声调)</h3>
        <div className="pinyin-row">
          {PINYIN_TONES.map((tone) => (
            <button
              key={tone.mark}
              type="button"
              className="pinyin-cell pinyin-cell--tone"
              onClick={() => speakChinese(tone.mark)}
              title={tone.name}
            >
              <strong>{tone.mark}</strong>
              <small>{tone.name}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LessonReadingPanel({ lesson }) {
  const items = Array.isArray(lesson?.readingItems) ? lesson.readingItems : [];
  const ttsSupported = typeof window !== 'undefined' && Boolean(window.speechSynthesis);

  return (
    <section className="content-card content-card--enterprise reading-panel">
      <div className="section-head">
        <div>
          <span className="eyebrow">{lesson.pinyinTable ? 'Bảng phiên âm' : 'Luyện đọc'}</span>
          <h2>{lesson.exerciseType || 'Luyện đọc'}</h2>
          <p>
            {ttsSupported
              ? 'Bấm vào từng ô để nghe phát âm mẫu (giọng đọc tiếng Trung của trình duyệt), rồi đọc nhắc lại. Xong bấm “Đánh dấu hoàn thành” bên dưới.'
              : 'Đọc theo từng mục bên dưới, rồi bấm “Đánh dấu hoàn thành” bên dưới.'}
          </p>
        </div>
        <span className="pill">{lesson.pinyinTable ? 'Bảng tra' : `${items.length} mục`}</span>
      </div>

      {lesson.pinyinTable ? <PinyinReferenceTable /> : null}

      {items.length ? (
        <div className="reading-grid">
          {items.map((item, index) => (
            <button
              type="button"
              key={`${item}-${index}`}
              className="reading-card"
              onClick={() => speakChinese(item)}
              title={`Nghe "${item}"`}
            >
              <span className="reading-card__text">{item}</span>
              {ttsSupported ? <span className="reading-card__play" aria-hidden="true">🔊</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function LessonExercisePreview({ lesson, isTeacher, onSubmitted }) {
  const questions = useMemo(
    () => (Array.isArray(lesson?.exercises) ? lesson.exercises : []).map(normalizeLessonQuestion),
    [lesson?.exercises]
  );
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setAnswers({});
    setSubmitted(false);
  }, [lesson?.id]);

  if (!questions.length) {
    return null;
  }

  const answeredCount = questions.filter((question) =>
    isLessonQuestionAnswered(question, answers[question.id])
  ).length;
  const result = scoreLessonQuestions(questions, answers);
  const canSubmit = questions.length > 0 && answeredCount === questions.length;

  function setAnswer(questionId, value) {
    setAnswers((previous) => ({ ...previous, [questionId]: value }));
  }

  return (
    <section className="content-card content-card--enterprise excel-lesson-panel">
      <div className="section-head">
        <div>
          <span className="eyebrow">Câu hỏi của video</span>
          <h2>{lesson.exerciseType || 'Bài luyện sau video'}</h2>
          <p>{questions.length} câu hỏi được giáo viên giao riêng cho bài học này.</p>
        </div>
        <span className="pill">{lesson.sourceSheet || 'Video'}</span>
      </div>

      {lesson.audioUrl || lesson.imageUrl ? (
        <div className="lesson-asset-strip">
          {lesson.audioUrl ? (
            <div className="lesson-upload-box">
              <strong>{lesson.audioName || 'File nghe'}</strong>
              <audio controls src={lesson.audioUrl} className="lesson-audio" />
            </div>
          ) : null}
          {lesson.imageUrl ? (
            <div className="lesson-upload-box">
              <strong>{lesson.imageName || 'Ảnh minh họa'}</strong>
              <img className="lesson-image-preview" src={lesson.imageUrl} alt={lesson.imageName || lesson.title} />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="excel-exercise-list">
        {questions.map((question, index) => (
          <article key={question.id} className="excel-exercise-row">
            <div className="excel-exercise-row__head">
              <span>Câu {index + 1}</span>
              <strong>{question.prompt || `Mục ${index + 1}`}</strong>
              <span className="pill lesson-question__type">{getLessonQuestionTypeLabel(question.type)}</span>
            </div>

            {question.imageHanzi ? (
              <button
                type="button"
                className="lesson-question__hanzi"
                onClick={() => speakChinese(question.imageHanzi)}
                title={`Nghe "${question.imageHanzi}"`}
              >
                {question.imageHanzi}
              </button>
            ) : null}

            {question.audioUrl ? (
              <div className="lesson-question__audio">
                <audio controls src={question.audioUrl} preload="auto" />
              </div>
            ) : question.audioPending ? (
              <div className="lesson-question__audio-pending">
                🎧 Câu nghe — audio phát âm sẽ được cập nhật. Đáp án đúng đã được thiết lập sẵn.
              </div>
            ) : null}

            <LessonQuestionInput
              question={question}
              answer={answers[question.id]}
              onChange={(value) => setAnswer(question.id, value)}
              disabled={isTeacher || submitted}
              revealAnswer={isTeacher || submitted}
            />

            {submitted && !isTeacher ? (
              <LessonQuestionFeedback question={question} answer={answers[question.id]} />
            ) : null}

            <div className="excel-exercise-row__meta">
              {isTeacher && formatLessonCorrectAnswer(question) ? (
                <span className="pill">Đáp án: {formatLessonCorrectAnswer(question)}</span>
              ) : null}
              {question.explanation && isTeacher ? <small>{question.explanation}</small> : null}
            </div>
          </article>
        ))}
      </div>

      {!isTeacher && questions.length ? (
        <div className="excel-lesson-panel__footer">
          <span>
            {submitted
              ? result.maxScore
                ? `Kết quả: ${result.score}/${result.maxScore} điểm${
                    result.selfGradedCount ? ` · ${result.selfGradedCount} câu tự đối chiếu` : ''
                  }`
                : 'Đã nộp — hãy tự đối chiếu với đáp án mẫu.'
              : `${answeredCount}/${questions.length} câu đã trả lời`}
          </span>
          {submitted ? (
            <button
              type="button"
              className="button-ghost"
              onClick={() => {
                setAnswers({});
                setSubmitted(false);
              }}
            >
              Làm lại
            </button>
          ) : (
            <button
              type="button"
              className="button"
              onClick={() => {
                setSubmitted(true);
                onSubmitted?.();
              }}
              disabled={!canSubmit}
            >
              Kiểm tra đáp án
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}

function QuestionAudioField({ question, lessonId, onChange }) {
  return (
    <AudioUploadField
      audioUrl={question.audioUrl}
      audioName={question.audioName}
      onUploaded={({ audioUrl, audioName }) => onChange({ audioUrl, audioName })}
      onClear={() => onChange({ audioUrl: '', audioName: '' })}
      upload={(file, onProgress) => uploadLessonAudio(file, lessonId, onProgress)}
    />
  );
}

function VideoQuestionEditor({ lesson, saving, status, onSave }) {
  const lessonQuestionsKey = useMemo(() => JSON.stringify(lesson?.exercises || []), [lesson?.exercises]);
  const [draftQuestions, setDraftQuestions] = useState(() =>
    (lesson?.exercises || []).map(normalizeVideoQuestionDraft)
  );
  const [pasteText, setPasteText] = useState('');
  const [pasteStatus, setPasteStatus] = useState('');
  const [importStatus, setImportStatus] = useState('');

  useEffect(() => {
    setDraftQuestions((lesson?.exercises || []).map(normalizeVideoQuestionDraft));
    setPasteText('');
    setPasteStatus('');
    setImportStatus('');
  }, [lesson?.id, lessonQuestionsKey]);

  function updateQuestion(questionId, patch) {
    setDraftQuestions((previous) =>
      previous.map((question) => (question.id === questionId ? { ...question, ...patch } : question))
    );
  }

  function updateOption(questionId, optionIndex, value) {
    setDraftQuestions((previous) =>
      previous.map((question) => {
        if (question.id !== questionId) {
          return question;
        }

        const nextOptions = question.options.map((option, index) =>
          index === optionIndex ? { ...option, text: value } : option
        );

        return {
          ...question,
          options: nextOptions
        };
      })
    );
  }

  function addQuestion() {
    setDraftQuestions((previous) => [...previous, createVideoQuestion(previous.length + 1)]);
    setPasteStatus('');
  }

  function deleteQuestion(questionId) {
    setDraftQuestions((previous) => previous.filter((question) => question.id !== questionId));
    setPasteStatus('');
  }

  function addOption(questionId) {
    setDraftQuestions((previous) =>
      previous.map((question) => {
        if (question.id !== questionId) {
          return question;
        }

        return {
          ...question,
          options: [...question.options, createVideoQuestionOption(question.options.length)]
        };
      })
    );
  }

  function removeOption(questionId, optionIndex) {
    setDraftQuestions((previous) =>
      previous.map((question) => {
        if (question.id !== questionId) {
          return question;
        }

        const nextOptions = question.options
          .filter((_, index) => index !== optionIndex)
          .map((option, index) => ({
            label: OPTION_LABELS[index] || String(index + 1),
            text: option.text
          }));
        const hasCorrectAnswer = nextOptions.some((option) => option.label === question.correctAnswer);

        return {
          ...question,
          options: nextOptions,
          correctAnswer: hasCorrectAnswer ? question.correctAnswer : nextOptions[0]?.label || ''
        };
      })
    );
  }

  function handlePasteQuestions() {
    const parsedQuestions = parsePastedVideoQuestions(pasteText);

    if (!parsedQuestions.length) {
      setPasteStatus('Chưa đọc được câu hỏi nào từ nội dung dán.');
      return;
    }

    setDraftQuestions((previous) => [...previous, ...parsedQuestions]);
    setPasteText('');
    setPasteStatus(`Đã thêm ${parsedQuestions.length} câu hỏi từ nội dung dán.`);
  }

  async function handleExcelQuestionsFile(file) {
    if (!file) return;
    setImportStatus('');

    try {
      if (!/\.(xls|xlsx)$/i.test(file.name)) {
        setImportStatus('Vui lÃ²ng chá»n file Excel .xls hoáº·c .xlsx.');
        return;
      }

      const parsedQuestions = await parseExcelQuestionFile(file);

      if (!parsedQuestions.length) {
        setImportStatus('File Excel chÆ°a cÃ³ cÃ¢u há»i há»£p lá»‡. DÃ¹ng cá»™t CÃ¢u há»i, A, B, C, D, ÄÃ¡p Ã¡n, Giáº£i thÃ­ch.');
        return;
      }

      const nextQuestions = parsedQuestions.map((question, index) =>
        normalizeVideoQuestionDraft(
          {
            ...question,
            id: `video-question-excel-${Date.now()}-${index}`,
            explanation: question.explanation || question.note || ''
          },
          index
        )
      );

      setDraftQuestions((previous) => [...previous, ...nextQuestions]);
      setImportStatus(`ÄÃ£ thÃªm ${nextQuestions.length} cÃ¢u há»i tá»« ${file.name}.`);
    } catch {
      setImportStatus('KhÃ´ng thá»ƒ Ä‘á»c file Excel. HÃ£y kiá»ƒm tra láº¡i cáº¥u trÃºc file.');
    }
  }

  function handleSave() {
    const nextQuestions = prepareVideoQuestionsForSave(draftQuestions);
    setDraftQuestions(nextQuestions.map(normalizeVideoQuestionDraft));
    onSave(nextQuestions);
  }

  return (
    <section className="content-card content-card--enterprise video-question-panel">
      <div className="video-question-panel__head">
        <div>
          <span className="eyebrow">Giao bài cho video</span>
          <h2>Câu hỏi dưới video này</h2>
          <p>Giảng viên có thể thêm, dán, sửa hoặc xóa toàn bộ câu hỏi. Khi lưu, dữ liệu được cập nhật vào Supabase cho riêng bài học hiện tại.</p>
        </div>
        <div className="video-question-panel__toolbar">
          <label className="button-ghost video-question-file-button">
            Nháº­p Excel
            <input
              type="file"
              accept=".xls,.xlsx"
              onChange={(event) => {
                void handleExcelQuestionsFile(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </label>
          <button type="button" className="button-ghost" onClick={addQuestion}>
            Thêm câu hỏi
          </button>
          <button type="button" className="button" onClick={handleSave} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu vào Supabase'}
          </button>
        </div>
      </div>

      <div className="video-question-panel__paste">
        <label className="auth-field">
          <span>Dán nhiều câu hỏi</span>
          <textarea
            rows={5}
            className="lesson-input"
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            placeholder={`Câu 1: Từ nào phù hợp với "hello"?
A. xin chào
B. tạm biệt
C. cảm ơn
Đáp án: A
Giải thích: Hello nghĩa là xin chào.`}
          />
        </label>
        <button type="button" className="button-ghost" onClick={handlePasteQuestions} disabled={!pasteText.trim()}>
          Tách câu hỏi từ nội dung dán
        </button>
        {pasteStatus ? <div className="exercise-feedback">{pasteStatus}</div> : null}
        {importStatus ? <div className="exercise-feedback">{importStatus}</div> : null}
      </div>

      {draftQuestions.length ? (
        <div className="video-question-list">
          {draftQuestions.map((question, questionIndex) => (
            <article key={question.id} className="video-question-card">
              <div className="video-question-card__head">
                <span>Câu {questionIndex + 1}</span>
                <select
                  className="video-question-type-select"
                  value={question.type}
                  onChange={(event) => updateQuestion(question.id, { type: event.target.value })}
                >
                  {LESSON_QUESTION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <button type="button" className="button-ghost video-question-card__delete" onClick={() => deleteQuestion(question.id)}>
                  Xóa câu này
                </button>
              </div>

              <label className="auth-field">
                <span>Nội dung câu hỏi</span>
                <textarea
                  rows={3}
                  className="lesson-input"
                  value={question.prompt}
                  onChange={(event) => updateQuestion(question.id, { prompt: event.target.value })}
                  placeholder="Nhập câu hỏi học viên sẽ thấy ngay dưới video"
                />
              </label>

              {question.type === 'listening' || question.audioUrl ? (
                <QuestionAudioField
                  question={question}
                  lessonId={lesson?.databaseId || lesson?.id}
                  onChange={(patch) => updateQuestion(question.id, patch)}
                />
              ) : null}

              {question.type === 'multiple_choice' ? (
                <div className="video-question-options">
                  <div className="video-question-options__head">
                    <span>Lựa chọn đáp án</span>
                    <button type="button" className="button-ghost" onClick={() => addOption(question.id)}>
                      Thêm lựa chọn
                    </button>
                  </div>

                  {question.options.length ? (
                    question.options.map((option, optionIndex) => (
                      <div key={`${question.id}-${option.label}-${optionIndex}`} className="video-question-option">
                        <label className="video-question-option__correct">
                          <input
                            type="radio"
                            name={`correct-${question.id}`}
                            checked={question.correctAnswer === option.label}
                            onChange={() => updateQuestion(question.id, { correctAnswer: option.label })}
                          />
                          <span>{option.label}</span>
                        </label>
                        <input
                          type="text"
                          className="lesson-input"
                          value={option.text}
                          onChange={(event) => updateOption(question.id, optionIndex, event.target.value)}
                          placeholder={`Đáp án ${option.label}`}
                        />
                        <button
                          type="button"
                          className="button-ghost video-question-option__delete"
                          onClick={() => removeOption(question.id, optionIndex)}
                        >
                          Xóa
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">Câu hỏi này chưa có lựa chọn. Có thể lưu dạng tự luận hoặc thêm lựa chọn để chấm trắc nghiệm.</div>
                  )}
                </div>
              ) : null}

              {question.type === 'true_false' ? (
                <label className="auth-field">
                  <span>Đáp án đúng</span>
                  <select
                    className="lesson-input"
                    value={question.correctAnswer}
                    onChange={(event) => updateQuestion(question.id, { correctAnswer: event.target.value })}
                  >
                    <option value="true">Đúng</option>
                    <option value="false">Sai</option>
                  </select>
                </label>
              ) : null}

              {question.type === 'fill_blank' || question.type === 'listening' ? (
                <label className="auth-field">
                  <span>
                    {question.type === 'listening'
                      ? 'Đáp án đúng — nội dung học viên phải nghe và gõ lại (nhiều cách viết thì phân cách bằng dấu phẩy)'
                      : 'Đáp án chấp nhận (phân cách bằng dấu phẩy)'}
                  </span>
                  <input
                    type="text"
                    className="lesson-input"
                    value={question.acceptedAnswersText}
                    onChange={(event) => updateQuestion(question.id, { acceptedAnswersText: event.target.value })}
                    placeholder={
                      question.type === 'listening' ? 'I go to school every day' : 'hello world, hello-world'
                    }
                  />
                  {question.type === 'fill_blank' ? (
                    <small className="field-hint">Dùng ____ trong câu hỏi để đánh dấu chỗ trống.</small>
                  ) : null}
                </label>
              ) : null}

              {question.type === 'matching' ? (
                <label className="auth-field">
                  <span>Các cặp nối (mỗi dòng: Vế trái = Vế phải)</span>
                  <textarea
                    rows={4}
                    className="lesson-input"
                    value={question.pairsText}
                    onChange={(event) => updateQuestion(question.id, { pairsText: event.target.value })}
                    placeholder={'dog = con chó\ncat = con mèo'}
                  />
                </label>
              ) : null}

              {question.type === 'writing' ? (
                <label className="auth-field">
                  <span>Đáp án mẫu (hiện cho học viên sau khi nộp để tự đối chiếu)</span>
                  <textarea
                    rows={3}
                    className="lesson-input"
                    value={question.sampleAnswer}
                    onChange={(event) => updateQuestion(question.id, { sampleAnswer: event.target.value })}
                    placeholder="Viết câu trả lời mẫu..."
                  />
                </label>
              ) : null}

              <label className="auth-field">
                <span>Giải thích sau khi làm bài</span>
                <textarea
                  rows={2}
                  className="lesson-input"
                  value={question.explanation}
                  onChange={(event) => updateQuestion(question.id, { explanation: event.target.value })}
                  placeholder="Giải thích ngắn gọn để học viên hiểu đáp án"
                />
              </label>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          Chưa có câu hỏi nào dưới video này. Bấm thêm câu hỏi hoặc dán nhiều câu ở trên để bắt đầu.
        </div>
      )}

      {status?.text ? (
        <div className={status.type === 'success' ? 'exercise-feedback success' : 'exercise-feedback'}>
          {status.text}
        </div>
      ) : null}
    </section>
  );
}

function StudentAssignmentPlayer({ assignment, attempt, saving, onSubmit }) {
  const questions = useMemo(() => getAssignmentQuestions(assignment), [assignment]);
  const [answers, setAnswers] = useState(() => attempt?.answers || {});

  useEffect(() => {
    setAnswers(attempt?.answers || {});
  }, [assignment.id, attempt?.submittedAt]);

  const answeredCount = questions.filter((question) =>
    isLessonQuestionAnswered(question, answers[question.id])
  ).length;
  const canSubmit = questions.length > 0 && answeredCount === questions.length;

  function updateAnswer(questionId, answer) {
    setAnswers((previous) => ({
      ...previous,
      [questionId]: answer
    }));
  }

  function handleSubmit() {
    const result = scoreLessonQuestions(questions, answers);
    onSubmit(assignment, answers, result);
  }

  if (!questions.length) {
    return (
      <div className="assignment-player">
        <p className="empty-state">Bài giao này chưa có câu hỏi để làm trực tiếp.</p>
      </div>
    );
  }

  return (
    <div className="assignment-player">
      {attempt ? (
        <div className="exercise-feedback success">
          Lần nộp gần nhất: {attempt.score}/{attempt.maxScore} điểm.
        </div>
      ) : null}

      <div className="generated-question-preview">
        {questions.map((question, index) => (
          <article key={question.id} className="generated-question-preview__item">
            <div className="excel-exercise-row__head">
              <strong>Câu {index + 1}. {question.prompt}</strong>
              <span className="pill lesson-question__type">{getLessonQuestionTypeLabel(question.type)}</span>
            </div>

            {question.audioUrl ? (
              <div className="lesson-question__audio">
                <audio controls src={question.audioUrl} preload="auto" />
              </div>
            ) : null}

            <LessonQuestionInput
              question={question}
              answer={answers[question.id]}
              onChange={(value) => updateAnswer(question.id, value)}
              disabled={false}
              revealAnswer={Boolean(attempt)}
            />

            {attempt ? <LessonQuestionFeedback question={question} answer={answers[question.id]} /> : null}
          </article>
        ))}
      </div>

      <div className="assignment-player__footer">
        <span>{answeredCount}/{questions.length} câu đã trả lời</span>
        <button type="button" className="button" onClick={handleSubmit} disabled={!canSubmit || saving}>
          {saving ? 'Đang nộp...' : attempt ? 'Nộp lại bài' : 'Nộp bài'}
        </button>
      </div>
    </div>
  );
}

function LearningEmptyState({ role, loading }) {
  const dashboardPath = getDashboardPathForRole(role);
  const dashboardLabel =
    role === 'admin' ? 'Mở bảng quản trị' : role === 'teacher' ? 'Mở bảng giảng viên' : 'Mở bảng học viên';
  const roleLabel = role === 'teacher' ? 'Giáo viên' : role === 'admin' ? 'Quản trị viên' : 'Học sinh';
  const eyebrowLabel = loading ? 'Đang kiểm tra' : role === 'student' ? 'Phòng học trống' : 'Phòng học quản lý';
  const titleLabel =
    loading
      ? 'Đang tải dữ liệu phòng học'
      : role === 'student'
        ? 'Chưa có khóa học nào trong phòng học'
        : 'Khóa học này chưa có bài học nào được xuất bản';
  const descriptionLabel = loading
    ? 'Hệ thống đang đồng bộ khóa học, bài học và quyền truy cập từ Supabase.'
    : role === 'student'
      ? 'Khi có khóa học được xuất bản hoặc bạn được cấp quyền học, nội dung bài học sẽ xuất hiện tại đây.'
      : 'Bạn vẫn có thể mở bảng điều khiển để tạo bài học đầu tiên, gắn video và giao bài tập cho học viên.';

  return (
    <div className="page learning-page">
      <section className="learning-empty-screen">
        <div className="learning-empty-screen__copy">
          <span className="eyebrow">{eyebrowLabel}</span>
          <h1>{titleLabel}</h1>
          <p>{descriptionLabel}</p>

          {!loading ? (
            <div className="learning-empty-screen__actions">
              <Link className="button" to="/courses">
                Xem danh mục khóa học
              </Link>
              <Link className="button-ghost" to={dashboardPath}>
                {dashboardLabel}
              </Link>
            </div>
          ) : null}
        </div>

        <div className="learning-empty-screen__panel">
          <article>
            <span>Khóa học</span>
            <strong>{loading ? '...' : '0'}</strong>
          </article>
          <article>
            <span>Bài học</span>
            <strong>{loading ? '...' : '0'}</strong>
          </article>
          <article>
            <span>Vai trò</span>
            <strong>{loading ? '...' : roleLabel}</strong>
          </article>
        </div>
      </section>
    </div>
  );
}

export default function LearningPage() {
  usePageTitle('Phòng học');
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const currentRole = getEffectiveRole(auth);
  const currentEmail = auth.user?.email || '';
  const routeCourseKey = courseId || '';
  const courseOptions = useMemo(
    () => getCourseOptions(currentRole === 'teacher' ? auth.user?.id : ''),
    [auth.user?.id, currentRole]
  );
  const learningRoomScope = `${auth.user?.id || 'anon'}:${currentRole || 'roleless'}`;
  const cachedRoomState = readLearningRoomCache(routeCourseKey, learningRoomScope);

  const [currentCourse, setCurrentCourse] = useState(() => cachedRoomState?.currentCourse || null);
  const [lessons, setLessons] = useState(() => cachedRoomState?.lessons || []);
  const [selectedLessonId, setSelectedLessonId] = useState(() => cachedRoomState?.selectedLessonId || lessonId || '');
  const [loadingCourse, setLoadingCourse] = useState(() => !cachedRoomState);
  const [audioMap, setAudioMap] = useState(() => readStoredJson(storageKeys.audioByLesson, {}));
  const [fileMap, setFileMap] = useState(() => readStoredJson(storageKeys.filesByLesson, {}));
  const [purchasedCourses, setPurchasedCourses] = useState(() => readStoredJson(storageKeys.purchasedCourses, []));
  const [availableCourses, setAvailableCourses] = useState(() => cachedRoomState?.availableCourses || []);
  const [teacherAssignments, setTeacherAssignments] = useState([]);
  const [studentAssignments, setStudentAssignments] = useState([]);
  const [assignmentAttempts, setAssignmentAttempts] = useState({});
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [assignmentRefreshTick, setAssignmentRefreshTick] = useState(0);
  const [showTeacherStudentView, setShowTeacherStudentView] = useState(false);
  const [teacherDraft, setTeacherDraft] = useState(getInitialTeacherDraft);
  const [teacherSource, setTeacherSource] = useState({ type: 'sample', name: 'Mẫu OCR', url: '' });
  const [driveLink, setDriveLink] = useState('');
  const [ocrText, setOcrText] = useState(defaultOcrText);
  const [ocrStatus, setOcrStatus] = useState('ready');
  const [generatedExercises, setGeneratedExercises] = useState(() => buildOcrExercises(defaultOcrText, 'Mẫu OCR'));
  const [teacherSaving, setTeacherSaving] = useState(false);
  const [teacherSaveStatus, setTeacherSaveStatus] = useState({ type: '', text: '' });
  const [lessonProgressMap, setLessonProgressMap] = useState({});
  const [progressSaving, setProgressSaving] = useState(false);
  const [assignmentSavingId, setAssignmentSavingId] = useState('');
  const [lessonQuestionSaving, setLessonQuestionSaving] = useState(false);
  const [lessonQuestionStatus, setLessonQuestionStatus] = useState({ type: '', text: '' });

  useEffect(() => {
    writeStoredJson(storageKeys.audioByLesson, audioMap);
  }, [audioMap]);

  useEffect(() => {
    writeStoredJson(storageKeys.filesByLesson, fileMap);
  }, [fileMap]);

  useEffect(() => {
    writeStoredJson(storageKeys.purchasedCourses, purchasedCourses);
  }, [purchasedCourses]);

  useEffect(() => {
    const nextCachedRoomState = readLearningRoomCache(routeCourseKey, learningRoomScope);

    if (nextCachedRoomState) {
      if (nextCachedRoomState.currentCourse) {
        setCurrentCourse(nextCachedRoomState.currentCourse);
      }
      setLessons(Array.isArray(nextCachedRoomState.lessons) ? nextCachedRoomState.lessons : []);
      setAvailableCourses(Array.isArray(nextCachedRoomState.availableCourses) ? nextCachedRoomState.availableCourses : []);
      setSelectedLessonId(
        nextCachedRoomState.selectedLessonId || lessonId || nextCachedRoomState.lessons?.[0]?.id || ''
      );
    }
  }, [lessonId, learningRoomScope, routeCourseKey]);

  const lastLoadedUserIdRef = useRef(null);
  const lastLoadedRoleRef = useRef(null);
  const availableCoursesRef = useRef(availableCourses);
  const purchasedCoursesRef = useRef(purchasedCourses);

  useEffect(() => {
    availableCoursesRef.current = availableCourses;
  }, [availableCourses]);

  useEffect(() => {
    purchasedCoursesRef.current = purchasedCourses;
  }, [purchasedCourses]);

  useEffect(() => {
    if (!auth.ready) {
      return undefined;
    }

    let active = true;

    async function loadCourse() {
      const nextCachedRoomState = readLearningRoomCache(routeCourseKey, learningRoomScope);
      if (!nextCachedRoomState) {
        setLoadingCourse(true);
      }

      try {
        const canBrowseAllCourses = currentRole === 'teacher' || currentRole === 'admin';
        const userChanged = auth.user?.id !== lastLoadedUserIdRef.current || currentRole !== lastLoadedRoleRef.current;
        const localManagedCourses = canBrowseAllCourses ? readAllTeacherManagedCourses() : [];

        let catalog = availableCoursesRef.current;
        let nextOwnedCourseIds = purchasedCoursesRef.current;
        let routeCourse = null;

        if (userChanged || !catalog.length || !nextOwnedCourseIds.length) {
          const [fetchedCatalog, fetchedRouteCourse] = await Promise.all([
            getCourseCatalog(),
            routeCourseKey ? getCourseBySlug(routeCourseKey) : Promise.resolve(null)
          ]);
          catalog = fetchedCatalog;
          routeCourse = fetchedRouteCourse;
          nextOwnedCourseIds = await getOwnedCourseIds(auth.user?.id, catalog);

          lastLoadedUserIdRef.current = auth.user?.id;
          lastLoadedRoleRef.current = currentRole;
        } else {
          routeCourse = routeCourseKey ? await getCourseBySlug(routeCourseKey) : null;
        }

        const ownedCourseKeySet = new Set(nextOwnedCourseIds.map((courseKey) => String(courseKey).toLowerCase()));
        const ownedCourses = catalog.filter((course) =>
          getCourseAccessKeys(course).some((courseKey) => ownedCourseKeySet.has(courseKey))
        );
        const accessibleCourses = canBrowseAllCourses ? catalog : ownedCourses;
        const fallbackCourse = localManagedCourses[0] || accessibleCourses[0] || (canBrowseAllCourses ? catalog[0] : null);
        const fallbackCourseKey = getCourseRouteKey(fallbackCourse);
        const nextCourse =
          routeCourse ||
          (canBrowseAllCourses && localManagedCourses[0]
            ? await getCourseBySlug(getCourseRouteKey(localManagedCourses[0]))
            : null) ||
          (fallbackCourseKey ? await getCourseBySlug(fallbackCourseKey) : null) ||
          fallbackCourse ||
          null;
        const teacherFallbackCourse = !nextCourse && canBrowseAllCourses
          ? createTeacherFallbackCourse(courseOptions, routeCourseKey)
          : null;
        let resolvedCourse = nextCourse || teacherFallbackCourse;
        if (resolvedCourse && canBrowseAllCourses && buildLessonsFromCourse(resolvedCourse).length === 0) {
          resolvedCourse = createTeacherWorkspaceFallback(resolvedCourse, routeCourseKey);
        }
        const nextLessons = resolvedCourse ? buildLessonsFromCourse(resolvedCourse) : [];

        if (active) {
          setCurrentCourse(resolvedCourse);
          setLessons(nextLessons);
          setAvailableCourses(
            accessibleCourses.length
              ? accessibleCourses
              : resolvedCourse
                ? [resolvedCourse]
                : []
          );
          setSelectedLessonId((previousLessonId) => {
            if (lessonId && nextLessons.some((lesson) => lesson.id === lessonId)) {
              return lessonId;
            }

            if (previousLessonId && nextLessons.some((lesson) => lesson.id === previousLessonId)) {
              return previousLessonId;
            }

            if (nextCachedRoomState?.selectedLessonId && nextLessons.some((lesson) => lesson.id === nextCachedRoomState.selectedLessonId)) {
              return nextCachedRoomState.selectedLessonId;
            }

            return nextLessons.find((lesson) => lesson.status === 'active')?.id || nextLessons[0]?.id || '';
          });
          setPurchasedCourses(nextOwnedCourseIds);
          writeLearningRoomCache(routeCourseKey, learningRoomScope, {
            currentCourse: resolvedCourse,
            lessons: nextLessons,
            selectedLessonId:
              lessonId && nextLessons.some((lesson) => lesson.id === lessonId)
                ? lessonId
                : nextCachedRoomState?.selectedLessonId && nextLessons.some((lesson) => lesson.id === nextCachedRoomState.selectedLessonId)
                  ? nextCachedRoomState.selectedLessonId
                  : nextLessons.find((lesson) => lesson.status === 'active')?.id || nextLessons[0]?.id || '',
            availableCourses: accessibleCourses
          });
          if (resolvedCourse) {
            setTeacherDraft((previous) => ({
              ...previous,
              courseKey: resolvedCourse.id || routeCourseKey,
              courseTitle: resolvedCourse.title || previous.courseTitle
            }));
          }
        }
      } catch {
        if (active) {
          if (!nextCachedRoomState) {
            setCurrentCourse(null);
            setLessons([]);
            setSelectedLessonId('');
            setPurchasedCourses([]);
            setAvailableCourses([]);
          }
        }
      } finally {
        if (active) {
          setLoadingCourse(false);
        }
      }
    }

    void loadCourse();

    return () => {
      active = false;
    };
  }, [auth.ready, auth.user?.id, currentRole, learningRoomScope, routeCourseKey]);

  useEffect(() => {
    if (!routeCourseKey || loadingCourse || !currentCourse) {
      return;
    }

    writeLearningRoomCache(routeCourseKey, learningRoomScope, {
      currentCourse,
      lessons,
      selectedLessonId,
      availableCourses
    });
  }, [availableCourses, currentCourse, lessons, learningRoomScope, loadingCourse, routeCourseKey, selectedLessonId]);

  useEffect(() => {
    if (!lessons.length) {
      if (selectedLessonId) {
        setSelectedLessonId('');
      }
      return;
    }

    const lessonFromRoute = lessonId && lessons.find((lesson) => lesson.id === lessonId);
    const currentSelection = lessons.find((lesson) => lesson.id === selectedLessonId);
    const nextLesson = lessonFromRoute || currentSelection || lessons.find((lesson) => lesson.status === 'active') || lessons[0];

    if (nextLesson?.id && nextLesson.id !== selectedLessonId) {
      setSelectedLessonId(nextLesson.id);
    }
  }, [lessonId, lessons, selectedLessonId]);

  useEffect(() => {
    let active = true;

    async function loadAssignments() {
      setLoadingAssignments(true);
      const teacherId = auth.user?.id;
      const email = auth.user?.email;

      try {
        if (teacherId) {
          const nextTeacherAssignments = await getAssignmentsForTeacher(teacherId);
          if (active) {
            setTeacherAssignments(nextTeacherAssignments);
          }
        }

        if (email) {
          const [nextStudentAssignments, nextAttempts] = await Promise.all([
            getAssignmentsForStudent(email, purchasedCourses),
            getAssignmentAttemptsForStudent(auth.user?.id, email)
          ]);
          if (active) {
            setStudentAssignments(nextStudentAssignments);
            setAssignmentAttempts(
              nextAttempts.reduce(
                (attemptMap, attempt) => ({
                  ...attemptMap,
                  [attempt.assignmentId]: attempt
                }),
                {}
              )
            );
          }
        }
      } finally {
        if (active) {
          setLoadingAssignments(false);
        }
      }
    }

    void loadAssignments();

    return () => {
      active = false;
    };
  }, [auth.user?.id, auth.user?.email, purchasedCourses, assignmentRefreshTick]);

  useEffect(() => {
    function refreshAssignments(event) {
      if (event?.type === 'storage' && event.key !== MOCK_ASSIGNMENTS_STORAGE_KEY) {
        return;
      }

      setAssignmentRefreshTick((currentTick) => currentTick + 1);
    }

    window.addEventListener('lesson-assignments-updated', refreshAssignments);
    window.addEventListener('storage', refreshAssignments);

    return () => {
      window.removeEventListener('lesson-assignments-updated', refreshAssignments);
      window.removeEventListener('storage', refreshAssignments);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadProgress() {
      if (!currentCourse?.id || !lessons.length) {
        setLessonProgressMap({});
        return;
      }

      const nextProgress = await getLessonProgress({
        studentId: auth.user?.id,
        studentEmail: auth.user?.email,
        courseKey: currentCourse.id,
        lessons
      });

      if (active) {
        setLessonProgressMap(nextProgress);
      }
    }

    void loadProgress();

    return () => {
      active = false;
    };
  }, [auth.user?.id, auth.user?.email, currentCourse?.id, lessons]);

  const currentLesson = lessons.find((lesson) => lesson.id === selectedLessonId) || lessons[0] || null;
  const currentLessonExercises = Array.isArray(currentLesson?.exercises) ? currentLesson.exercises : [];
  const lessonIndex = useMemo(() => lessons.findIndex((lesson) => lesson.id === selectedLessonId), [selectedLessonId]);
  const currentCourseId = currentCourse?.id || routeCourseKey || '';
  const lessonStorageId = currentCourseId && selectedLessonId ? `${currentCourseId}:${selectedLessonId}` : '';
  const studyCourseOptions = useMemo(() => {
    const optionMap = new Map();
    availableCourses.forEach((course) => {
      const courseKey = getCourseRouteKey(course);
      if (courseKey) {
        optionMap.set(String(courseKey).toLowerCase(), course);
      }
    });

    if (currentCourse) {
      const currentKey = getCourseRouteKey(currentCourse);
      if (currentKey && !optionMap.has(String(currentKey).toLowerCase())) {
        optionMap.set(String(currentKey).toLowerCase(), currentCourse);
      }
    }

    return Array.from(optionMap.values());
  }, [availableCourses, currentCourse]);
  const teacherCourseOptions =
    currentCourse && !courseOptions.some((course) => course.key === currentCourseId)
      ? [{ key: currentCourseId, title: currentCourse.title }, ...courseOptions]
      : courseOptions;
  const isTeacher = currentRole === 'teacher' || currentRole === 'admin';
  const purchasedCourseSet = new Set(purchasedCourses.map((courseKey) => String(courseKey).toLowerCase()));
  const hasPurchasedCourse =
    purchasedCourseSet.has(String(currentCourseId).toLowerCase()) ||
    purchasedCourseSet.has(String(routeCourseKey).toLowerCase());
  const allVisibleAssignments = isTeacher ? teacherAssignments : studentAssignments;
  const currentCourseAccessKeys = useMemo(() => {
    return getCourseAccessKeys(currentCourse);
  }, [currentCourse]);

  const visibleAssignments = allVisibleAssignments.filter((assignment) => {
    const key = String(assignment.courseKey || '').toLowerCase();
    return (
      currentCourseAccessKeys.includes(key) ||
      key === String(currentCourseId).toLowerCase() ||
      key === String(routeCourseKey).toLowerCase()
    );
  });
  const currentLessonAssignments = currentLesson
    ? visibleAssignments.filter((assignment) => assignment.lessonTitle === currentLesson.title)
    : [];
  const hasAssignedLesson = !isTeacher && currentLessonAssignments.length > 0;
  const hasLessonAccess = hasPurchasedCourse || hasAssignedLesson || isTeacher;
  const completedLessonCount = lessons.filter((lesson) => isLessonComplete(lesson, lessonProgressMap)).length;
  const lessonProgress = lessons.length ? Math.round((completedLessonCount / lessons.length) * 100) : 0;
  const isCurrentLessonCompleted = currentLesson ? isLessonComplete(currentLesson, lessonProgressMap) : false;
  const currentLessonStatusLabel = isCurrentLessonCompleted
    ? 'Đã xong'
    : currentLesson?.status === 'locked'
      ? 'Đang khóa'
      : 'Đang học';
  const nextLesson = lessonIndex >= 0 ? lessons[lessonIndex + 1] : lessons[1];
  // Nhóm theo sectionIndex (ổn định) chứ không theo title (chuỗi có thể trùng
  // giữa 2 chương) — cần để tick "hoàn thành chương" không gộp nhầm 2 chương
  // trùng tên thành một.
  const sections = useMemo(() => {
    const map = new Map();
    lessons.forEach((lesson) => {
      const key = lesson.sectionIndex ?? lesson.sectionTitle ?? 'default';
      if (!map.has(key)) {
        map.set(key, { title: lesson.sectionTitle || 'Nội dung khóa học', lessons: [] });
      }
      map.get(key).lessons.push(lesson);
    });
    return Array.from(map.values()).map((section) => ({
      ...section,
      isComplete: section.lessons.length > 0 && section.lessons.every((lesson) => isLessonComplete(lesson, lessonProgressMap))
    }));
  }, [lessons, lessonProgressMap]);
  const isCourseCompleted = sections.length > 0 && sections.every((section) => section.isComplete);

  const [expandedSections, setExpandedSections] = useState({});
  const assignmentPagination = usePagination(visibleAssignments, {
    pageSize: 4,
    resetKey: `${currentCourseId}|${currentRole}|${visibleAssignments.length}`
  });

  useEffect(() => {
    setLessonQuestionStatus({ type: '', text: '' });
  }, [currentLesson?.id]);

  useEffect(() => {
    const currentSectionIndex = lessons.find((l) => l.id === selectedLessonId)?.sectionIndex ?? 0;
    setExpandedSections((prev) => (prev[currentSectionIndex] ? prev : { ...prev, [currentSectionIndex]: true }));
  }, [selectedLessonId, lessons]);

  function handleAudioUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const nextAudio = {
      name: file.name,
      url: URL.createObjectURL(file)
    };

    setAudioMap((previous) => {
      const existing = previous[lessonStorageId];
      if (existing?.url) {
        URL.revokeObjectURL(existing.url);
      }

      return {
        ...previous,
        [lessonStorageId]: nextAudio
      };
    });
  }

  async function readTeacherSourceFile(file) {
    if (file.type.startsWith('image/') || /\.(zip|docx?|pptx?)$/i.test(file.name)) {
      return defaultOcrText;
    }

    const rawText = await file.text();
    if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
      return extractPdfText(rawText) || defaultOcrText;
    }

    return normalizeSourceText(rawText) || defaultOcrText;
  }

  async function handleTeacherSourceFile(file) {
    if (!file) return;

    const sourceUrl = URL.createObjectURL(file);
    const sourceName = file.name;
    setOcrStatus('processing');
    setTeacherSaveStatus({ type: '', text: '' });
    setTeacherSource({ type: 'file', name: sourceName, url: sourceUrl });
    setTeacherDraft((previous) => ({
      ...previous,
      title: previous.title === 'Bài tập từ tài liệu OCR' ? `Bài tập từ ${sourceName.replace(/\.[^.]+$/, '')}` : previous.title,
      attachmentName: sourceName,
      attachmentUrl: sourceUrl
    }));
    setFileMap((previous) => {
      const existing = previous[lessonStorageId];
      if (existing?.url) {
        URL.revokeObjectURL(existing.url);
      }

      return {
        ...previous,
        [lessonStorageId]: {
          name: sourceName,
          url: sourceUrl
        }
      };
    });

    try {
      const nextText = await readTeacherSourceFile(file);
      setOcrText(nextText);
      setGeneratedExercises(buildOcrExercises(nextText, sourceName));
      setOcrStatus('ready');
    } catch {
      setOcrText(defaultOcrText);
      setGeneratedExercises(buildOcrExercises(defaultOcrText, sourceName));
      setOcrStatus('error');
    }
  }

  function handleTeacherDrop(event) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    void handleTeacherSourceFile(file);
  }

  function handleDriveImport() {
    const trimmedLink = driveLink.trim();
    if (!trimmedLink) {
      setOcrStatus('error');
      setTeacherSaveStatus({ type: 'error', text: 'Hãy dán link Drive hoặc URL tài liệu trước khi đọc.' });
      return;
    }

    const sourceName = 'Tài liệu Drive';
    const nextText = `${defaultOcrText}\nSource = ${trimmedLink}`;
    setTeacherSource({ type: 'drive', name: sourceName, url: trimmedLink });
    setTeacherDraft((previous) => ({
      ...previous,
      attachmentName: sourceName,
      attachmentUrl: trimmedLink
    }));
    setOcrText(nextText);
    setGeneratedExercises(buildOcrExercises(nextText, sourceName));
    setOcrStatus('ready');
    setTeacherSaveStatus({ type: '', text: '' });
  }

  function regenerateExercisesFromOcr() {
    const nextText = normalizeSourceText(ocrText) || defaultOcrText;
    setOcrText(nextText);
    setGeneratedExercises(buildOcrExercises(nextText, teacherSource.name || 'tài liệu'));
    setOcrStatus('ready');
  }

  function updateGeneratedExercise(index, patch) {
    setGeneratedExercises((previous) =>
      previous.map((question, questionIndex) => (questionIndex === index ? { ...question, ...patch } : question))
    );
  }

  function updateGeneratedOption(questionIndex, optionIndex, value) {
    setGeneratedExercises((previous) =>
      previous.map((question, index) => {
        if (index !== questionIndex) return question;

        const previousOption = question.options[optionIndex];
        const nextOptions = question.options.map((option, currentIndex) => (currentIndex === optionIndex ? value : option));
        return {
          ...question,
          options: nextOptions,
          correctAnswer: question.correctAnswer === previousOption ? value : question.correctAnswer
        };
      })
    );
  }

  async function saveAssignmentToSupabase() {
    if (!currentLesson) {
      setTeacherSaveStatus({ type: 'error', text: 'Khóa học này chưa có bài học để giao.' });
      return;
    }

    const selectedQuestions = generatedExercises
      .filter((question) => question.enabled)
      .map((question) => ({
        prompt: question.prompt,
        options: question.options.filter(Boolean),
        correctAnswer: question.correctAnswer,
        explanation: question.explanation
      }))
      .filter((question) => question.prompt && question.options.length >= 2 && question.correctAnswer);

    setTeacherSaveStatus({ type: '', text: '' });

    if (!auth.user?.id) {
      setTeacherSaveStatus({ type: 'error', text: 'Thiếu tài khoản giáo viên để giao bài.' });
      return;
    }

    if (!selectedQuestions.length) {
      setTeacherSaveStatus({ type: 'error', text: 'Hãy bật ít nhất một câu hỏi và chọn đáp án đúng trước khi giao bài.' });
      return;
    }

    const recipients = parseRecipients(teacherDraft.recipientsText);

    if (teacherDraft.assignmentScope === 'selected_students' && !recipients.length) {
      setTeacherSaveStatus({ type: 'error', text: 'Hãy nhập ít nhất một email học sinh để giao theo danh sách chọn.' });
      return;
    }

    const firstQuestion = selectedQuestions[0];
    setTeacherSaving(true);

    try {
      const createdId = await createAssignment({
        teacherId: auth.user.id,
        accessToken: auth.session?.access_token,
        assignment: {
          courseKey: teacherDraft.courseKey,
          courseTitle: teacherDraft.courseTitle,
          lessonTitle: currentLesson.title,
          title: teacherDraft.title || `${currentLesson.title} - bài tập OCR`,
          description: teacherDraft.description,
          assignmentScope: teacherDraft.assignmentScope,
          audioName: audioMap[lessonStorageId]?.name || '',
          audioUrl: audioMap[lessonStorageId]?.url || '',
          attachmentName: teacherDraft.attachmentName || fileMap[lessonStorageId]?.name || teacherSource.name || '',
          attachmentUrl: teacherDraft.attachmentUrl || fileMap[lessonStorageId]?.url || teacherSource.url || '',
          exerciseConfig: {
            type: 'mcq',
            lessonPosition: String(Math.max(lessonIndex + 1, 1)),
            prompt: firstQuestion.prompt,
            options: firstQuestion.options,
            correctAnswer: firstQuestion.correctAnswer,
            explanation: firstQuestion.explanation,
            generatedQuestions: selectedQuestions,
            source: {
              type: teacherSource.type,
              name: teacherSource.name,
              url: teacherSource.url,
              ocrText: normalizeSourceText(ocrText)
            }
          }
        },
        recipients
      });

      // Hiện thông báo thành công ngay khi server trả về id
      setTeacherSaveStatus({
        type: 'success',
        text:
          teacherDraft.assignmentScope === 'course_buyers'
            ? 'Giao bài thành công. Đã giao bài cho học viên đã mua khóa.'
            : `Giao bài thành công. Đã giao bài cho ${recipients.length} học sinh được chọn.`
      });

      // Load lại danh sách giao bài ở background; lỗi ở bước này không ghi đè thông báo thành công
      void getAssignmentsForTeacher(auth.user.id)
        .then((nextTeacherAssignments) => {
          setTeacherAssignments(nextTeacherAssignments);
        })
        .catch((err) => {
          console.warn('Không thể load lại danh sách giao bài:', err?.message || err);
        });
    } catch (submissionError) {
      setTeacherSaveStatus({
        type: 'error',
        text: submissionError.message || 'Chưa thể giao bài. Vui lòng kiểm tra kết nối Supabase.'
      });
    } finally {
      setTeacherSaving(false);
    }
  }

  async function handleSaveVideoQuestions(nextQuestions) {
    if (!currentLesson) {
      setLessonQuestionStatus({ type: 'error', text: 'Chưa chọn bài học để lưu câu hỏi video.' });
      return;
    }

    setLessonQuestionSaving(true);
    setLessonQuestionStatus({ type: '', text: '' });

    try {
      const saved = await saveLessonQuestionsToSupabase({
        lessonId: currentLesson.databaseId || currentLesson.id,
        questions: nextQuestions,
        accessToken: auth.session?.access_token
      });
      const savedQuestions = prepareVideoQuestionsForSave(saved?.questions || nextQuestions);
      const updateLessonQuestions = (lesson) => {
        const isCurrentLesson =
          lesson.id === currentLesson.id ||
          lesson.databaseId === currentLesson.databaseId ||
          lesson.id === currentLesson.databaseId;

        if (!isCurrentLesson) {
          return lesson;
        }

        return {
          ...lesson,
          exercises: savedQuestions,
          questionCount: savedQuestions.length,
          exerciseType: lesson.exerciseType || 'Bài luyện video'
        };
      };

      setLessons((previous) => previous.map(updateLessonQuestions));
      setCurrentCourse((previous) => {
        if (!previous?.sections?.length) {
          return previous;
        }

        return {
          ...previous,
          sections: previous.sections.map((section) => ({
            ...section,
            lessons: (section.lessons || []).map(updateLessonQuestions)
          }))
        };
      });
      setLessonQuestionStatus({
        type: 'success',
        text: savedQuestions.length
          ? `Đã lưu ${savedQuestions.length} câu hỏi video vào Supabase.`
          : 'Đã xóa toàn bộ câu hỏi video trên Supabase.'
      });
    } catch (error) {
      setLessonQuestionStatus({
        type: 'error',
        text: error.message || 'Chưa thể lưu câu hỏi video lên Supabase.'
      });
    } finally {
      setLessonQuestionSaving(false);
    }
  }

  async function handleMarkLessonComplete() {
    if (!currentLesson) {
      return;
    }

    setProgressSaving(true);
    try {
      const savedProgress = await saveLessonProgress({
        studentId: auth.user?.id,
        studentEmail: auth.user?.email,
        courseKey: currentCourseId,
        lesson: currentLesson,
        completed: true
      });

      setLessonProgressMap((previous) => ({
        ...previous,
        [currentLesson.id]: savedProgress
      }));
      if (auth.user?.id) {
        void logActivity(auth.user.id, 'complete_lesson', currentLesson.id, currentLesson.title, {
          courseKey: currentCourseId
        });
      }
    } finally {
      setProgressSaving(false);
    }
  }

  // Học viên nộp bài luyện của bài học → tự động đánh dấu hoàn thành (nếu chưa).
  function handleLessonExercisesSubmitted() {
    if (!isCurrentLessonCompleted && !progressSaving) {
      void handleMarkLessonComplete();
    }
  }

  async function handleSubmitAssignment(assignment, answers, result) {
    setAssignmentSavingId(assignment.id);
    try {
      const savedAttempt = await saveAssignmentAttempt({
        assignmentId: assignment.id,
        studentId: auth.user?.id,
        studentEmail: auth.user?.email,
        answers,
        score: result.score,
        maxScore: result.maxScore
      });

      setAssignmentAttempts((previous) => ({
        ...previous,
        [assignment.id]: savedAttempt
      }));

      if (auth.user?.id) {
        void logActivity(auth.user.id, 'complete_exercise', assignment.id, assignment.title, {
          score: result.score,
          maxScore: result.maxScore,
          courseKey: currentCourseId
        });
      }

      await handleMarkLessonComplete();
    } finally {
      setAssignmentSavingId('');
    }
  }

  function handleSelectStudyCourse(event) {
    const nextCourseKey = event.target.value;
    if (!nextCourseKey || nextCourseKey === currentCourseId) {
      return;
    }

    navigate(`/learn/${nextCourseKey}`);
  }

  function handleSelectLesson(nextLessonId) {
    const nextLesson = lessons.find((lesson) => lesson.id === nextLessonId);
    if (auth.user?.id && nextLesson) {
      void logActivity(auth.user.id, 'view_lesson', nextLessonId, nextLesson.title, {
        courseKey: currentCourseId
      });
    }
    setSelectedLessonId(nextLessonId);
    navigate(`/learn/${currentCourseId}/${nextLessonId}`);
  }

  function handleGoToNextLesson() {
    if (nextLesson) {
      handleSelectLesson(nextLesson.id);
    }
  }

  const showBlockingLoading = loadingCourse && !currentCourse;

  if (!auth.ready || showBlockingLoading) {
    return <LearningEmptyState role={currentRole} loading />;
  }

  if (!currentCourse) {
    return <LearningEmptyState role={currentRole} loading={false} />;
  }

  if (!lessons.length || !currentLesson) {
    const dashboardPath = getDashboardPathForRole(currentRole);
    const dashboardLabel =
      currentRole === 'admin' ? 'Mở bảng quản trị' : isTeacher ? 'Mở bảng giảng viên' : 'Mở bảng học viên';
    const emptyTitle =
      currentRole === 'student'
        ? 'Khóa học này đã có trong hệ thống nhưng chưa có bài học nào được xuất bản.'
        : 'Khóa học này chưa có bài học nào được xuất bản.';
    const emptyDescription =
      currentRole === 'student'
        ? 'Học viên chỉ nhận được học liệu khi đã mua khóa học hoặc được giảng viên cấp quyền trực tiếp.'
        : 'Bạn vẫn có thể mở bảng điều khiển để tạo bài học đầu tiên, gắn video và giao bài tập cho học viên.';
    const roleLabel = currentRole === 'teacher' ? 'Giáo viên' : currentRole === 'admin' ? 'Quản trị viên' : 'Học sinh';

    return (
      <div className="page learning-page">
        <section className="learning-empty-screen">
          <div className="learning-empty-screen__copy">
            <span className="eyebrow">{currentRole === 'student' ? 'Phòng học đang chờ bài học' : 'Phòng học quản lý'}</span>
            <h1>{currentCourse.title}</h1>
            <p>
              {emptyTitle} {emptyDescription}
            </p>
            <div className="learning-empty-screen__actions">
              <Link className="button" to="/courses">
                Xem danh mục khóa học
              </Link>
              <Link className="button-ghost" to={dashboardPath}>
                {dashboardLabel}
              </Link>
            </div>
          </div>

          <div className="learning-empty-screen__panel">
            <article>
              <span>Khóa học</span>
              <strong>1</strong>
            </article>
            <article>
              <span>Bài học</span>
              <strong>0</strong>
            </article>
            <article>
              <span>Vai trò</span>
              <strong>{roleLabel}</strong>
            </article>
          </div>
        </section>
      </div>
    );
  }

  const lessonAudio = audioMap[lessonStorageId];
  const lessonFile = fileMap[lessonStorageId];
  const selectedGeneratedExercises = generatedExercises.filter((question) => question.enabled);

  return (
    <div className="page learning-page">
      <section className="learning-shell">
        <aside className="lesson-sidebar">
          <div className="sidebar-head">
            <span className="eyebrow">Phòng học</span>
            {studyCourseOptions.length > 1 ? (
              <select 
                className="sidebar-course-select" 
                value={currentCourseId} 
                onChange={handleSelectStudyCourse}
                style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem', marginBottom: '0.25rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '1rem', fontWeight: 'bold' }}
              >
                {studyCourseOptions.map((course) => {
                  const courseKey = getCourseRouteKey(course);
                  return (
                    <option key={courseKey} value={courseKey}>
                      {course.title}
                    </option>
                  );
                })}
              </select>
            ) : (
              <h2>{currentCourse.title}</h2>
            )}
            <p>{completedLessonCount}/{lessons.length} bài đã hoàn thành</p>
          </div>

          <div className={`lesson-sidebar__progress ${isCourseCompleted ? 'is-complete' : ''}`}>
            <div>
              <strong>Tiến độ</strong>
              <span>{lessonProgress}%</span>
            </div>
            <div className="meter">
              <span style={{ width: `${lessonProgress}%` }} />
            </div>
          </div>

          {isCourseCompleted ? (
            <div className="lesson-sidebar__completed-banner">
              <span className="lesson-sidebar__completed-banner-icon" aria-hidden="true">🎉</span>
              <div className="lesson-sidebar__completed-banner-copy">
                <strong>Đã hoàn thành khóa học!</strong>
                <span>Bạn đã hoàn thành cả {sections.length} chương.</span>
              </div>
            </div>
          ) : null}

          <div className="lesson-sidebar__sections">
            {sections.map((section, sectionIndex) => {
              const isExpanded = expandedSections[sectionIndex] ?? (sectionIndex === 0);
              const doneInSection = section.lessons.filter((lesson) => isLessonComplete(lesson, lessonProgressMap)).length;
              return (
                <div key={sectionIndex} className={`sidebar-section ${isExpanded ? 'is-expanded' : ''}`}>
                  <button
                    className={`sidebar-section__header ${section.isComplete ? 'is-complete' : ''}`}
                    onClick={() => setExpandedSections((prev) => ({ ...prev, [sectionIndex]: !isExpanded }))}
                  >
                    <span className={`sidebar-section__check ${section.isComplete ? 'is-complete' : ''}`} aria-hidden="true">
                      {section.isComplete ? '✓' : sectionIndex + 1}
                    </span>
                    <span className="sidebar-section__title">
                      <strong>{section.title}</strong>
                      <small>{doneInSection}/{section.lessons.length} bài</small>
                    </span>
                    <span className="sidebar-section__toggle" aria-hidden="true">{isExpanded ? '▼' : '▶'}</span>
                  </button>
                  {isExpanded && (
                    <div className="sidebar-section__lessons">
                      {section.lessons.map((lesson) => {
                        const isLessonDone = isLessonComplete(lesson, lessonProgressMap);
                        const lessonNumber = lesson.lessonNumber;

                        return (
                          <button
                            key={lesson.id}
                            type="button"
                            className={`lesson-item ${isLessonDone ? 'done' : lesson.status} ${selectedLessonId === lesson.id ? 'is-selected' : ''}`}
                            onClick={() => handleSelectLesson(lesson.id)}
                          >
                            <span className="lesson-item__icon" aria-hidden="true">
                              {isLessonDone ? '✓' : lessonNumber}
                            </span>
                            <span className="lesson-item__copy">
                              <strong>{lesson.title}</strong>
                              <span>
                                {[
                                  lesson.exerciseType || 'Video',
                                  lesson.questionCount ? `${lesson.questionCount} câu` : '',
                                  isLessonDone ? 'Đã học' : lesson.status === 'locked' ? 'Đang khóa' : 'Đang học'
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        <div className="learning-stage">
          {hasLessonAccess ? (
            <>
              <div className="learning-lesson-title-row">
                <h1>{currentLesson.title}</h1>
                {currentLesson.note ? <p>{currentLesson.note}</p> : null}
                
                {isTeacher && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className="pill" style={{ opacity: currentLesson.videoUrl ? 1 : 0.5 }}>{currentLesson.videoUrl ? '✓ Video' : '✕ Video'}</span>
                    <span className="pill" style={{ opacity: lessonAudio ? 1 : 0.5 }}>{lessonAudio ? '✓ Audio' : '✕ Audio'}</span>
                    <span className="pill" style={{ opacity: lessonFile ? 1 : 0.5 }}>{lessonFile ? '✓ Tài liệu' : '✕ Tài liệu'}</span>
                    <span className="pill">{currentLessonExercises.length} Câu video</span>
                    <span className="pill">{visibleAssignments.length} Bài tập đã giao</span>
                    
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                      <label className="button-ghost" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer', margin: 0 }}>
                        Tải PDF
                        <input
                          type="file"
                          accept=".pdf,.zip,.txt,.md,.doc,.docx,image/*"
                          style={{ display: 'none' }}
                          onChange={(event) => void handleTeacherSourceFile(event.target.files?.[0])}
                        />
                      </label>
                      <a className="button" href="#teacher-assignment-studio" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}>
                        Giao bài
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <LessonVideoPlayer lesson={currentLesson} isTeacher={isTeacher} dashboardPath={getDashboardPathForRole(currentRole)} />

              {isReadingLesson(currentLesson) ? (
                <LessonReadingPanel lesson={currentLesson} />
              ) : null}

              {isTeacher ? (
                <VideoQuestionEditor
                  lesson={currentLesson}
                  saving={lessonQuestionSaving}
                  status={lessonQuestionStatus}
                  onSave={handleSaveVideoQuestions}
                />
              ) : currentLessonExercises.length ? (
                <LessonExercisePreview
                  lesson={currentLesson}
                  isTeacher={isTeacher}
                  onSubmitted={handleLessonExercisesSubmitted}
                />
              ) : !isReadingLesson(currentLesson) ? (
                <section className="content-card content-card--enterprise video-question-empty">
                  <span className="eyebrow">Bài luyện</span>
                  <h2>Chưa có câu hỏi cho video này</h2>
                  <p>Giảng viên chưa giao bài luyện trực tiếp dưới video. Hãy xem hết video và làm các nhiệm vụ được giao nếu có.</p>
                </section>
              ) : null}

              {isTeacher ? (
                <details id="teacher-assignment-studio" className="content-card content-card--enterprise lesson-teacher-panel assignment-studio" style={{ marginTop: '1.5rem' }}>
                  <summary className="section-head" style={{ cursor: 'pointer', listStyle: 'none', margin: 0 }}>
                    <div>
                      <span className="eyebrow">Giao bài cho học sinh</span>
                      <h2>Tạo bài tập bổ sung (từ PDF/Ảnh/Drive)</h2>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span className="pill">{ocrStatusLabels[ocrStatus]}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Mở rộng ▼</span>
                    </div>
                  </summary>

                  <div style={{ paddingTop: '1.5rem' }}>
                    {teacherSaveStatus.text ? (
                      <div className={`auth-message ${teacherSaveStatus.type === 'success' ? 'auth-message--success' : ''}`}>
                        {teacherSaveStatus.text}
                      </div>
                    ) : null}

                    <div className="assignment-studio__layout">
                      <div className="assignment-studio__panel">
                        <label
                          className="teacher-dropzone"
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={handleTeacherDrop}
                        >
                          <input
                            type="file"
                            accept=".pdf,.zip,.txt,.md,.doc,.docx,image/*"
                            onChange={(event) => void handleTeacherSourceFile(event.target.files?.[0])}
                          />
                          <strong>Thả PDF, ảnh, ZIP hoặc worksheet vào đây</strong>
                          <span>{teacherSource.name ? `Nguồn hiện tại: ${teacherSource.name}` : 'Chưa có tài liệu'}</span>
                        </label>

                        <label className="auth-field auth-field--full">
                          <span>Link Drive / tài liệu</span>
                          <div className="teacher-drive-row">
                            <input
                              type="url"
                              value={driveLink}
                              onChange={(event) => setDriveLink(event.target.value)}
                              placeholder="Dán link Google Drive hoặc URL tài liệu"
                            />
                            <button type="button" className="button-ghost" onClick={handleDriveImport}>
                              Đọc Drive
                            </button>
                          </div>
                        </label>

                        <div className="ocr-pipeline">
                          {['Nhận tài liệu', 'Giải nén / OCR', 'Sinh câu hỏi'].map((step, index) => (
                            <span
                              key={step}
                              className={
                                ocrStatus === 'ready' || (ocrStatus === 'processing' && index < 2)
                                  ? 'ocr-step is-active'
                                  : 'ocr-step'
                              }
                            >
                              {step}
                            </span>
                          ))}
                        </div>

                        <div className="assignment-studio__fields">
                          <label className="auth-field">
                            <span>Khóa học</span>
                            <select
                              value={teacherDraft.courseKey}
                              onChange={(event) => {
                                const nextCourse = teacherCourseOptions.find((course) => course.key === event.target.value) || teacherCourseOptions[0];
                                setTeacherDraft((previous) => ({
                                  ...previous,
                                  courseKey: nextCourse?.key || previous.courseKey,
                                  courseTitle: nextCourse?.title || previous.courseTitle
                                }));
                              }}
                            >
                              {teacherCourseOptions.map((course) => (
                                <option key={course.key} value={course.key}>
                                  {course.title}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="auth-field">
                            <span>Tên bài giao</span>
                            <input
                              value={teacherDraft.title}
                              onChange={(event) => setTeacherDraft((previous) => ({ ...previous, title: event.target.value }))}
                              placeholder="Ví dụ: Bài tập phát âm tuần 1"
                            />
                          </label>

                          <label className="auth-field auth-field--full">
                            <span>Yêu cầu cho học sinh</span>
                            <textarea
                              rows="3"
                              value={teacherDraft.description}
                              onChange={(event) => setTeacherDraft((previous) => ({ ...previous, description: event.target.value }))}
                              placeholder="Nhập hướng dẫn ngắn trước khi học sinh làm bài"
                            />
                          </label>

                          <label className="auth-field">
                            <span>Phạm vi giao bài</span>
                            <select
                              value={teacherDraft.assignmentScope}
                              onChange={(event) =>
                                setTeacherDraft((previous) => ({
                                  ...previous,
                                  assignmentScope: event.target.value
                                }))
                              }
                            >
                              <option value="course_buyers">Học viên đã mua khóa</option>
                              <option value="selected_students">Email học sinh được chọn</option>
                            </select>
                          </label>

                          {teacherDraft.assignmentScope === 'selected_students' ? (
                            <label className="auth-field auth-field--full">
                              <span>Email học sinh</span>
                              <textarea
                                rows="3"
                                value={teacherDraft.recipientsText}
                                onChange={(event) =>
                                  setTeacherDraft((previous) => ({
                                    ...previous,
                                    recipientsText: event.target.value
                                  }))
                                }
                                placeholder="Mỗi dòng một email, hoặc phân tách bằng dấu phẩy"
                              />
                            </label>
                          ) : null}
                        </div>

                        <div className="assignment-studio__mini">
                          <strong>Audio nghe kèm</strong>
                          <p>{lessonAudio?.name || 'Có thể bỏ qua nếu bài này chỉ dùng PDF/Drive.'}</p>
                          <label className="upload-button">
                            Chọn audio
                            <input type="file" accept="audio/*" onChange={handleAudioUpload} />
                          </label>
                        </div>

                        <label className="auth-field auth-field--full">
                          <span>Nội dung OCR</span>
                          <textarea
                            rows="8"
                            value={ocrText}
                            onChange={(event) => setOcrText(event.target.value)}
                            placeholder="Nội dung đọc được từ tài liệu sẽ nằm ở đây. Giáo viên có thể sửa trước khi sinh bài tập."
                          />
                        </label>

                        <div className="assignment-studio__actions">
                          <button type="button" className="button-ghost" onClick={regenerateExercisesFromOcr}>
                            Sinh lại câu hỏi
                          </button>
                          <span className="pill">{formatAssignmentScope(teacherDraft.assignmentScope)}</span>
                        </div>
                      </div>

                      <div className="assignment-studio__panel">
                        <div className="assignment-studio__head">
                          <div>
                            <span className="eyebrow">Bài tập được tạo</span>
                            <h3>Chọn đáp án đúng trước khi giao</h3>
                          </div>
                          <span className="pill">{selectedGeneratedExercises.length}/{generatedExercises.length} câu</span>
                        </div>

                        <div className="ocr-question-list">
                          {generatedExercises.map((question, questionIndex) => (
                            <article
                              key={question.id}
                              className={question.enabled ? 'ocr-question-card' : 'ocr-question-card is-disabled'}
                            >
                              <div className="ocr-question-card__head">
                                <label className="ocr-toggle">
                                  <input
                                    type="checkbox"
                                    checked={question.enabled}
                                    onChange={(event) => updateGeneratedExercise(questionIndex, { enabled: event.target.checked })}
                                  />
                                  <span>Giao câu {questionIndex + 1}</span>
                                </label>
                                <span className="pill">Trắc nghiệm</span>
                              </div>

                              <label className="auth-field auth-field--full">
                                <span>Câu hỏi</span>
                                <input
                                  type="text"
                                  value={question.prompt}
                                  onChange={(event) => updateGeneratedExercise(questionIndex, { prompt: event.target.value })}
                                />
                              </label>

                              <div className="ocr-options-grid">
                                {question.options.map((option, optionIndex) => (
                                  <label
                                    key={`${question.id}-${optionIndex}`}
                                    className={question.correctAnswer === option ? 'ocr-option is-correct' : 'ocr-option'}
                                  >
                                    <input
                                      type="radio"
                                      name={`ocr-correct-${question.id}`}
                                      checked={question.correctAnswer === option}
                                      onChange={() => updateGeneratedExercise(questionIndex, { correctAnswer: option })}
                                    />
                                    <span>Đáp án {optionIndex + 1}</span>
                                    <input
                                      type="text"
                                      value={option}
                                      onChange={(event) => updateGeneratedOption(questionIndex, optionIndex, event.target.value)}
                                    />
                                  </label>
                                ))}
                              </div>
                            </article>
                          ))}
                        </div>

                        {showTeacherStudentView ? (
                          <div className="student-view-preview">
                            <div className="section-head">
                              <div>
                                <span className="eyebrow">Student view</span>
                                <h3>Học sinh sẽ thấy bộ bài này</h3>
                              </div>
                              <span className="pill">{teacherDraft.courseTitle}</span>
                            </div>
                            <div className="generated-question-preview">
                              {selectedGeneratedExercises.map((question, index) => (
                                <article key={`${question.id}-preview`} className="generated-question-preview__item">
                                  <strong>Câu {index + 1}. {question.prompt}</strong>
                                  <div className="exercise-options">
                                    {question.options.filter(Boolean).map((option) => (
                                      <span key={option} className="answer-pill">
                                        {option}
                                      </span>
                                    ))}
                                  </div>
                                </article>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="assignment-studio__actions">
                          <button
                            type="button"
                            className="button-ghost"
                            onClick={() => setShowTeacherStudentView((value) => !value)}
                          >
                            {showTeacherStudentView ? 'Ẩn Student view' : 'Xem Student view'}
                          </button>
                          <button type="button" className="button" onClick={saveAssignmentToSupabase} disabled={teacherSaving}>
                            {teacherSaving ? 'Đang giao bài...' : 'Giao bài cho học sinh'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </details>
              ) : null}

              {!isTeacher ? (
                <section className="content-card content-card--enterprise lesson-action-strip">
                  <div>
                    <span className="eyebrow">Tiến độ</span>
                    <strong>{isCurrentLessonCompleted ? 'Bài học đã hoàn thành' : currentLessonStatusLabel}</strong>
                    <p>
                      {isCurrentLessonCompleted
                        ? 'Tiến độ đã được lưu cho tài khoản học viên này.'
                        : 'Hoàn thành bài luyện rồi lưu tiến độ tại đây.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="button"
                    onClick={handleMarkLessonComplete}
                    disabled={progressSaving || isCurrentLessonCompleted}
                  >
                    {progressSaving ? 'Đang lưu...' : isCurrentLessonCompleted ? 'Đã hoàn thành' : 'Đánh dấu hoàn thành'}
                  </button>
                  <button
                    type="button"
                    className="button learning-next-button"
                    onClick={handleGoToNextLesson}
                    disabled={!nextLesson}
                  >
                    Bài tiếp theo
                    <span aria-hidden="true">→</span>
                  </button>
                </section>
              ) : null}
            </>
          ) : (
            <section className="content-card content-card--enterprise lesson-lock">
              <span className="eyebrow">Quản lý quyền truy cập</span>
              <h2>Bạn chưa có quyền học bài này.</h2>
              <p>Học viên chỉ nhận được học liệu khi đã mua khóa học hoặc được giảng viên cấp quyền trực tiếp.</p>
              <div className="lesson-lock__chips">
                <span className="pill">Cần mua khóa học</span>
                <span className="pill">Hoặc được giảng viên chọn</span>
              </div>
            </section>
          )}

          <section className="content-card content-card--enterprise">
            <div className="section-head">
              <div>
                <span className="eyebrow">{isTeacher ? 'Bảng giao việc' : 'Nhiệm vụ của tôi'}</span>
                <h2>{isTeacher ? 'Nhiệm vụ đã lưu' : 'Bài học được giao'}</h2>
              </div>
              <span className="pill">{loadingAssignments ? 'Đang tải' : `${visibleAssignments.length} mục`}</span>
            </div>

            {visibleAssignments.length ? (
              <>
                <div className="assignment-list">
                  {assignmentPagination.pageItems.map((assignment) => (
                  <article key={assignment.id} className="assignment-card">
                    <div className="assignment-card__head">
                      <div>
                        <span className="eyebrow">{assignment.courseTitle}</span>
                        <h3>{assignment.title}</h3>
                        <p>{assignment.lessonTitle}</p>
                      </div>
                      <span className="pill">
                        {formatAssignmentScope(assignment.assignmentScope)}
                      </span>
                    </div>
                    {assignment.description ? <p className="assignment-card__description">{assignment.description}</p> : null}
                    <div className="assignment-card__meta">
                      <span>
                        {assignment.exerciseConfig?.generatedQuestions?.length
                          ? `${assignment.exerciseConfig.generatedQuestions.length} câu hỏi`
                          : `${assignment.recipients.length} học viên`}
                      </span>
                      <span>{assignment.audioName || 'Chưa có audio'}</span>
                      <span>{assignment.attachmentName || 'Chưa có tài liệu'}</span>
                    </div>
                    {!isTeacher && assignment.lessonTitle === currentLesson.title ? (
                      <StudentAssignmentPlayer
                        assignment={assignment}
                        attempt={assignmentAttempts[assignment.id]}
                        saving={assignmentSavingId === assignment.id}
                        onSubmit={handleSubmitAssignment}
                      />
                    ) : null}
                  </article>
                  ))}
                </div>
                <PaginationControls {...assignmentPagination} label="nhiệm vụ" />
              </>
            ) : (
              <p className="empty-state">
                {isTeacher ? 'Chưa có nhiệm vụ nào được lưu.' : 'Tài khoản của bạn chưa được giao nhiệm vụ học tập.'}
              </p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
