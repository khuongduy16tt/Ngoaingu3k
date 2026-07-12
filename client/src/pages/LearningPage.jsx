import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { getEffectiveRole } from '../lib/permissions';
import {
  createAssignment,
  getAssignmentAttemptsForStudent,
  getAssignmentsForStudent,
  getAssignmentsForTeacher,
  getCourseOptions,
  saveAssignmentAttempt
} from '../lib/assignmentService';
import { getCourseBySlug, getCourseCatalog, getOwnedCourseIds, PURCHASED_COURSES_STORAGE_KEY } from '../lib/courseService';
import { getLessonProgress, saveLessonProgress } from '../lib/progressService';
import { logActivity } from '../lib/activityService';
import { usePageTitle } from '../hooks/usePageTitle';
import { PaginationControls, usePagination } from '../components/Pagination';
import { getEmbeddableVideoUrl, getVideoAccessHint, getVideoEmbedIssue, getVideoSourceLabel } from '../lib/videoLinks';

const fallbackLessons = [
  { id: 'lesson-1', title: 'Bài 1. Giới thiệu bản thân', status: 'done', note: 'Khởi động và mẫu câu chào hỏi cơ bản' },
  { id: 'lesson-2', title: 'Bài 2. Phát âm trọng tâm', status: 'active', note: 'Bài học chính kèm luyện nghe và nhại âm' },
  { id: 'lesson-3', title: 'Bài 3. Hội thoại ngắn', status: 'locked', note: 'Mở khóa sau khi được cấp quyền học' },
  { id: 'lesson-4', title: 'Bài 4. Kiểm tra nhanh', status: 'locked', note: 'Bài đánh giá cuối chương' }
];

const exerciseTabs = [
  { id: 'mcq', label: 'Trắc nghiệm' },
  { id: 'tf', label: 'Đúng / Sai' },
  { id: 'match', label: 'Nối cặp' },
  { id: 'blank', label: 'Điền khuyết' },
  { id: 'flash', label: 'Thẻ ghi nhớ' }
];

const matchingPairs = [
  { word: 'Apple', answer: 'Quả táo' },
  { word: 'Teacher', answer: 'Giảng viên' },
  { word: 'Practice', answer: 'Luyện tập' }
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

function getCourseRouteKey(course) {
  return course?.id || course?.slug || course?.databaseId || '';
}

function getCourseAccessKeys(course) {
  return [course?.id, course?.slug, course?.databaseId]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
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

function buildLessonsFromCourse(course) {
  if (!course) {
    return [];
  }

  const flattenedLessons = (course?.sections || [])
    .flatMap((section) =>
      (section.lessons || []).map((lesson) => ({
        ...lesson,
        sectionTitle: section.title
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

function getAssignmentQuestions(assignment) {
  const generatedQuestions = Array.isArray(assignment.exerciseConfig?.generatedQuestions)
    ? assignment.exerciseConfig.generatedQuestions
    : [];

  if (generatedQuestions.length) {
    return generatedQuestions
      .filter((question) => question?.prompt)
      .map((question, index) => ({
        id: `q-${index}`,
        prompt: question.prompt,
        options: (question.options || []).filter(Boolean),
        correctAnswer: question.correctAnswer,
        explanation: question.explanation || ''
      }));
  }

  return [{
    id: 'q-0',
    prompt: assignment.exerciseConfig?.prompt || 'Chọn đáp án đúng.',
    options: (assignment.exerciseConfig?.options || []).filter(Boolean),
    correctAnswer: assignment.exerciseConfig?.correctAnswer,
    explanation: assignment.exerciseConfig?.explanation || ''
  }].filter((question) => question.prompt && question.options.length);
}

function scoreAnswers(questions, answers) {
  return questions.reduce(
    (result, question) => {
      const isCorrect = answers[question.id] === question.correctAnswer;
      return {
        score: result.score + (isCorrect ? 1 : 0),
        maxScore: result.maxScore + 1
      };
    },
    { score: 0, maxScore: 0 }
  );
}

function normalizeExerciseAnswer(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function getExerciseCorrectLabel(exercise) {
  const options = Array.isArray(exercise?.options) ? exercise.options : [];
  const rawAnswer = exercise?.correctAnswer || exercise?.answer || '';
  const normalizedAnswer = normalizeExerciseAnswer(rawAnswer);

  if (['A', 'B', 'C', 'D'].includes(normalizedAnswer)) {
    return normalizedAnswer;
  }

  const answerByText = options.find(
    (option) => String(option.text || '').trim().toLowerCase() === String(rawAnswer || '').trim().toLowerCase()
  );

  return answerByText?.label || normalizedAnswer;
}

function LessonVideoPlayer({ lesson, isTeacher }) {
  const rawVideoUrl = lesson?.videoUrl || lesson?.videoEmbedUrl || '';
  const videoUrl = getEmbeddableVideoUrl(rawVideoUrl);
  const videoIssue = getVideoEmbedIssue(rawVideoUrl);
  const videoAccessHint = getVideoAccessHint(rawVideoUrl);

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
          <Link className="button-ghost" to="/dashboard/teacher">
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
      {videoAccessHint ? (
        <div className="lesson-video-panel__notice">
          <div>
            <strong>Video Google Drive</strong>
            <p>{videoAccessHint}</p>
          </div>
          <a className="button-ghost" href={rawVideoUrl} target="_blank" rel="noreferrer">
            Mở link gốc
          </a>
        </div>
      ) : null}
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

function LessonExercisePreview({ lesson, isTeacher }) {
  const exercises = Array.isArray(lesson?.exercises) ? lesson.exercises : [];
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setSelectedAnswers({});
    setSubmitted(false);
  }, [lesson?.id]);

  if (!exercises.length) {
    return null;
  }

  const answerableExercises = exercises.filter((exercise) => exercise.options?.length);
  const answeredCount = answerableExercises.filter((exercise) => selectedAnswers[exercise.id]).length;
  const correctCount = answerableExercises.filter(
    (exercise) => selectedAnswers[exercise.id] === getExerciseCorrectLabel(exercise)
  ).length;
  const canSubmit = answerableExercises.length > 0 && answeredCount === answerableExercises.length;

  function selectAnswer(exercise, optionLabel) {
    setSelectedAnswers((previous) => ({
      ...previous,
      [exercise.id]: optionLabel
    }));
  }

  return (
    <section className="content-card content-card--enterprise excel-lesson-panel">
      <div className="section-head">
        <div>
          <span className="eyebrow">Bài tập từ Excel</span>
          <h2>{lesson.exerciseType || 'Nội dung bài học'}</h2>
          <p>{exercises.length} mục được đọc trực tiếp từ file Excel.</p>
        </div>
        <span className="pill">{lesson.sourceSheet || 'Excel'}</span>
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
        {exercises.map((exercise, index) => {
          const correctLabel = getExerciseCorrectLabel(exercise);
          const selectedLabel = selectedAnswers[exercise.id];
          const isCorrect = selectedLabel && selectedLabel === correctLabel;

          return (
            <article key={exercise.id || `${lesson.id}-exercise-${index}`} className="excel-exercise-row">
              <div className="excel-exercise-row__head">
                <span>Câu {exercise.number || index + 1}</span>
                <strong>{exercise.prompt || lesson.exerciseType || `Mục ${index + 1}`}</strong>
              </div>

              {exercise.options?.length ? (
                <div className="excel-option-grid">
                  {exercise.options.map((option) => {
                    const optionLabel = option.label || '';
                    const showCorrect = (isTeacher || submitted) && optionLabel === correctLabel;
                    const showWrong = submitted && selectedLabel === optionLabel && optionLabel !== correctLabel;
                    const isSelected = selectedLabel === optionLabel;

                    return (
                      <button
                        key={`${exercise.id}-${optionLabel}-${option.text}`}
                        type="button"
                        className={[
                          'answer-pill',
                          isSelected ? 'is-active' : '',
                          showCorrect ? 'is-correct' : '',
                          showWrong ? 'is-wrong' : ''
                        ].filter(Boolean).join(' ')}
                        onClick={() => selectAnswer(exercise, optionLabel)}
                        disabled={isTeacher}
                      >
                        {optionLabel}. {option.text}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="empty-state">Không có lựa chọn, học viên thực hiện theo hướng dẫn của dạng bài.</p>
              )}

              {submitted && selectedLabel ? (
                <div className={isCorrect ? 'exercise-feedback success' : 'exercise-feedback'}>
                  {isCorrect ? 'Chính xác.' : `Chưa đúng. Đáp án đúng là ${correctLabel}.`}
                </div>
              ) : null}

              <div className="excel-exercise-row__meta">
                {isTeacher && correctLabel ? <span className="pill">Đáp án: {correctLabel}</span> : null}
                {exercise.note ? <small>{exercise.note}</small> : null}
              </div>
            </article>
          );
        })}
      </div>

      {!isTeacher && answerableExercises.length ? (
        <div className="excel-lesson-panel__footer">
          <span>
            {submitted
              ? `Kết quả: ${correctCount}/${answerableExercises.length} câu đúng`
              : `${answeredCount}/${answerableExercises.length} câu đã chọn`}
          </span>
          <button type="button" className="button" onClick={() => setSubmitted(true)} disabled={!canSubmit}>
            Kiểm tra đáp án
          </button>
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

  const answeredCount = questions.filter((question) => answers[question.id]).length;
  const canSubmit = questions.length > 0 && answeredCount === questions.length;

  function updateAnswer(questionId, answer) {
    setAnswers((previous) => ({
      ...previous,
      [questionId]: answer
    }));
  }

  function handleSubmit() {
    const result = scoreAnswers(questions, answers);
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
            <strong>Câu {index + 1}. {question.prompt}</strong>
            <div className="exercise-options">
              {question.options.map((option) => {
                const isSelected = answers[question.id] === option;
                const showCorrect = attempt && option === question.correctAnswer;

                return (
                  <button
                    key={option}
                    type="button"
                    className={isSelected || showCorrect ? 'answer-pill is-active' : 'answer-pill'}
                    onClick={() => updateAnswer(question.id, option)}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            {attempt && question.explanation ? (
              <div className="exercise-feedback">{question.explanation}</div>
            ) : null}
          </article>
        ))}
      </div>

      <div className="assignment-player__footer">
        <span>{answeredCount}/{questions.length} câu đã chọn</span>
        <button type="button" className="button" onClick={handleSubmit} disabled={!canSubmit || saving}>
          {saving ? 'Đang nộp...' : attempt ? 'Nộp lại bài' : 'Nộp bài'}
        </button>
      </div>
    </div>
  );
}

function LearningEmptyState({ isTeacher, loading }) {
  const dashboardPath = isTeacher ? '/dashboard/teacher' : '/dashboard/student';
  const dashboardLabel = isTeacher ? 'Mở bảng giảng viên' : 'Mở bảng học viên';

  return (
    <div className="page learning-page">
      <section className="learning-empty-screen">
        <div className="learning-empty-screen__copy">
          <span className="eyebrow">{loading ? 'Đang kiểm tra' : 'Phòng học trống'}</span>
          <h1>{loading ? 'Đang tải dữ liệu phòng học' : 'Chưa có khóa học nào trong phòng học'}</h1>
          <p>
            {loading
              ? 'Hệ thống đang đồng bộ khóa học, bài học và quyền truy cập từ Supabase.'
              : 'Khi có khóa học được xuất bản hoặc bạn được cấp quyền học, nội dung bài học sẽ xuất hiện tại đây.'}
          </p>

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
            <span>Trạng thái</span>
            <strong>{loading ? 'Đang tải' : 'Chờ dữ liệu'}</strong>
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
  const courseOptions = useMemo(() => getCourseOptions(), []);

  const [currentCourse, setCurrentCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [selectedLessonId, setSelectedLessonId] = useState(lessonId || '');
  const [loadingCourse, setLoadingCourse] = useState(true);
  const [activeTab, setActiveTab] = useState('mcq');
  const [mcqAnswer, setMcqAnswer] = useState('');
  const [tfAnswer, setTfAnswer] = useState('');
  const [matchAnswers, setMatchAnswers] = useState(['', '', '']);
  const [blankAnswer, setBlankAnswer] = useState('');
  const [flashFlip, setFlashFlip] = useState(false);
  const [audioMap, setAudioMap] = useState(() => readStoredJson(storageKeys.audioByLesson, {}));
  const [fileMap, setFileMap] = useState(() => readStoredJson(storageKeys.filesByLesson, {}));
  const [purchasedCourses, setPurchasedCourses] = useState(() => readStoredJson(storageKeys.purchasedCourses, []));
  const [availableCourses, setAvailableCourses] = useState([]);
  const [teacherAssignments, setTeacherAssignments] = useState([]);
  const [studentAssignments, setStudentAssignments] = useState([]);
  const [assignmentAttempts, setAssignmentAttempts] = useState({});
  const [loadingAssignments, setLoadingAssignments] = useState(false);
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
    if (!auth.ready) {
      return undefined;
    }

    let active = true;

    async function loadCourse() {
      setLoadingCourse(true);

      try {
        const canBrowseAllCourses = currentRole === 'teacher' || currentRole === 'admin';
        const catalog = await getCourseCatalog();
        const nextOwnedCourseIds = await getOwnedCourseIds(auth.user?.id, catalog);
        const ownedCourseKeySet = new Set(nextOwnedCourseIds.map((courseKey) => String(courseKey).toLowerCase()));
        const ownedCourses = catalog.filter((course) =>
          getCourseAccessKeys(course).some((courseKey) => ownedCourseKeySet.has(courseKey))
        );
        const accessibleCourses = canBrowseAllCourses ? catalog : ownedCourses;
        const routeCourse = routeCourseKey ? await getCourseBySlug(routeCourseKey) : null;
        const fallbackCourse = accessibleCourses[0] || (canBrowseAllCourses ? catalog[0] : null);
        const fallbackCourseKey = getCourseRouteKey(fallbackCourse);
        const nextCourse =
          routeCourse ||
          (fallbackCourseKey ? await getCourseBySlug(fallbackCourseKey) : null) ||
          fallbackCourse ||
          null;
        const nextLessons = nextCourse ? buildLessonsFromCourse(nextCourse) : [];

        if (active) {
          setCurrentCourse(nextCourse);
          setLessons(nextLessons);
          setAvailableCourses(accessibleCourses);
          setSelectedLessonId((previousLessonId) => {
            if (lessonId && nextLessons.some((lesson) => lesson.id === lessonId)) {
              return lessonId;
            }

            if (previousLessonId && nextLessons.some((lesson) => lesson.id === previousLessonId)) {
              return previousLessonId;
            }

            return nextLessons.find((lesson) => lesson.status === 'active')?.id || nextLessons[0]?.id || '';
          });
          setPurchasedCourses(nextOwnedCourseIds);
          if (nextCourse) {
            setTeacherDraft((previous) => ({
              ...previous,
              courseKey: nextCourse.id || routeCourseKey,
              courseTitle: nextCourse.title || previous.courseTitle
            }));
          }
        }
      } catch {
        if (active) {
          setCurrentCourse(null);
          setLessons([]);
          setSelectedLessonId('');
          setPurchasedCourses([]);
          setAvailableCourses([]);
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
  }, [auth.ready, auth.user?.id, currentRole, routeCourseKey]);

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
  }, [auth.user?.id, auth.user?.email, purchasedCourses]);

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
    if (currentRole === 'teacher' || currentRole === 'admin') {
      return [];
    }

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
  }, [availableCourses, currentCourse, currentRole]);
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
  const visibleAssignments = allVisibleAssignments.filter(
    (assignment) =>
      String(assignment.courseKey).toLowerCase() === String(currentCourseId).toLowerCase() ||
      String(assignment.courseKey).toLowerCase() === String(routeCourseKey).toLowerCase()
  );
  const currentLessonAssignments = currentLesson
    ? visibleAssignments.filter((assignment) => assignment.lessonTitle === currentLesson.title)
    : [];
  const hasAssignedLesson = !isTeacher && currentLessonAssignments.length > 0;
  const hasLessonAccess = hasPurchasedCourse || hasAssignedLesson || isTeacher;
  const completedLessonCount = lessons.filter(
    (lesson) => lessonProgressMap[lesson.id]?.completed || lesson.status === 'done'
  ).length;
  const lessonProgress = lessons.length ? Math.round((completedLessonCount / lessons.length) * 100) : 0;
  const isCurrentLessonCompleted = currentLesson
    ? Boolean(lessonProgressMap[currentLesson.id]?.completed || currentLesson.status === 'done')
    : false;
  const currentLessonStatusLabel = isCurrentLessonCompleted
    ? 'Đã xong'
    : currentLesson?.status === 'locked'
      ? 'Đang khóa'
      : 'Đang học';
  const lessonPagination = usePagination(lessons, {
    pageSize: 8,
    resetKey: currentCourseId
  });
  const assignmentPagination = usePagination(visibleAssignments, {
    pageSize: 4,
    resetKey: `${currentCourseId}|${currentRole}|${visibleAssignments.length}`
  });

  useEffect(() => {
    const currentLessonIndex = lessons.findIndex((lesson) => lesson.id === selectedLessonId);
    if (currentLessonIndex >= 0) {
      lessonPagination.setPage(Math.floor(currentLessonIndex / lessonPagination.pageSize) + 1);
    }
  }, [lessonPagination.pageSize, lessonPagination.setPage, lessons, selectedLessonId]);

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
      await createAssignment({
        teacherId: auth.user.id,
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

      const nextTeacherAssignments = await getAssignmentsForTeacher(auth.user.id);
      setTeacherAssignments(nextTeacherAssignments);
      setTeacherSaveStatus({
        type: 'success',
        text:
          teacherDraft.assignmentScope === 'course_buyers'
            ? 'Đã giao bài cho học viên đã mua khóa.'
            : `Đã giao bài cho ${recipients.length} học sinh được chọn.`
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

  if (!auth.ready || loadingCourse) {
    return <LearningEmptyState isTeacher={isTeacher} loading />;
  }

  if (!currentCourse) {
    return <LearningEmptyState isTeacher={isTeacher} loading={false} />;
  }

  if (!lessons.length || !currentLesson) {
    return (
      <div className="page learning-page">
        <section className="learning-empty-screen">
          <div className="learning-empty-screen__copy">
            <span className="eyebrow">Phòng học đang chờ bài học</span>
            <h1>{currentCourse.title}</h1>
            <p>Khóa học này đã có trong hệ thống nhưng chưa có bài học nào được xuất bản.</p>
            <div className="learning-empty-screen__actions">
              <Link className="button" to="/courses">
                Xem danh mục khóa học
              </Link>
              <Link className="button-ghost" to={isTeacher ? '/dashboard/teacher' : '/dashboard/student'}>
                {isTeacher ? 'Mở bảng giảng viên' : 'Mở bảng học viên'}
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
              <span>Trạng thái</span>
              <strong>Chờ bài học</strong>
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
            <h2>{currentCourse.title}</h2>
            <p>Quy trình học liền mạch: giảng viên tải học liệu, học viên nhận quyền truy cập và học trong cùng một không gian.</p>
          </div>

          <div className="lesson-sidebar__progress">
            <div>
              <strong>Tiến độ</strong>
              <span>{lessonProgress}%</span>
            </div>
            <div className="meter">
              <span style={{ width: `${lessonProgress}%` }} />
            </div>
          </div>

          {lessonPagination.pageItems.map((lesson) => (
            <button
              key={lesson.id}
              type="button"
              className={`lesson-item ${lessonProgressMap[lesson.id]?.completed ? 'done' : lesson.status} ${selectedLessonId === lesson.id ? 'is-selected' : ''}`}
              onClick={() => handleSelectLesson(lesson.id)}
            >
              <span className="lesson-item__icon" aria-hidden="true">
                {lesson.lessonNumber || lessonPagination.startItem + lessonPagination.pageItems.indexOf(lesson)}
              </span>
              <span className="lesson-item__copy">
                <strong>{lesson.title}</strong>
                <span>{[lesson.exerciseType, lesson.questionCount ? `${lesson.questionCount} câu` : '', lessonProgressMap[lesson.id]?.completed || lesson.status === 'done' ? 'Đã xong' : lesson.status === 'locked' ? 'Đang khóa' : 'Đang học'].filter(Boolean).join(' · ')}</span>
              </span>
            </button>
          ))}
          <PaginationControls {...lessonPagination} label="bài học" />
        </aside>

        <div className="learning-stage">
          {!isTeacher && studyCourseOptions.length > 1 ? (
            <section className="content-card content-card--enterprise today-course-strip">
              <div>
                <span className="eyebrow">Học hôm nay</span>
                <strong>Chọn khóa muốn học</strong>
              </div>
              <label className="today-course-strip__select">
                <span>Khóa học</span>
                <select value={currentCourseId} onChange={handleSelectStudyCourse}>
                  {studyCourseOptions.map((course) => {
                    const courseKey = getCourseRouteKey(course);
                    return (
                      <option key={courseKey} value={courseKey}>
                        {course.title}
                      </option>
                    );
                  })}
                </select>
              </label>
            </section>
          ) : null}

          {isTeacher ? (
            <section className="content-card content-card--enterprise teacher-lesson-bar">
              <div className="teacher-lesson-bar__copy">
                <span className="eyebrow">Teacher</span>
                <strong>{currentLesson.title}</strong>
                <small>{currentLesson.note}</small>
              </div>

              <div className="teacher-lesson-bar__stats">
                <span>
                  <b>{currentLesson.videoUrl ? 'Có' : 'Chưa'}</b>
                  Video
                </span>
                <span>
                  <b>{lessonAudio ? 'Có' : 'Chưa'}</b>
                  Audio
                </span>
                <span>
                  <b>{lessonFile ? 'Có' : 'Chưa'}</b>
                  Tài liệu
                </span>
                <span>
                  <b>{currentLessonExercises.length || generatedExercises.length}</b>
                  Câu bài
                </span>
                <span>
                  <b>{visibleAssignments.length}</b>
                  Đã giao
                </span>
              </div>

              <div className="teacher-lesson-bar__actions">
                <a className="button-ghost" href="#teacher-assignment-studio">
                  Giao bài
                </a>
                <label className="teacher-bar-upload">
                  Tải PDF
                  <input
                    type="file"
                    accept=".pdf,.zip,.txt,.md,.doc,.docx,image/*"
                    onChange={(event) => void handleTeacherSourceFile(event.target.files?.[0])}
                  />
                </label>
              </div>
            </section>
          ) : null}

          {hasLessonAccess ? (
            <>
              {isTeacher ? (
                <section id="teacher-assignment-studio" className="content-card content-card--enterprise lesson-teacher-panel assignment-studio">
                  <div className="section-head">
                    <div>
                      <span className="eyebrow">Giao bài cho học sinh</span>
                      <h2>Tạo bài tập từ PDF, ảnh hoặc Drive</h2>
                    </div>
                    <span className="pill">{ocrStatusLabels[ocrStatus]}</span>
                  </div>

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
                </section>
              ) : null}

              <LessonVideoPlayer lesson={currentLesson} isTeacher={isTeacher} />

              {currentLessonExercises.length ? (
                <LessonExercisePreview lesson={currentLesson} isTeacher={isTeacher} />
              ) : (
              <section className="content-card content-card--enterprise">
                <div className="section-head">
                  <div>
                    <span className="eyebrow">Bài luyện</span>
                    <h2>Chế độ luyện tập cho bài học</h2>
                  </div>
                  <span className="pill">Tương tác</span>
                </div>

                <div className="exercise-tabs">
                  {exerciseTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={activeTab === tab.id ? 'exercise-tab is-active' : 'exercise-tab'}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="exercise-panel">
                  {activeTab === 'mcq' ? (
                    <div className="exercise-card">
                      <h3>Trắc nghiệm</h3>
                      <p>Từ nào phù hợp nhất với "hello"?</p>
                      <div className="exercise-options">
                        {['xin chào', 'tạm biệt', 'cảm ơn'].map((option) => (
                          <button
                            key={option}
                            type="button"
                            className={mcqAnswer === option ? 'answer-pill is-active' : 'answer-pill'}
                            onClick={() => setMcqAnswer(option)}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                      <div className={mcqAnswer === 'xin chào' ? 'exercise-feedback success' : 'exercise-feedback'}>
                        {mcqAnswer ? `Đã chọn: ${mcqAnswer}` : 'Chọn một đáp án để xem phản hồi.'}
                      </div>
                    </div>
                  ) : null}

                  {activeTab === 'tf' ? (
                    <div className="exercise-card">
                      <h3>Đúng / Sai</h3>
                      <p>"Good morning" được dùng trước buổi trưa.</p>
                      <div className="exercise-options">
                        {['Đúng', 'Sai'].map((option) => (
                          <button
                            key={option}
                            type="button"
                            className={tfAnswer === option ? 'answer-pill is-active' : 'answer-pill'}
                            onClick={() => setTfAnswer(option)}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                      <div className={tfAnswer === 'Đúng' ? 'exercise-feedback success' : 'exercise-feedback'}>
                        {tfAnswer ? (tfAnswer === 'Đúng' ? 'Chính xác, nhận định này đúng.' : 'Chưa đúng. Nhận định này là đúng.') : 'Chọn một nhận định.'}
                      </div>
                    </div>
                  ) : null}

                  {activeTab === 'match' ? (
                    <div className="exercise-card">
                      <h3>Nối cặp</h3>
                      <p>Ghép từ tiếng Anh với nghĩa tiếng Việt phù hợp.</p>
                      <div className="match-list">
                        {matchingPairs.map((item, index) => (
                          <label key={item.word} className="match-row">
                            <span>{item.word}</span>
                            <select
                              value={matchAnswers[index]}
                              onChange={(event) => {
                                const next = [...matchAnswers];
                                next[index] = event.target.value;
                                setMatchAnswers(next);
                              }}
                            >
                              <option value="">Chọn nghĩa</option>
                              {matchingPairs.map((pair) => (
                                <option key={pair.answer} value={pair.answer}>
                                  {pair.answer}
                                </option>
                              ))}
                            </select>
                          </label>
                        ))}
                      </div>
                      <div className="exercise-feedback">{matchAnswers.filter(Boolean).length}/3 cặp đã chọn.</div>
                    </div>
                  ) : null}

                  {activeTab === 'blank' ? (
                    <div className="exercise-card">
                      <h3>Điền khuyết</h3>
                      <p>Hello, my name ____ Linh.</p>
                      <input
                        type="text"
                        value={blankAnswer}
                        onChange={(event) => setBlankAnswer(event.target.value)}
                        placeholder="Nhập đáp án"
                        className="lesson-input"
                      />
                      <div className={blankAnswer.trim().toLowerCase() === 'is' ? 'exercise-feedback success' : 'exercise-feedback'}>
                        {blankAnswer
                          ? blankAnswer.trim().toLowerCase() === 'is'
                            ? 'Chính xác, "is" phù hợp trong câu này.'
                            : 'Thử lại nhé. Gợi ý: dùng một dạng của động từ "to be".'
                          : 'Nhập đáp án để kiểm tra.'}
                      </div>
                    </div>
                  ) : null}

                  {activeTab === 'flash' ? (
                    <div className="exercise-card">
                      <h3>Thẻ ghi nhớ</h3>
                      <button type="button" className="flashcard" onClick={() => setFlashFlip((value) => !value)}>
                        <span>{flashFlip ? 'Xin chào = Hello' : 'Hello'}</span>
                        <small>{flashFlip ? 'Bấm để lật lại' : 'Bấm để xem nghĩa'}</small>
                      </button>
                    </div>
                  ) : null}
                </div>
              </section>
              )}

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
                  <article key={assignment.id} className="content-card content-card--enterprise assignment-card">
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
