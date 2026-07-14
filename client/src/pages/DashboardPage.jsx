import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { getAssignmentsForStudent } from '../lib/assignmentService';
import {
  deleteAdminCourse,
  deleteAdminLesson,
  deleteAdminProfile,
  defaultRolePermissions,
  getAdminDashboardData,
  getUsersWithPurchaseInfo,
  approvePaymentOrder,
  saveAdminCourse,
  saveAdminLesson,
  saveAdminProfile,
  saveRolePermissions
} from '../lib/adminService';
import {
  getCourseCatalog,
  getOwnedCourseIds,
  readTeacherManagedCourses,
  saveCourseToSupabase,
  writeTeacherManagedCourses
} from '../lib/courseService';
import { usePageTitle } from '../hooks/usePageTitle';
import { getActivityLogs } from '../lib/activityService';
import {
  exportUsersToExcel,
  exportOrdersToExcel,
  exportActivityToExcel
} from '../lib/reportService';
import { readFileAsDataUrl, uploadLessonVideo, validateImageFile, validateVideoFile } from '../lib/storageService';
import { PaginationControls, usePagination } from '../components/Pagination';
import { average, buildStudentProgressRows } from '../lib/studentProgressService';
import { formatVnd, normalizeVndAmount } from '../lib/money';
import { parseExcelCourseFile, parseExcelQuestionFile } from '../lib/excelCourseParser';
import { getEmbeddableVideoUrl, getVideoAccessHint, getVideoEmbedIssue, getVideoSourceLabel } from '../lib/videoLinks';
import { uploadCourseImage } from '../lib/storageService';

const exerciseTypeLabels = {
  mcq: 'Trắc nghiệm',
  tf: 'Đúng / Sai',
  match: 'Nối cặp',
  blank: 'Điền khuyết',
  flash: 'Thẻ ghi nhớ'
};

const DRAFT_OPTION_LABELS = ['A', 'B', 'C', 'D'];

const defaultExerciseConfig = {
  type: 'mcq',
  lessonPosition: '1',
  prompt: 'Từ nào phù hợp nhất với "hello"?',
  options: ['xin chào', 'tạm biệt', 'cảm ơn', 'xin lỗi'],
  correctAnswer: 'xin chào',
  trueFalseAnswer: 'Đúng',
  pairs: [
    { term: 'Hello', answer: 'Xin chào' },
    { term: 'Teacher', answer: 'Giảng viên' },
    { term: 'Practice', answer: 'Luyện tập' }
  ],
  blankText: 'Hello, my name ____ Linh.',
  blankAnswer: 'is',
  flashFront: 'Hello',
  flashBack: 'Xin chào',
  explanation: 'Học viên cần chọn đáp án đúng theo nội dung giảng viên cấu hình.'
};

function getExerciseConfig(assignment) {
  return {
    ...defaultExerciseConfig,
    ...(assignment?.exerciseConfig || {})
  };
}

function getGeneratedQuestions(config) {
  return Array.isArray(config.generatedQuestions)
    ? config.generatedQuestions.filter((question) => question?.prompt)
    : [];
}

function formatAssignmentScope(scope) {
  return scope === 'course_buyers' ? 'Học viên đã mua khóa' : 'Học viên được chọn';
}

function AssignmentExercisePreview({ assignment, showAnswer = false }) {
  const config = getExerciseConfig(assignment);
  const generatedQuestions = getGeneratedQuestions(config);
  const options = (config.options || []).filter(Boolean);
  const pairs = (config.pairs || []).filter((pair) => pair.term || pair.answer);

  if (generatedQuestions.length) {
    return (
      <div className="assignment-exercise-preview">
        <div className="assignment-exercise-preview__head">
          <span>Bộ câu hỏi OCR</span>
          <strong>{generatedQuestions.length} câu trắc nghiệm</strong>
        </div>

        <div className="generated-question-preview">
          {generatedQuestions.map((question, index) => (
            <article key={`${question.prompt}-${index}`} className="generated-question-preview__item">
              <strong>Câu {index + 1}. {question.prompt}</strong>
              <div className="exercise-options">
                {(question.options || []).filter(Boolean).map((option) => (
                  <span
                    key={option}
                    className={showAnswer && option === question.correctAnswer ? 'answer-pill is-active' : 'answer-pill'}
                  >
                    {option}
                  </span>
                ))}
              </div>
              {showAnswer ? <div className="exercise-feedback success">Đáp án: {question.correctAnswer}</div> : null}
            </article>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="assignment-exercise-preview">
      <div className="assignment-exercise-preview__head">
        <span>{exerciseTypeLabels[config.type] || 'Bài luyện'}</span>
        <strong>Bước {config.lessonPosition || '1'} trong lộ trình</strong>
      </div>

      {config.type === 'mcq' ? (
        <>
          <p>{config.prompt}</p>
          <div className="exercise-options">
            {options.map((option) => (
              <span key={option} className="answer-pill">
                {option}
              </span>
            ))}
          </div>
        </>
      ) : null}

      {config.type === 'tf' ? (
        <>
          <p>{config.prompt}</p>
          <div className="exercise-options">
            <span className="answer-pill">Đúng</span>
            <span className="answer-pill">Sai</span>
          </div>
        </>
      ) : null}

      {config.type === 'match' ? (
        <>
          <p>{config.prompt || 'Ghép từng mục với đáp án phù hợp.'}</p>
          <div className="match-list">
            {pairs.map((pair, index) => (
              <div key={`${pair.term}-${index}`} className="match-row">
                <span>{pair.term}</span>
                <span className="exercise-chip">Chọn đáp án</span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {config.type === 'blank' ? (
        <>
          <p>{config.blankText}</p>
          <input className="lesson-input" placeholder="Nhập đáp án" readOnly />
        </>
      ) : null}

      {config.type === 'flash' ? (
        <button type="button" className="flashcard">
          <span>{config.flashFront}</span>
          <small>Bấm để xem mặt sau</small>
        </button>
      ) : null}

      {showAnswer ? (
        <div className="exercise-feedback success">
          <strong>Đáp án giáo viên:</strong>{' '}
          {config.type === 'tf'
            ? config.trueFalseAnswer
            : config.type === 'blank'
              ? config.blankAnswer
              : config.type === 'flash'
                ? config.flashBack
                : config.type === 'match'
                  ? pairs.map((pair) => `${pair.term} = ${pair.answer}`).join('; ')
                  : config.correctAnswer}
        </div>
      ) : null}
    </div>
  );
}

function DashboardShell({ title, description, metrics, children }) {
  return (
    <div className="page">
      <section className="dashboard-head">
        <div>
          <span className="eyebrow">Bảng điều khiển</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </section>

      <section className="stat-grid">
        {metrics.map((metric) => (
          <article key={metric.label} className="stat-card stat-card--enterprise">
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </section>

      {children}
    </div>
  );
}

function AssignmentCard({ assignment }) {
  const config = getExerciseConfig(assignment);
  const generatedQuestions = getGeneratedQuestions(config);

  return (
    <article className="content-card content-card--enterprise assignment-card">
      <div className="assignment-card__head">
        <div>
          <span className="eyebrow">{assignment.courseTitle}</span>
          <h3>{assignment.title}</h3>
          <p>{assignment.lessonTitle}</p>
        </div>
        <span className="pill">{formatAssignmentScope(assignment.assignmentScope)}</span>
      </div>
      {assignment.description ? <p className="assignment-card__description">{assignment.description}</p> : null}
      <div className="assignment-card__meta">
        <span>{generatedQuestions.length ? `Bộ OCR ${generatedQuestions.length} câu` : exerciseTypeLabels[config.type] || 'Bài luyện'}</span>
        <span>Bước {config.lessonPosition || '1'} trong lộ trình</span>
        <span>{assignment.audioName || 'Chưa có audio'}</span>
        <span>{assignment.attachmentName || 'Chưa có tài liệu'}</span>
      </div>
      <AssignmentExercisePreview assignment={assignment} />
      <Link className="button-ghost" to={`/learn/${assignment.courseKey}`}>
        Làm bài trong phòng học
      </Link>
    </article>
  );
}

export function StudentDashboardPage() {
  usePageTitle('Bảng điều khiển học viên');
  const auth = useAuth();
  const email = auth.user?.email || '';
  const [assignments, setAssignments] = useState([]);
  const [ownedCount, setOwnedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const courses = await getCourseCatalog();
      const nextOwnedIds = await getOwnedCourseIds(auth.user?.id, courses);
      const nextAssignments = await getAssignmentsForStudent(email, nextOwnedIds);

      if (active) {
        setAssignments(nextAssignments);
        setOwnedCount(nextOwnedIds.length);
        setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [auth.user?.id, email]);

  const metrics = useMemo(
    () => [
      { label: 'Khóa đã sở hữu', value: String(ownedCount) },
      { label: 'Nhiệm vụ khả dụng', value: String(assignments.length) },
      { label: 'Điểm trung bình', value: '89' },
      { label: 'Chuỗi học tập', value: '12 ngày' }
    ],
    [assignments.length, ownedCount]
  );
  const assignmentPagination = usePagination(assignments, {
    pageSize: 4,
    resetKey: `${email}|${assignments.length}`
  });

  return (
    <DashboardShell
      title="Bảng điều khiển học viên"
      description="Theo dõi khóa học đã mua, bài học được giao, kết quả học tập và tiến độ chứng chỉ."
      metrics={metrics}
    >
      <section className="section split-layout">
        <div className="content-card content-card--enterprise">
          <h2>Bài học được giao</h2>
          {loading ? <p>Đang tải nhiệm vụ học tập...</p> : null}
          {!loading && assignments.length === 0 ? (
            <p className="empty-state">Chưa có nhiệm vụ học tập. Vui lòng liên hệ giảng viên để được cấp quyền.</p>
          ) : null}
          <div className="assignment-list">
            {assignmentPagination.pageItems.map((assignment) => (
              <AssignmentCard key={assignment.id} assignment={assignment} />
            ))}
          </div>
          <PaginationControls {...assignmentPagination} label="nhiệm vụ" />
        </div>

        <div className="content-card content-card--enterprise">
          <h2>Quy tắc truy cập</h2>
          <ul className="plain-list">
            <li>Học viên chỉ thấy bài học được giao đúng email tài khoản.</li>
            <li>Người đã mua khóa sẽ thấy học liệu dành riêng khi giảng viên bật quyền.</li>
            <li>Audio và tài liệu đính kèm do giảng viên chuẩn bị.</li>
          </ul>
        </div>
      </section>
    </DashboardShell>
  );
}

function createCourseSlug(title) {
  return String(title || 'khoa-hoc')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'khoa-hoc';
}

function normalizeManagedCourse(course, index = 0) {
  const priceValue = normalizeVndAmount(course.priceValue ?? course.price);
  return {
    id: course.id || course.slug || `course-${index + 1}`,
    title: course.title || 'Khóa học chưa đặt tên',
    summary: course.summary || course.description || 'Khóa học được giảng viên đăng lên hệ thống.',
    category: course.category || 'Kỹ năng cốt lõi',
    level: course.level || 'Nền tảng',
    duration: course.duration || '6 tuần',
    lessonsCount: Number(course.lessonsCount || course.lessons_count || course.sections?.reduce((sum, section) => sum + (section.lessons?.length || 0), 0) || 12),
    priceValue,
    price: formatVnd(priceValue),
    status: course.status || 'published',
    publishedAt: course.publishedAt || 'Đã đăng',
    sections: Array.isArray(course.sections) ? course.sections : []
  };
}

function createEmptyCourseDraft() {
  return {
    title: '',
    category: 'Kỹ năng cốt lõi',
    level: 'Nền tảng',
    duration: '6 tuần',
    lessonsCount: '12',
    price: '490000',
    summary: '',
    bannerUrl: null,
    sections: []
  };
}

const TEACHER_COURSE_DRAFT_STORAGE_KEY = 'teacher-course-draft-v1';
const TEACHER_DASHBOARD_UI_STORAGE_KEY = 'teacher-dashboard-ui-v1';

function getTeacherCourseDraftKey(teacherId = 'local') {
  return `${TEACHER_COURSE_DRAFT_STORAGE_KEY}:${teacherId || 'local'}`;
}

function getTeacherDashboardUiKey(teacherId = 'local') {
  return `${TEACHER_DASHBOARD_UI_STORAGE_KEY}:${teacherId || 'local'}`;
}

function readTeacherCourseDraft(teacherId) {
  try {
    const rawValue = localStorage.getItem(getTeacherCourseDraftKey(teacherId));
    if (!rawValue) return null;
    const parsedValue = JSON.parse(rawValue);
    return parsedValue && typeof parsedValue === 'object' ? parsedValue : null;
  } catch {
    return null;
  }
}

function writeTeacherCourseDraft(teacherId, draftState) {
  try {
    localStorage.setItem(getTeacherCourseDraftKey(teacherId), JSON.stringify({
      ...draftState,
      savedAt: new Date().toISOString()
    }));
  } catch {
    // ignore storage failures
  }
}

function clearTeacherCourseDraft(teacherId) {
  try {
    localStorage.removeItem(getTeacherCourseDraftKey(teacherId));
  } catch {
    // ignore storage failures
  }
}

function readTeacherDashboardUiState(teacherId) {
  try {
    const rawValue = localStorage.getItem(getTeacherDashboardUiKey(teacherId));
    if (!rawValue) return null;
    const parsedValue = JSON.parse(rawValue);
    return parsedValue && typeof parsedValue === 'object' ? parsedValue : null;
  } catch {
    return null;
  }
}

function writeTeacherDashboardUiState(teacherId, uiState) {
  try {
    localStorage.setItem(
      getTeacherDashboardUiKey(teacherId),
      JSON.stringify({
        ...uiState,
        savedAt: new Date().toISOString()
      })
    );
  } catch {
    // ignore storage failures
  }
}

function isCourseDraftDirty(draftState) {
  const defaultDraft = createEmptyCourseDraft();
  const draft = draftState?.courseDraft || defaultDraft;
  const manualDraft = draftState?.manualLessonDraft || {};

  return Boolean(
    draftState?.editingCourseId ||
      draftState?.courseInputMode !== 'manual' ||
      draftState?.importDriveLink?.trim() ||
      draft.title?.trim() ||
      draft.summary?.trim() ||
      draft.sections?.length ||
      String(draft.price || '') !== defaultDraft.price ||
      String(draft.lessonsCount || '') !== defaultDraft.lessonsCount ||
      draft.category !== defaultDraft.category ||
      draft.level !== defaultDraft.level ||
      draft.duration !== defaultDraft.duration ||
      manualDraft.lessonsText?.trim() ||
      (manualDraft.sectionTitle && manualDraft.sectionTitle !== 'Nội dung chính')
  );
}

function flattenDraftLessons(sections = []) {
  return sections.flatMap((section, sectionIndex) =>
    (section.lessons || []).map((lesson, lessonIndex) => ({
      ...lesson,
      sectionIndex,
      lessonIndex,
      sectionTitle: section.title
    }))
  );
}

function getDraftLessonKey(lesson) {
  return lesson?.id || `${lesson?.sectionIndex || 0}-${lesson?.lessonIndex || 0}`;
}

function getCourseQuestionCount(sections = []) {
  return sections.reduce(
    (total, section) =>
      total +
      (section.lessons || []).reduce(
        (lessonTotal, lesson) => lessonTotal + (lesson.questionCount || lesson.exercises?.length || lesson.questions?.length || 0),
        0
      ),
    0
  );
}

function LessonStudentViewPreview({ lesson, showAnswers = false }) {
  const exercises = Array.isArray(lesson?.exercises) ? lesson.exercises : Array.isArray(lesson?.questions) ? lesson.questions : [];
  const rawVideoUrl = lesson?.videoUrl || lesson?.videoEmbedUrl || '';
  const videoUrl = getEmbeddableVideoUrl(rawVideoUrl);
  const videoIssue = getVideoEmbedIssue(rawVideoUrl);
  const videoAccessHint = getVideoAccessHint(rawVideoUrl);

  return (
    <div className="lesson-student-preview">
      <div className="section-head">
        <div>
          <span className="eyebrow">Student view</span>
          <h3>{lesson?.title || 'Bài học'}</h3>
          <p>{lesson?.note || lesson?.exerciseType || 'Bài học học sinh sẽ nhìn thấy.'}</p>
        </div>
        <span className="pill">{showAnswers ? 'Có đáp án' : 'Ẩn đáp án'}</span>
      </div>

      {rawVideoUrl && !videoUrl ? (
        <div className="lesson-video-warning">
          <strong>Video chưa thể nhúng</strong>
          <p>{videoIssue || 'Link video hiện tại chưa thể phát trực tiếp trong trang học.'}</p>
          <a className="button-ghost" href={rawVideoUrl} target="_blank" rel="noreferrer">
            Mở link gốc
          </a>
        </div>
      ) : null}

      {videoUrl ? (
        <div className="lesson-video-panel lesson-video-panel--preview">
          {videoAccessHint ? (
            <div className="lesson-video-panel__notice">
              <div>
                <strong>Video Google Drive</strong>
                <p>{videoAccessHint} Nếu video vẫn trắng, hãy mở preview để kiểm tra file đã được Google xử lý xong chưa.</p>
              </div>
              <a className="button-ghost" href={videoUrl} target="_blank" rel="noreferrer">
                Mở preview
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
          <div className="lesson-video-panel__meta">
            <strong>{lesson?.videoTitle || lesson?.title || 'Video bài học'}</strong>
            <span>{getVideoSourceLabel(rawVideoUrl)}</span>
          </div>
        </div>
      ) : null}

      {lesson?.audioUrl || lesson?.imageUrl ? (
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

      <div className="generated-question-preview">
        {exercises.length ? (
          exercises.map((exercise, index) => (
            <article key={exercise.id || `${lesson.id}-preview-${index}`} className="generated-question-preview__item">
              <strong>{exercise.prompt || `${lesson.exerciseType || 'Câu hỏi'} - Câu ${exercise.number || index + 1}`}</strong>
              {exercise.options?.length ? (
                <div className="exercise-options">
                  {exercise.options.map((option) => (
                    <span
                      key={`${exercise.id}-${option.label}`}
                      className={showAnswers && option.label === (exercise.correctAnswer || exercise.answer) ? 'answer-pill is-correct' : 'answer-pill'}
                    >
                      {option.label}. {option.text}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="empty-state">Bài này không có lựa chọn đáp án.</p>
              )}
              {showAnswers && (exercise.correctAnswer || exercise.answer) ? (
                <div className="exercise-feedback success">Đáp án: {exercise.correctAnswer || exercise.answer}</div>
              ) : null}
            </article>
          ))
        ) : (
          <p className="empty-state">Bài này chưa có câu hỏi.</p>
        )}
      </div>
    </div>
  );
}

export function TeacherDashboardPage() {
  usePageTitle('Bảng điều khiển giảng viên');
  const auth = useAuth();
  const teacherId = auth.user?.id || 'local';
  const [teacherCourses, setTeacherCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [courseDraft, setCourseDraft] = useState(() => createEmptyCourseDraft());
  const [editingCourseId, setEditingCourseId] = useState('');
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerUploadError, setBannerUploadError] = useState('');
  const [courseInputMode, setCourseInputMode] = useState('manual');
  const [manualLessonDraft, setManualLessonDraft] = useState({
    sectionTitle: 'Nội dung chính',
    lessonsText: ''
  });
  const [importMessage, setImportMessage] = useState({ type: '', text: '' });
  const [importDriveLink, setImportDriveLink] = useState('');
  const [selectedDraftLessonId, setSelectedDraftLessonId] = useState('');
  const [studentPreviewLessonId, setStudentPreviewLessonId] = useState('');
  const [draftHydratedTeacherId, setDraftHydratedTeacherId] = useState('');
  const [coursePublisherOpen, setCoursePublisherOpen] = useState(false);
  const [activeCoursesOpen, setActiveCoursesOpen] = useState(false);
  const [expandedCourseId, setExpandedCourseId] = useState('');

  useEffect(() => {
    let active = true;

    async function loadTeacherCourses() {
      setLoading(true);
      try {
        const storedCourses = readTeacherManagedCourses(teacherId);

        if (active) {
          setTeacherCourses(Array.isArray(storedCourses) ? storedCourses : []);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadTeacherCourses();

    return () => {
      active = false;
    };
  }, [teacherId]);

  useEffect(() => {
    setDraftHydratedTeacherId('');
    const savedDraft = readTeacherCourseDraft(teacherId);
    const savedUiState = readTeacherDashboardUiState(teacherId);

    if (savedDraft && isCourseDraftDirty(savedDraft)) {
      const restoredCourseDraft = {
        ...createEmptyCourseDraft(),
        ...(savedDraft.courseDraft || {}),
        sections: Array.isArray(savedDraft.courseDraft?.sections) ? savedDraft.courseDraft.sections : []
      };
      const restoredManualDraft = {
        sectionTitle: 'Nội dung chính',
        lessonsText: '',
        ...(savedDraft.manualLessonDraft || {})
      };

      setCourseDraft(restoredCourseDraft);
      setEditingCourseId(savedDraft.editingCourseId || '');
      setCourseInputMode(savedDraft.courseInputMode || 'manual');
      setManualLessonDraft(restoredManualDraft);
      setImportDriveLink(savedDraft.importDriveLink || '');
      setSelectedDraftLessonId(savedDraft.selectedDraftLessonId || '');
      setStudentPreviewLessonId(savedDraft.studentPreviewLessonId || '');
      setImportMessage({ type: 'info', text: 'Đã khôi phục bản nháp đang làm dở.' });
    } else {
      setCourseDraft(createEmptyCourseDraft());
      setEditingCourseId('');
      setCourseInputMode('manual');
      setManualLessonDraft({ sectionTitle: 'Nội dung chính', lessonsText: '' });
      setImportDriveLink('');
      setSelectedDraftLessonId('');
      setStudentPreviewLessonId('');
    }

    setCoursePublisherOpen(Boolean(savedUiState?.coursePublisherOpen ?? isCourseDraftDirty(savedDraft)));
    setActiveCoursesOpen(Boolean(savedUiState?.activeCoursesOpen));
    setExpandedCourseId(savedUiState?.expandedCourseId || '');
    setDraftHydratedTeacherId(teacherId);
  }, [teacherId]);

  useEffect(() => {
    if (draftHydratedTeacherId !== teacherId) {
      return;
    }

    const draftState = {
      courseDraft,
      editingCourseId,
      courseInputMode,
      manualLessonDraft,
      importDriveLink,
      selectedDraftLessonId,
      studentPreviewLessonId
    };

    if (isCourseDraftDirty(draftState)) {
      writeTeacherCourseDraft(teacherId, draftState);
    } else {
      clearTeacherCourseDraft(teacherId);
    }
  }, [
    courseDraft,
    courseInputMode,
    draftHydratedTeacherId,
    editingCourseId,
    importDriveLink,
    manualLessonDraft,
    selectedDraftLessonId,
    studentPreviewLessonId,
    teacherId
  ]);

  useEffect(() => {
    if (draftHydratedTeacherId !== teacherId) {
      return;
    }

    writeTeacherDashboardUiState(teacherId, {
      coursePublisherOpen,
      activeCoursesOpen,
      expandedCourseId
    });
  }, [activeCoursesOpen, coursePublisherOpen, draftHydratedTeacherId, expandedCourseId, teacherId]);

  const studentRows = useMemo(() => buildStudentProgressRows(teacherCourses), [teacherCourses]);

  const courseStats = useMemo(
    () =>
      teacherCourses.map((course) => {
        const students = studentRows.filter((student) => student.courseId === course.id);
        return {
          ...course,
          studentsCount: students.length,
          averageProgress: average(students.map((student) => student.progress)),
          averageScore: average(students.map((student) => student.score))
        };
      }),
    [studentRows, teacherCourses]
  );

  const averageScore = average(studentRows.map((student) => student.score));
  const publishedCount = teacherCourses.filter((course) => course.status === 'published').length;

  const metrics = useMemo(
    () => [
      { label: 'Khóa đã đăng', value: String(teacherCourses.length) },
      { label: 'Đang công khai', value: String(publishedCount) },
      { label: 'Học sinh đang học', value: String(studentRows.length) },
      { label: 'Hiệu quả trung bình', value: `${averageScore}%` }
    ],
    [averageScore, publishedCount, studentRows.length, teacherCourses.length]
  );
  const courseStatsPagination = usePagination(courseStats, {
    pageSize: 4,
    resetKey: `${teacherId}|${courseStats.length}`
  });
  const expandedCourse = useMemo(
    () => courseStats.find((course) => course.id === expandedCourseId) || null,
    [courseStats, expandedCourseId]
  );
  const draftLessons = useMemo(() => flattenDraftLessons(courseDraft.sections), [courseDraft.sections]);
  const selectedDraftLesson =
    draftLessons.find((lesson) => getDraftLessonKey(lesson) === selectedDraftLessonId) || draftLessons[0] || null;
  const studentPreviewLesson =
    draftLessons.find((lesson) => getDraftLessonKey(lesson) === studentPreviewLessonId) || selectedDraftLesson;
  const selectedDraftLessonSectionLessons = selectedDraftLesson
    ? courseDraft.sections[selectedDraftLesson.sectionIndex]?.lessons || []
    : [];
  const selectedDraftLessonCanMoveUp = Boolean(selectedDraftLesson && selectedDraftLesson.lessonIndex > 0);
  const selectedDraftLessonCanMoveDown = Boolean(
    selectedDraftLesson && selectedDraftLesson.lessonIndex < selectedDraftLessonSectionLessons.length - 1
  );
  const hasDraftAudio = draftLessons.some((lesson) => lesson.audioUrl || lesson.audioName);
  const hasDraftImage = draftLessons.some((lesson) => lesson.imageUrl || lesson.imageName);
  const hasDraftVideo = draftLessons.some((lesson) => lesson.videoUrl);
  const importSteps = [
    { label: '1. Tạo bài học', done: draftLessons.length > 0 },
    { label: '2. Link video Drive', done: hasDraftVideo },
    { label: '3. Tài nguyên phụ', done: hasDraftAudio || hasDraftImage, optional: true },
    { label: '4. Confirm & đăng', done: draftLessons.length > 0 && courseDraft.title.trim() }
  ];

  useEffect(() => {
    if (!draftLessons.length) {
      setSelectedDraftLessonId('');
      setStudentPreviewLessonId('');
      return;
    }

    if (!draftLessons.some((lesson) => getDraftLessonKey(lesson) === selectedDraftLessonId)) {
      const firstLessonKey = getDraftLessonKey(draftLessons[0]);
      setSelectedDraftLessonId(firstLessonKey);
      setStudentPreviewLessonId(firstLessonKey);
    }
  }, [draftLessons, selectedDraftLessonId]);

  useEffect(() => {
    if (expandedCourseId && !courseStatsPagination.pageItems.some((course) => course.id === expandedCourseId)) {
      setExpandedCourseId('');
    }
  }, [courseStatsPagination.pageItems, expandedCourseId]);

  function updateDraft(field, value) {
    setCourseDraft((previous) => ({ ...previous, [field]: value }));
  }

  function updateDraftSections(sections) {
    const normalizedSections = sections.map((section) => ({
      ...section,
      lessons: (section.lessons || []).map((lesson, lessonIndex) => ({
        ...lesson,
        lessonNumber: String(lessonIndex + 1),
        position: lessonIndex + 1
      }))
    }));
    const lessonsCount = normalizedSections.reduce((count, section) => count + ((section.lessons || []).length), 0);
    const firstLesson = normalizedSections.flatMap((section) => section.lessons || [])[0];
    setCourseDraft((previous) => ({
      ...previous,
      sections: normalizedSections,
      lessonsCount: String(lessonsCount || previous.lessonsCount || 1)
    }));
    if (firstLesson) {
      setSelectedDraftLessonId(firstLesson.id);
      setStudentPreviewLessonId(firstLesson.id);
    }
  }

  function updateDraftSectionsInPlace(nextSections, options = {}) {
    const normalizedSections = nextSections.map((section) => ({
      ...section,
      lessons: (section.lessons || []).map((lesson, lessonIndex) => ({
        ...lesson,
        lessonNumber: String(lessonIndex + 1),
        position: lessonIndex + 1
      }))
    }));
    const lessonsCount = normalizedSections.reduce((count, section) => count + ((section.lessons || []).length), 0);
    setCourseDraft((previous) => ({
      ...previous,
      sections: normalizedSections,
      lessonsCount: String(lessonsCount || previous.lessonsCount || 1)
    }));

    if (options.focusLessonId) {
      setSelectedDraftLessonId(options.focusLessonId);
    }

    if (options.previewLessonId || options.focusLessonId) {
      setStudentPreviewLessonId(options.previewLessonId || options.focusLessonId);
    }
  }

  function createDraftLesson(sectionTitle, lessonNumber) {
    const nextNumber = Number(lessonNumber) || 1;
    return {
      id: `draft-lesson-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      title: `Bài ${nextNumber} mới`,
      lessonNumber: String(nextNumber),
      exerciseType: 'Nhập thủ công',
      status: 'active',
      note: `Bài ${nextNumber} · Nhập thủ công`,
      sectionTitle: sectionTitle || 'Nội dung chính',
      questionCount: 0,
      questions: [],
      exercises: []
    };
  }

  function addDraftLessonAfter(sectionIndex, lessonIndex) {
    const nextSections = courseDraft.sections.map((section, currentSectionIndex) => {
      if (currentSectionIndex !== sectionIndex) {
        return section;
      }

      const lessons = Array.isArray(section.lessons) ? [...section.lessons] : [];
      const insertIndex = Number.isInteger(lessonIndex) ? lessonIndex + 1 : lessons.length;
      const nextLesson = createDraftLesson(section.title, insertIndex + 1);
      lessons.splice(insertIndex, 0, nextLesson);

      return {
        ...section,
        lessons
      };
    });

    updateDraftSectionsInPlace(nextSections, {
      focusLessonId: nextSections[sectionIndex]?.lessons?.[Number.isInteger(lessonIndex) ? lessonIndex + 1 : nextSections[sectionIndex]?.lessons?.length - 1]?.id,
      previewLessonId: nextSections[sectionIndex]?.lessons?.[Number.isInteger(lessonIndex) ? lessonIndex + 1 : nextSections[sectionIndex]?.lessons?.length - 1]?.id
    });
  }

  function moveDraftLesson(sectionIndex, lessonIndex, direction) {
    const nextSections = courseDraft.sections.map((section, currentSectionIndex) => {
      if (currentSectionIndex !== sectionIndex) {
        return section;
      }

      const lessons = Array.isArray(section.lessons) ? [...section.lessons] : [];
      const targetIndex = lessonIndex + direction;
      if (targetIndex < 0 || targetIndex >= lessons.length) {
        return section;
      }

      [lessons[lessonIndex], lessons[targetIndex]] = [lessons[targetIndex], lessons[lessonIndex]];
      return {
        ...section,
        lessons
      };
    });

    updateDraftSectionsInPlace(nextSections, {
      focusLessonId: selectedDraftLesson?.id || '',
      previewLessonId: studentPreviewLesson?.id || selectedDraftLesson?.id || ''
    });
  }

  function persistCourses(nextCourses) {
    setTeacherCourses(nextCourses);
    writeTeacherManagedCourses(teacherId, nextCourses);
  }

  function resetCourseDraft() {
    setEditingCourseId('');
    setCourseDraft(createEmptyCourseDraft());
    setCourseInputMode('manual');
    setManualLessonDraft({ sectionTitle: 'Nội dung chính', lessonsText: '' });
    setImportDriveLink('');
    setImportMessage({ type: '', text: '' });
    setSelectedDraftLessonId('');
    setStudentPreviewLessonId('');
  }

  function openCoursePublisherForNew() {
    if (editingCourseId) {
      resetCourseDraft();
    }
    setCoursePublisherOpen(true);
    setActiveCoursesOpen(false);
  }

  function loadCourseForEditing(courseId) {
    if (!courseId) {
      resetCourseDraft();
      setCoursePublisherOpen(true);
      setActiveCoursesOpen(false);
      return;
    }

    const course = teacherCourses.find((item) => item.id === courseId);
    if (!course) return;

    setEditingCourseId(course.id);
    setActiveCoursesOpen(false);
    setCourseDraft({
      title: course.title || '',
      category: course.category || 'Kỹ năng cốt lõi',
      level: course.level || 'Nền tảng',
      duration: course.duration || '6 tuần',
      lessonsCount: String(course.lessonsCount || 1),
      price: String(course.priceValue ?? normalizeVndAmount(course.price)),
      summary: course.summary || '',
      sections: Array.isArray(course.sections) ? course.sections : []
    });
    setCourseInputMode('excel');
    const firstLesson = flattenDraftLessons(course.sections || [])[0];
    setSelectedDraftLessonId(firstLesson ? getDraftLessonKey(firstLesson) : '');
    setStudentPreviewLessonId(firstLesson ? getDraftLessonKey(firstLesson) : '');
    setImportMessage({ type: 'info', text: `Đang chỉnh sửa "${course.title}".` });
    setCoursePublisherOpen(true);
  }

  function updateDraftLesson(sectionIndex, lessonIndex, patch) {
    setCourseDraft((previous) => {
      const nextSections = previous.sections.map((section, currentSectionIndex) => {
        if (currentSectionIndex !== sectionIndex) return section;

        return {
          ...section,
          lessons: (section.lessons || []).map((lesson, currentLessonIndex) => {
            if (currentLessonIndex !== lessonIndex) return lesson;
            const nextLesson = { ...lesson, ...patch };
            return {
              ...nextLesson,
              questionCount: nextLesson.exercises?.length || nextLesson.questions?.length || nextLesson.questionCount || 0
            };
          })
        };
      });

      return {
        ...previous,
        sections: nextSections
      };
    });
  }

  function updateDraftQuestion(sectionIndex, lessonIndex, questionIndex, patch) {
    setCourseDraft((previous) => {
      const nextSections = previous.sections.map((section, currentSectionIndex) => {
        if (currentSectionIndex !== sectionIndex) return section;

        return {
          ...section,
          lessons: (section.lessons || []).map((lesson, currentLessonIndex) => {
            if (currentLessonIndex !== lessonIndex) return lesson;
            const questions = Array.isArray(lesson.exercises) ? lesson.exercises : Array.isArray(lesson.questions) ? lesson.questions : [];
            const nextQuestions = questions.map((question, currentQuestionIndex) =>
              currentQuestionIndex === questionIndex ? { ...question, ...patch } : question
            );

            return {
              ...lesson,
              questions: nextQuestions,
              exercises: nextQuestions,
              questionCount: nextQuestions.length
            };
          })
        };
      });

      return {
        ...previous,
        sections: nextSections
      };
    });
  }

  function updateDraftQuestionOption(sectionIndex, lessonIndex, questionIndex, optionIndex, value) {
    const lesson = courseDraft.sections[sectionIndex]?.lessons?.[lessonIndex];
    const questions = Array.isArray(lesson?.exercises) ? lesson.exercises : Array.isArray(lesson?.questions) ? lesson.questions : [];
    const question = questions[questionIndex];
    const options = (question?.options || []).map((option, currentOptionIndex) =>
      currentOptionIndex === optionIndex ? { ...option, text: value } : option
    );

    updateDraftQuestion(sectionIndex, lessonIndex, questionIndex, { options });
  }

  function createDraftLessonQuestion(lesson, index = 0) {
    return {
      id: `${lesson?.id || 'lesson'}-manual-question-${Date.now()}-${index}`,
      number: String(index + 1),
      prompt: '',
      options: DRAFT_OPTION_LABELS.map((label) => ({ label, text: '' })),
      answer: 'A',
      correctAnswer: 'A',
      note: ''
    };
  }

  function appendDraftLessonQuestions(sectionIndex, lessonIndex, questionsToAdd = []) {
    setCourseDraft((previous) => {
      const nextSections = previous.sections.map((section, currentSectionIndex) => {
        if (currentSectionIndex !== sectionIndex) return section;

        return {
          ...section,
          lessons: (section.lessons || []).map((lesson, currentLessonIndex) => {
            if (currentLessonIndex !== lessonIndex) return lesson;
            const questions = Array.isArray(lesson.exercises) ? lesson.exercises : Array.isArray(lesson.questions) ? lesson.questions : [];
            const nextQuestions = [
              ...questions,
              ...questionsToAdd.map((question, questionIndex) => ({
                ...question,
                id: question.id || `${lesson.id || 'lesson'}-question-${Date.now()}-${questionIndex}`,
                number: String(questions.length + questionIndex + 1),
                options: Array.isArray(question.options) && question.options.length
                  ? question.options.map((option, optionIndex) => ({
                      label: option.label || DRAFT_OPTION_LABELS[optionIndex] || String(optionIndex + 1),
                      text: option.text || option.value || ''
                    }))
                  : DRAFT_OPTION_LABELS.map((label) => ({ label, text: '' })),
                answer: question.correctAnswer || question.answer || 'A',
                correctAnswer: question.correctAnswer || question.answer || 'A',
                note: question.note || question.explanation || ''
              }))
            ];

            return {
              ...lesson,
              questions: nextQuestions,
              exercises: nextQuestions,
              questionCount: nextQuestions.length
            };
          })
        };
      });

      return {
        ...previous,
        sections: nextSections
      };
    });
  }

  function addDraftLessonQuestion(sectionIndex, lessonIndex) {
    const lesson = courseDraft.sections[sectionIndex]?.lessons?.[lessonIndex];
    const questions = Array.isArray(lesson?.exercises) ? lesson.exercises : Array.isArray(lesson?.questions) ? lesson.questions : [];
    appendDraftLessonQuestions(sectionIndex, lessonIndex, [createDraftLessonQuestion(lesson, questions.length)]);
    setImportMessage({ type: 'success', text: 'Đã thêm một câu hỏi thủ công cho bài học.' });
  }

  function deleteDraftQuestion(sectionIndex, lessonIndex, questionIndex) {
    setCourseDraft((previous) => {
      const nextSections = previous.sections.map((section, currentSectionIndex) => {
        if (currentSectionIndex !== sectionIndex) return section;

        return {
          ...section,
          lessons: (section.lessons || []).map((lesson, currentLessonIndex) => {
            if (currentLessonIndex !== lessonIndex) return lesson;
            const questions = Array.isArray(lesson.exercises) ? lesson.exercises : Array.isArray(lesson.questions) ? lesson.questions : [];
            const nextQuestions = questions
              .filter((_, currentQuestionIndex) => currentQuestionIndex !== questionIndex)
              .map((question, currentQuestionIndex) => ({
                ...question,
                number: String(currentQuestionIndex + 1)
              }));

            return {
              ...lesson,
              questions: nextQuestions,
              exercises: nextQuestions,
              questionCount: nextQuestions.length
            };
          })
        };
      });

      return {
        ...previous,
        sections: nextSections
      };
    });
    setImportMessage({ type: 'success', text: 'Đã xóa câu hỏi khỏi bài học.' });
  }

  async function handleDraftLessonQuestionFile(sectionIndex, lessonIndex, file) {
    if (!file) return;

    try {
      if (!/\.(xls|xlsx)$/i.test(file.name)) {
        setImportMessage({ type: 'error', text: 'Vui lòng chọn file Excel .xls hoặc .xlsx cho bài tập.' });
        return;
      }

      const questions = await parseExcelQuestionFile(file);
      if (!questions.length) {
        setImportMessage({ type: 'error', text: 'File Excel chưa có câu hỏi hợp lệ cho bài tập dưới video.' });
        return;
      }

      appendDraftLessonQuestions(sectionIndex, lessonIndex, questions);
      setImportMessage({ type: 'success', text: `Đã thêm ${questions.length} câu hỏi từ ${file.name} cho bài học.` });
    } catch {
      setImportMessage({ type: 'error', text: 'Không thể đọc file Excel bài tập. Hãy kiểm tra lại cấu trúc file.' });
    }
  }

  async function handleDraftLessonAsset(sectionIndex, lessonIndex, type, file) {
    if (!file) return;
    const isAudio = type === 'audio';
    const isImage = type === 'image';

    if (isAudio && !file.type.startsWith('audio/')) {
      setImportMessage({ type: 'error', text: 'File nghe phải là định dạng audio.' });
      return;
    }

    if (isImage && !file.type.startsWith('image/')) {
      setImportMessage({ type: 'error', text: 'Ảnh minh họa phải là định dạng ảnh.' });
      return;
    }

    if (isImage) {
      const validationError = validateImageFile(file);
      if (validationError) {
        setImportMessage({ type: 'error', text: validationError });
        return;
      }

      try {
        const imageDataUrl = await readFileAsDataUrl(file);

        updateDraftLesson(sectionIndex, lessonIndex, {
          imageName: file.name,
          imageUrl: imageDataUrl
        });
        setImportMessage({ type: 'success', text: 'Đã thêm ảnh minh họa cho bài học.' });
      } catch (error) {
        setImportMessage({ type: 'error', text: error?.message || 'Không thể tải ảnh lên.' });
      }

      return;
    }

    const fileUrl = URL.createObjectURL(file);
    updateDraftLesson(sectionIndex, lessonIndex, {
      [`${type}Name`]: file.name,
      [`${type}Url`]: fileUrl
    });
    setImportMessage({ type: 'success', text: 'Đã thêm file nghe cho bài học.' });
  }

  async function handleImportFile(file) {
    if (!file) return;
    setImportMessage({ type: '', text: '' });

    try {
      if (!/\.(xls|xlsx)$/i.test(file.name)) {
        setImportMessage({ type: 'error', text: 'Vui lòng chọn đúng file Excel .xls hoặc .xlsx.' });
        return;
      }

      const sections = await parseExcelCourseFile(file);
      if (!sections.length) {
        setImportMessage({ type: 'error', text: 'File Excel không có bài học hợp lệ. Kiểm tra các cột Tên bài, Bài, Dạng bài, Câu.' });
        return;
      }
      updateDraftSections(sections);
      if (!courseDraft.title.trim()) {
        setCourseDraft((previous) => ({
          ...previous,
          title: file.name.replace(/\.[^/.]+$/, ''),
          lessonsCount: sections.reduce((count, section) => count + ((section.lessons || []).length), 0) || previous.lessonsCount,
          summary: previous.summary || `Khóa học được tạo tự động từ ${file.name}.`
        }));
      }
      const lessonsCount = sections.reduce((count, section) => count + ((section.lessons || []).length), 0);
      const questionsCount = sections.reduce(
        (count, section) => count + (section.lessons || []).reduce((lessonCount, lesson) => lessonCount + (lesson.questionCount || 0), 0),
        0
      );
      setImportMessage({ type: 'success', text: `Đã đọc ${sections.length} chủ đề, ${lessonsCount} bài học và ${questionsCount} câu từ ${file.name}.` });
    } catch (error) {
      setImportMessage({ type: 'error', text: 'Không thể đọc tệp nhập. Vui lòng thử lại.' });
    }
  }

  function handleImportDriveLink() {
    const rows = importDriveLink
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!rows.length) {
      setImportMessage({ type: 'error', text: 'Hãy nhập ít nhất một link video Google Drive.' });
      return;
    }

    const parsedRows = rows.map((row, index) => {
      const parts = row.split('|').map((part) => part.trim()).filter(Boolean);
      const rawUrl = parts.length > 1 ? parts[parts.length - 1] : parts[0];
      const title = parts.length > 1 ? parts.slice(0, -1).join(' | ') : `Bài ${index + 1}`;
      return { rawUrl, title };
    });
    const invalidRow = parsedRows.find(({ rawUrl }) => getVideoEmbedIssue(rawUrl));
    if (invalidRow) {
      setImportMessage({ type: 'error', text: getVideoEmbedIssue(invalidRow.rawUrl) });
      return;
    }

    const now = Date.now();
    const sections = [
      {
        title: 'Video bài giảng',
        lessons: parsedRows.map(({ rawUrl, title }, index) => {
          return {
            id: `drive-video-lesson-${now}-${index}`,
            title,
            lessonNumber: String(index + 1),
            exerciseType: 'Video bài giảng',
            status: 'active',
            note: `Bài ${index + 1} · Video Google Drive`,
            videoTitle: title,
            videoUrl: rawUrl,
            videoEmbedUrl: getEmbeddableVideoUrl(rawUrl),
            questionCount: 0,
            questions: [],
            exercises: []
          };
        })
      }
    ];

    updateDraftSections(sections);
    if (!courseDraft.title.trim()) {
      setCourseDraft((previous) => ({
        ...previous,
        title: 'Khóa học video từ Drive',
        lessonsCount: sections.reduce((count, section) => count + ((section.lessons || []).length), 0) || previous.lessonsCount,
        summary: previous.summary || 'Khóa học gồm các video bài giảng được nhúng từ Google Drive.'
      }));
    }
    setImportMessage({ type: 'success', text: `Đã tạo ${rows.length} bài học video từ Google Drive.` });
  }

  function handleCreateManualLessons() {
    const lessonLines = manualLessonDraft.lessonsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lessonLines.length) {
      setImportMessage({ type: 'error', text: 'Hãy nhập ít nhất 1 bài học, mỗi bài trên một dòng.' });
      return;
    }

    const sections = [
      {
        title: manualLessonDraft.sectionTitle.trim() || 'Nội dung chính',
        lessons: lessonLines.map((title, index) => ({
          id: `manual-lesson-${Date.now()}-${index}`,
          title,
          lessonNumber: String(index + 1),
          exerciseType: 'Nhập thủ công',
          status: 'active',
          note: `Bài ${index + 1} · Nhập thủ công`,
          questionCount: 0,
          questions: [],
          exercises: []
        }))
      }
    ];

    updateDraftSections(sections);
    setImportMessage({ type: 'success', text: `Đã tạo ${lessonLines.length} bài học thủ công để xem trước.` });
  }

  async function handleBannerChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const errorMsg = validateImageFile(file);
    if (errorMsg) {
      setBannerUploadError(errorMsg);
      return;
    }

    setBannerUploadError('');
    setUploadingBanner(true);
    try {
      const courseId = editingCourseId || '';
      const result = await uploadCourseImage(file, courseId);
      
      if (result?.url) {
        updateDraft('bannerUrl', result.url);
      } else {
        setBannerUploadError('Lỗi tải ảnh lên Supabase. Đảm bảo bucket "course-images" đã được tạo.');
      }
    } catch (err) {
      setBannerUploadError('Đã xảy ra lỗi khi tải ảnh.');
    } finally {
      setUploadingBanner(false);
    }
  }

  async function handlePublishCourse(event) {
    event.preventDefault();
    setMessage({ type: '', text: '' });

    if (!courseDraft.title.trim()) {
      setMessage({ type: 'error', text: 'Hãy nhập tên khóa học trước khi đăng.' });
      return;
    }

    if (!draftLessons.length) {
      setMessage({ type: 'error', text: 'Hãy tạo bài học bằng Drive, Excel hoặc nhập thủ công trước khi đăng.' });
      return;
    }

    setSaving(true);
    try {
      const existingCourse = teacherCourses.find((course) => course.id === editingCourseId);
      const slug = createCourseSlug(courseDraft.title);
      const nextCourse = normalizeManagedCourse({
        ...(existingCourse || {}),
        id: existingCourse?.id || `${slug}-${Date.now()}`,
        ...courseDraft,
        lessonsCount: Number(courseDraft.lessonsCount) || 1,
        price: normalizeVndAmount(courseDraft.price),
        status: 'published',
        publishedAt: existingCourse ? 'Vừa cập nhật' : 'Vừa đăng'
      });

      const savedCourseRecord = await saveCourseToSupabase(nextCourse, {
        teacherId: auth.user?.id || null,
        accessToken: auth.session?.access_token
      });
      const persistedSections = Array.isArray(savedCourseRecord?.sections)
        ? savedCourseRecord.sections
        : nextCourse.sections;
      const persistedLessonsCount = persistedSections.reduce(
        (count, section) => count + ((section.lessons || []).length),
        0
      );
      const persistedCourse = {
        ...nextCourse,
        databaseId: savedCourseRecord?.id || nextCourse.databaseId || nextCourse.id,
        id: savedCourseRecord?.slug || nextCourse.id,
        slug: savedCourseRecord?.slug || nextCourse.slug,
        title: savedCourseRecord?.title || nextCourse.title,
        summary: savedCourseRecord?.description || nextCourse.summary,
        priceValue: Number(savedCourseRecord?.price ?? nextCourse.priceValue ?? 0),
        price: formatVnd(Number(savedCourseRecord?.price ?? nextCourse.priceValue ?? 0)),
        status: savedCourseRecord?.status || nextCourse.status,
        instructor: auth.user?.user_metadata?.full_name || nextCourse.instructor,
        lessonsCount: persistedLessonsCount || nextCourse.lessonsCount,
        sections: persistedSections
      };

      const nextCourses = existingCourse
        ? teacherCourses.map((course) => (course.id === existingCourse.id ? persistedCourse : course))
        : [persistedCourse, ...teacherCourses];
      persistCourses(nextCourses);
      if (existingCourse) {
        setCourseDraft((previous) => ({
          ...previous,
          lessonsCount: String(persistedCourse.lessonsCount)
        }));
        setMessage({ type: 'success', text: `Đã cập nhật khóa học "${persistedCourse.title}" thành công.` });
      } else {
        setCourseDraft(createEmptyCourseDraft());
        setManualLessonDraft({ sectionTitle: 'Nội dung chính', lessonsText: '' });
        setImportDriveLink('');
        setImportMessage({ type: '', text: '' });
        setSelectedDraftLessonId('');
        setStudentPreviewLessonId('');
        setMessage({ type: 'success', text: `Đã đăng khóa học "${persistedCourse.title}" thành công.` });
      }
      setCoursePublisherOpen(false);
    } catch (error) {
      console.error('[handlePublishCourse]', error);
      setMessage({ type: 'error', text: error?.message || 'Không thể lưu khóa học vào Supabase.' });
    } finally {
      setSaving(false);
    }
  }

  function toggleCourseStatus(courseId) {
    const nextCourses = teacherCourses.map((course) =>
      course.id === courseId
        ? { ...course, status: course.status === 'published' ? 'hidden' : 'published' }
        : course
    );
    persistCourses(nextCourses);
  }

  function deleteTeacherCourse(courseId) {
    const course = teacherCourses.find((item) => item.id === courseId);
    if (!course) return;

    const confirmed = window.confirm(`Xóa khóa học "${course.title}"? Hành động này sẽ gỡ khóa khỏi danh sách giảng viên.`);
    if (!confirmed) return;

    const nextCourses = teacherCourses.filter((item) => item.id !== courseId);
    persistCourses(nextCourses);
    if (editingCourseId === courseId) {
      resetCourseDraft();
    }
    if (expandedCourseId === courseId) {
      setExpandedCourseId('');
    }
    setMessage({ type: 'success', text: `Đã xóa khóa học "${course.title}".` });
  }

  return (
    <DashboardShell
      title="Bảng điều khiển giảng viên"
      description="Đăng khóa học, theo dõi học sinh đang học từng khóa, tiến độ hoàn thành và hiệu quả học tập."
      metrics={metrics}
    >
      <section className="section teacher-course-dashboard">
        <div className="teacher-console-layout">
          <aside className="content-card content-card--enterprise teacher-console-rail">
            <div className="teacher-console-identity">
              <strong>Admin Hub</strong>
              <span>Giảng viên khóa học</span>
            </div>

            <button type="button" className="button teacher-console-primary" onClick={openCoursePublisherForNew}>
              Đăng khóa học mới
            </button>

            {coursePublisherOpen ? (
              <button type="button" className="button-ghost teacher-console-secondary" onClick={() => setCoursePublisherOpen(false)}>
                Ẩn form
              </button>
            ) : null}

            {message.text && !coursePublisherOpen ? (
              <div className={`auth-message teacher-action-feedback ${message.type === 'success' ? 'auth-message--success' : ''}`}>
                {message.text}
              </div>
            ) : null}

            <nav className="teacher-console-nav" aria-label="Teacher dashboard">
              <button type="button" className="is-active">
                Dashboard
              </button>
              <button
                type="button"
                className={activeCoursesOpen ? 'is-active' : ''}
                onClick={() => setActiveCoursesOpen((isOpen) => !isOpen)}
                aria-expanded={activeCoursesOpen}
              >
                Active Courses
              </button>
              <button type="button">Curriculum</button>
              <button type="button">Analytics</button>
              <button type="button">Settings</button>
            </nav>
          </aside>

          <div className="teacher-console-main">
          {activeCoursesOpen ? (
          <div className="content-card content-card--enterprise teacher-course-overview teacher-course-overview--compact">
            <div className="section-head teacher-course-overview__head">
              <div>
                <span className="eyebrow">Khóa đã đăng</span>
                <h2>Khóa đang vận hành</h2>
              </div>
              <span className="pill">{publishedCount} công khai</span>
            </div>

            <div className="teacher-course-list">
              {courseStatsPagination.pageItems.length ? courseStatsPagination.pageItems.map((course) => {
                const isExpanded = expandedCourseId === course.id;

                return (
                  <button
                    key={course.id}
                    type="button"
                    className={`teacher-course-chip ${isExpanded ? 'is-active' : ''}`}
                    onClick={() => setExpandedCourseId((currentId) => (currentId === course.id ? '' : course.id))}
                    aria-expanded={isExpanded}
                  >
                    <span>{course.category}</span>
                    <strong>{course.title}</strong>
                    <small>
                      {course.status === 'published' ? 'Công khai' : 'Đang ẩn'} · {course.lessonsCount} bài
                    </small>
                  </button>
                );
              }) : (
                <p className="empty-state">Chưa có khóa học nào. Bấm “Đăng khóa học mới” để tạo khóa đầu tiên.</p>
              )}
            </div>

            {expandedCourse ? (
              <article className="teacher-course-detail-row">
                <div className="teacher-course-detail-row__main">
                  <span className="eyebrow">{expandedCourse.category}</span>
                  <h3>{expandedCourse.title}</h3>
                  <p>{expandedCourse.summary || 'Khóa học chưa có mô tả.'}</p>
                </div>

                <div className="teacher-course-detail-row__meta">
                  <span>{expandedCourse.level}</span>
                  <span>{expandedCourse.duration}</span>
                  <span>{expandedCourse.price}</span>
                  <span>{expandedCourse.studentsCount} học sinh</span>
                  <span>{expandedCourse.averageProgress}% tiến độ</span>
                  <span>{expandedCourse.averageScore}% hiệu quả</span>
                </div>

                <div className="teacher-course-detail-row__actions">
                  <button type="button" className="button-ghost" onClick={() => loadCourseForEditing(expandedCourse.id)}>
                    Sửa khóa
                  </button>
                  <Link className="button-ghost" to={`/student-progress?course=${encodeURIComponent(expandedCourse.id)}`}>
                    Xem tiến độ
                  </Link>
                  <button type="button" className="button-ghost" onClick={() => toggleCourseStatus(expandedCourse.id)}>
                    {expandedCourse.status === 'published' ? 'Ẩn khóa' : 'Mở lại'}
                  </button>
                  <button type="button" className="button-ghost danger" onClick={() => deleteTeacherCourse(expandedCourse.id)}>
                  Xóa khóa
                </button>
              </div>
            </article>
            ) : null}

            <PaginationControls {...courseStatsPagination} label="khóa học" />
          </div>
          ) : null}

        {coursePublisherOpen ? (
        <form
          className={`content-card content-card--enterprise dashboard-form teacher-course-publisher ${activeCoursesOpen ? 'teacher-course-publisher--with-course-panel' : ''}`}
          onSubmit={handlePublishCourse}
        >
          <div className="section-head">
            <div>
              <span className="eyebrow">Quản lý khóa học</span>
              <h2>{editingCourseId ? 'Chỉnh sửa khóa học' : 'Đăng khóa học mới'}</h2>
            </div>
            <div className="teacher-course-form-actions">
              <span className="pill">{loading ? 'Đang tải' : `${teacherCourses.length} khóa`}</span>
              <button type="button" className="button-ghost" onClick={() => setCoursePublisherOpen(false)}>
                Ẩn form
              </button>
            </div>
          </div>

          {teacherCourses.length ? (
            <div className="teacher-edit-bar">
              <label>
                <span>Khóa đang sửa</span>
                <select value={editingCourseId} onChange={(event) => loadCourseForEditing(event.target.value)}>
                  <option value="">Tạo khóa mới</option>
                  {teacherCourses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="button-ghost" onClick={resetCourseDraft}>
                Tạo mới
              </button>
            </div>
          ) : null}

          <div className="import-stepper">
            {importSteps.map((step) => (
              <span key={step.label} className={step.done ? 'import-step is-done' : 'import-step'}>
                {step.label}
                {step.optional ? ' nếu có' : ''}
              </span>
            ))}
          </div>

          <div className="dashboard-form__grid">
            <label className="auth-field">
              <span>Tên khóa học</span>
              <input
                value={courseDraft.title}
                onChange={(event) => updateDraft('title', event.target.value)}
                placeholder="Ví dụ: Tiếng Anh giao tiếp nền tảng"
              />
            </label>

            <label className="auth-field">
              <span>Nhóm nội dung</span>
              <select value={courseDraft.category} onChange={(event) => updateDraft('category', event.target.value)}>
                <option>Kỹ năng cốt lõi</option>
                <option>Giao tiếp</option>
                <option>Công sở</option>
                <option>Luyện thi</option>
              </select>
            </label>

            <label className="auth-field">
              <span>Trình độ</span>
              <select value={courseDraft.level} onChange={(event) => updateDraft('level', event.target.value)}>
                <option>Nền tảng</option>
                <option>Trung cấp</option>
                <option>Nâng cao</option>
              </select>
            </label>

            <label className="auth-field">
              <span>Thời lượng</span>
              <input
                value={courseDraft.duration}
                onChange={(event) => updateDraft('duration', event.target.value)}
                placeholder="6 tuần"
              />
            </label>

            <label className="auth-field">
              <span>Số bài học</span>
              <input
                type="number"
                min="1"
                value={courseDraft.lessonsCount}
                onChange={(event) => updateDraft('lessonsCount', event.target.value)}
              />
            </label>

            <label className="auth-field">
              <span>Giá bán VND</span>
              <input
                type="number"
                min="0"
                step="10000"
                value={courseDraft.price}
                onChange={(event) => updateDraft('price', event.target.value)}
              />
            </label>

            <label className="auth-field auth-field--full">
              <span>Mô tả khóa học</span>
              <textarea
                rows="4"
                value={courseDraft.summary}
                onChange={(event) => updateDraft('summary', event.target.value)}
                placeholder="Mục tiêu, lộ trình và kết quả học viên đạt được sau khóa..."
              />
            </label>

            <label className="auth-field auth-field--full">
              <span>Ảnh đại diện (Banner)</span>
              <input
                type="file"
                accept="image/jpeg, image/png, image/webp, image/gif"
                onChange={handleBannerChange}
                disabled={uploadingBanner}
              />
              {uploadingBanner && <span className="upload-progress">Đang tải ảnh lên...</span>}
              {bannerUploadError && <span className="error-message" style={{ color: 'var(--error)' }}>{bannerUploadError}</span>}
              {courseDraft.bannerUrl && (
                <div style={{ marginTop: '0.5rem' }}>
                  <img src={courseDraft.bannerUrl} alt="Banner Preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: 'var(--radius)' }} />
                </div>
              )}
            </label>

            <div className="auth-field auth-field--full">
              <span>Cách tạo nội dung</span>
              <div className="course-source-selector" role="radiogroup" aria-label="Cách tạo khóa học">
                {[
                  { id: 'drive', label: 'Google Drive' },
                  { id: 'excel', label: 'Excel' },
                  { id: 'manual', label: 'Nhập thủ công' }
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`answer-pill marketplace-filter-pill ${courseInputMode === option.id ? 'is-active' : ''}`}
                    onClick={() => {
                      setCourseInputMode(option.id);
                      setImportMessage({ type: '', text: '' });
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {courseInputMode === 'excel' ? (
              <label className="auth-field auth-field--full">
                <span>Nhập khóa học bằng Excel</span>
                <input
                  type="file"
                  accept=".xls,.xlsx"
                  onChange={(event) => handleImportFile(event.target.files?.[0])}
                />
                <small className="field-hint">Mỗi dòng Excel sẽ được tự động tạo thành một bài học để giảng viên xem trước.</small>
              </label>
            ) : null}

            {courseInputMode === 'drive' ? (
              <label className="auth-field auth-field--full">
                <span>Danh sách video Google Drive</span>
                <div className="field-with-button">
                  <textarea
                    rows="5"
                    value={importDriveLink}
                    onChange={(event) => setImportDriveLink(event.target.value)}
                    placeholder={'Bài 1 | https://drive.google.com/file/d/.../view\nBài 2 | https://drive.google.com/file/d/.../view'}
                  />
                  <button type="button" className="button-ghost" onClick={handleImportDriveLink}>
                    Tạo bài video
                  </button>
                </div>
                <small className="field-hint">
                  Mỗi dòng tạo một bài. Dùng link file video /file/d/.../view và mở quyền Drive: Anyone with the link / Viewer.
                </small>
              </label>
            ) : null}

            {courseInputMode === 'manual' ? (
              <div className="auth-field auth-field--full">
                <span>Nhập bài học thủ công</span>
                <input
                  value={manualLessonDraft.sectionTitle}
                  onChange={(event) => setManualLessonDraft((previous) => ({ ...previous, sectionTitle: event.target.value }))}
                  placeholder="Tên chương"
                />
                <textarea
                  rows="5"
                  value={manualLessonDraft.lessonsText}
                  onChange={(event) => setManualLessonDraft((previous) => ({ ...previous, lessonsText: event.target.value }))}
                  placeholder={'Bài 1. Giới thiệu\nBài 2. Luyện tập\nBài 3. Kiểm tra'}
                />
                <button type="button" className="button-ghost" onClick={handleCreateManualLessons}>
                  Tạo bài học
                </button>
              </div>
            ) : null}
          </div>

          {importMessage.text ? (
            <div className={`auth-message ${importMessage.type === 'success' ? 'auth-message--success' : importMessage.type === 'error' ? 'auth-message--error' : 'auth-message--info'}`}>
              {importMessage.text}
            </div>
          ) : null}

          {courseDraft.sections.length ? (
            <div className="course-import-preview">
              <div className="section-head">
                <div>
                  <span className="eyebrow">Confirm nội dung</span>
                  <h3>Xem, sửa và kiểm tra bài học trước khi đăng</h3>
                </div>
                <span className="pill">
                  {draftLessons.length} bài · {getCourseQuestionCount(courseDraft.sections)} câu
                </span>
              </div>

              <div className="lesson-import-workbench">
                <div className="import-lesson-strip">
                  {draftLessons.map((lesson) => {
                    const lessonKey = getDraftLessonKey(lesson);
                    return (
                      <article
                        key={lessonKey}
                        className={lessonKey === selectedDraftLessonId ? 'import-lesson-pill is-active' : 'import-lesson-pill'}
                      >
                        <button
                          type="button"
                          className="import-lesson-pill__main"
                          onClick={() => setSelectedDraftLessonId(lessonKey)}
                        >
                          <span>{lesson.lessonNumber ? `Bài ${lesson.lessonNumber}` : 'Bài học'}</span>
                          <strong>{lesson.title || lesson.attachmentName || 'Bài học mới'}</strong>
                          <small>
                            {[lesson.videoUrl ? 'Có video' : 'Chưa có video', lesson.exerciseType, lesson.questionCount ? `${lesson.questionCount} câu` : '', lesson.audioName ? 'Có audio' : '', lesson.imageName ? 'Có ảnh' : ''].filter(Boolean).join(' · ')}
                          </small>
                        </button>
                        <button
                          type="button"
                          className="button-ghost"
                          onClick={() => {
                            setSelectedDraftLessonId(lessonKey);
                            setStudentPreviewLessonId(lessonKey);
                          }}
                        >
                          Student view
                        </button>
                      </article>
                    );
                  })}
                </div>

                <div className="import-lesson-strip-actions">
                  <button
                    type="button"
                    className="button-ghost"
                    disabled={!draftLessons.length}
                    onClick={() => {
                      const lastLesson = draftLessons[draftLessons.length - 1];
                      if (lastLesson) {
                        addDraftLessonAfter(lastLesson.sectionIndex, lastLesson.lessonIndex);
                      }
                    }}
                  >
                    + Thêm bài mới vào cuối khóa
                  </button>
                </div>

                {selectedDraftLesson ? (
                  <div className="lesson-edit-panel">
                    <div className="section-head">
                      <div>
                        <span className="eyebrow">Sửa bài học</span>
                        <h3>{selectedDraftLesson.title || 'Bài học mới'}</h3>
                      </div>
                      <div className="lesson-edit-panel__actions">
                        <button
                          type="button"
                          className="button-ghost"
                          disabled={!selectedDraftLessonCanMoveUp}
                          onClick={() => moveDraftLesson(selectedDraftLesson.sectionIndex, selectedDraftLesson.lessonIndex, -1)}
                        >
                          Lên
                        </button>
                        <button
                          type="button"
                          className="button-ghost"
                          disabled={!selectedDraftLessonCanMoveDown}
                          onClick={() => moveDraftLesson(selectedDraftLesson.sectionIndex, selectedDraftLesson.lessonIndex, 1)}
                        >
                          Xuống
                        </button>
                        <button
                          type="button"
                          className="button-ghost"
                          onClick={() => addDraftLessonAfter(selectedDraftLesson.sectionIndex, selectedDraftLesson.lessonIndex)}
                        >
                          Thêm bài sau
                        </button>
                        <span className="pill">{selectedDraftLesson.sectionTitle}</span>
                      </div>
                    </div>

                    <div className="dashboard-form__grid">
                      <label className="auth-field">
                        <span>Tên bài</span>
                        <input
                          value={selectedDraftLesson.title || ''}
                          onChange={(event) =>
                            updateDraftLesson(selectedDraftLesson.sectionIndex, selectedDraftLesson.lessonIndex, {
                              title: event.target.value
                            })
                          }
                        />
                      </label>

                      <label className="auth-field">
                        <span>Dạng bài</span>
                        <input
                          value={selectedDraftLesson.exerciseType || ''}
                          onChange={(event) =>
                            updateDraftLesson(selectedDraftLesson.sectionIndex, selectedDraftLesson.lessonIndex, {
                              exerciseType: event.target.value
                            })
                          }
                        />
                      </label>

                      <label className="auth-field auth-field--full">
                        <span>Ghi chú bài học</span>
                        <textarea
                          rows="2"
                          value={selectedDraftLesson.note || ''}
                          onChange={(event) =>
                            updateDraftLesson(selectedDraftLesson.sectionIndex, selectedDraftLesson.lessonIndex, {
                              note: event.target.value
                            })
                          }
                        />
                      </label>

                      <label className="auth-field auth-field--full">
                        <span>Video bài học từ Google Drive</span>
                        <input
                          value={selectedDraftLesson.videoUrl || ''}
                          onChange={(event) =>
                            updateDraftLesson(selectedDraftLesson.sectionIndex, selectedDraftLesson.lessonIndex, {
                              videoUrl: event.target.value,
                              videoEmbedUrl: getEmbeddableVideoUrl(event.target.value),
                              videoTitle: selectedDraftLesson.videoTitle || selectedDraftLesson.title || `Bài ${selectedDraftLesson.lessonNumber || ''}`.trim()
                            })
                          }
                          placeholder="Dán link share Google Drive của video bài học"
                        />
                        <small className="field-hint">
                          {selectedDraftLesson.videoUrl
                            ? getVideoEmbedIssue(selectedDraftLesson.videoUrl) ||
                              getVideoAccessHint(selectedDraftLesson.videoUrl) ||
                              `${getVideoSourceLabel(selectedDraftLesson.videoUrl)} · học viên sẽ xem video này trước bài tập.`
                            : 'Chưa có video cho bài này.'}
                        </small>
                      </label>

                      <label className="auth-field">
                        <span>File nghe nếu có</span>
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={(event) =>
                            handleDraftLessonAsset(
                              selectedDraftLesson.sectionIndex,
                              selectedDraftLesson.lessonIndex,
                              'audio',
                              event.target.files?.[0]
                            )
                          }
                        />
                        <small className="field-hint">{selectedDraftLesson.audioName || 'Chưa thêm file nghe'}</small>
                      </label>

                      <label className="auth-field">
                        <span>Ảnh nếu có</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) =>
                            handleDraftLessonAsset(
                              selectedDraftLesson.sectionIndex,
                              selectedDraftLesson.lessonIndex,
                              'image',
                              event.target.files?.[0]
                            )
                          }
                        />
                        <small className="field-hint">{selectedDraftLesson.imageName || 'Chưa thêm ảnh'}</small>
                      </label>
                    </div>

                    <div className="lesson-question-editor">
                      <div className="lesson-question-editor__toolbar">
                        <div>
                          <span className="eyebrow">Bài vận dụng dưới video</span>
                          <strong>
                            {(Array.isArray(selectedDraftLesson.exercises) ? selectedDraftLesson.exercises : selectedDraftLesson.questions || []).length} câu
                          </strong>
                        </div>
                        <div className="lesson-question-editor__actions">
                          <label className="button-ghost video-question-file-button">
                            Nhập Excel
                            <input
                              type="file"
                              accept=".xls,.xlsx"
                              onChange={(event) => {
                                void handleDraftLessonQuestionFile(
                                  selectedDraftLesson.sectionIndex,
                                  selectedDraftLesson.lessonIndex,
                                  event.target.files?.[0]
                                );
                                event.target.value = '';
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className="button-ghost"
                            onClick={() => addDraftLessonQuestion(selectedDraftLesson.sectionIndex, selectedDraftLesson.lessonIndex)}
                          >
                            Thêm thủ công
                          </button>
                        </div>
                      </div>

                      {(Array.isArray(selectedDraftLesson.exercises) ? selectedDraftLesson.exercises : selectedDraftLesson.questions || []).map(
                        (question, questionIndex) => (
                          <article key={question.id || `${selectedDraftLesson.id}-q-${questionIndex}`} className="lesson-question-editor__item">
                            <div className="lesson-question-editor__head">
                              <strong>Câu {question.number || questionIndex + 1}</strong>
                              <label>
                                <span>Đáp án đúng</span>
                                <select
                                  value={question.correctAnswer || question.answer || ''}
                                  onChange={(event) =>
                                    updateDraftQuestion(selectedDraftLesson.sectionIndex, selectedDraftLesson.lessonIndex, questionIndex, {
                                      answer: event.target.value,
                                      correctAnswer: event.target.value
                                    })
                                  }
                                >
                                  <option value="">Chọn đáp án</option>
                                  {(question.options || []).map((option) => (
                                    <option key={option.label} value={option.label}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <button
                                type="button"
                                className="button-ghost video-question-card__delete"
                                onClick={() =>
                                  deleteDraftQuestion(
                                    selectedDraftLesson.sectionIndex,
                                    selectedDraftLesson.lessonIndex,
                                    questionIndex
                                  )
                                }
                              >
                                Xóa câu
                              </button>
                            </div>

                            <label className="auth-field auth-field--full">
                              <span>Nội dung câu</span>
                              <input
                                value={question.prompt || ''}
                                onChange={(event) =>
                                  updateDraftQuestion(selectedDraftLesson.sectionIndex, selectedDraftLesson.lessonIndex, questionIndex, {
                                    prompt: event.target.value
                                  })
                                }
                              />
                            </label>

                            <div className="question-option-editor">
                              {(question.options || []).map((option, optionIndex) => (
                                <label key={`${question.id}-${option.label}`} className="auth-field">
                                  <span>Lựa chọn {option.label}</span>
                                  <input
                                    value={option.text || ''}
                                    onChange={(event) =>
                                      updateDraftQuestionOption(
                                        selectedDraftLesson.sectionIndex,
                                        selectedDraftLesson.lessonIndex,
                                        questionIndex,
                                        optionIndex,
                                        event.target.value
                                      )
                                    }
                                  />
                                </label>
                              ))}
                            </div>

                            {(question.options || []).length < 4 ? (
                              <button
                                type="button"
                                className="button-ghost"
                                onClick={() => {
                                  const nextLabel = ['A', 'B', 'C', 'D'][(question.options || []).length];
                                  updateDraftQuestion(selectedDraftLesson.sectionIndex, selectedDraftLesson.lessonIndex, questionIndex, {
                                    options: [...(question.options || []), { label: nextLabel, text: '' }]
                                  });
                                }}
                              >
                                Thêm lựa chọn
                              </button>
                            ) : null}

                            <label className="auth-field auth-field--full">
                              <span>Ghi chú</span>
                              <input
                                value={question.note || ''}
                                onChange={(event) =>
                                  updateDraftQuestion(selectedDraftLesson.sectionIndex, selectedDraftLesson.lessonIndex, questionIndex, {
                                    note: event.target.value
                                  })
                                }
                              />
                            </label>
                          </article>
                        )
                      )}

                      {!(Array.isArray(selectedDraftLesson.exercises) ? selectedDraftLesson.exercises : selectedDraftLesson.questions || []).length ? (
                        <p className="empty-state">Bài này chưa có câu hỏi. Bạn có thể đăng bài dạng tài liệu hoặc nhập lại Excel có câu hỏi.</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              {studentPreviewLesson ? (
                <LessonStudentViewPreview lesson={studentPreviewLesson} />
              ) : null}
            </div>
          ) : null}

          <button type="submit" className="button dashboard-submit" disabled={saving}>
            {saving ? 'Đang lưu...' : editingCourseId ? 'Cập nhật khóa học' : 'Confirm và đăng bài'}
          </button>

          {message.text ? (
            <div className={`auth-message teacher-submit-feedback ${message.type === 'success' ? 'auth-message--success' : ''}`}>
              {message.text}
            </div>
          ) : null}
        </form>
        ) : null}

          </div>
        </div>
      </section>
    </DashboardShell>
  );
}

const emptyProfileDraft = {
  id: '',
  fullName: '',
  email: '',
  phone: '',
  role: 'student',
  avatarUrl: '',
  source: 'local'
};

const emptyCourseDraft = {
  id: '',
  databaseId: '',
  slug: '',
  title: '',
  description: '',
  price: '490000',
  status: 'published',
  teacherId: '',
  bannerUrl: '',
  source: ''
};

const emptyLessonDraft = {
  id: '',
  databaseId: '',
  courseId: '',
  chapterId: '',
  title: '',
  content: '',
  videoUrl: '',
  position: '1',
  isPreview: false,
  source: ''
};

const permissionLabels = {
  viewLearning: 'Xem phòng học',
  manageOwnProgress: 'Lưu tiến độ cá nhân',
  manageUsers: 'Quản lý học viên',
  manageCourses: 'Quản lý khóa học',
  manageLessons: 'Quản lý bài học',
  manageTeachers: 'Quản lý giảng viên',
  manageSystem: 'Quyền hệ thống'
};

const adminRoleLabels = {
  student: 'Học viên',
  teacher: 'Giảng viên',
  admin: 'Quản trị'
};

const paymentStatusLabels = {
  pending_payment: 'Chờ chuyển khoản',
  pending: 'Chờ chuyển khoản',
  awaiting_admin: 'Chờ admin mở khóa',
  paid: 'Đã mở khóa',
  failed: 'Thất bại',
  cancelled: 'Đã hủy'
};

function formatMoney(value) {
  return formatVnd(value);
}

function getCourseKey(course) {
  return course.databaseId || course.id;
}

function getCourseTitle(courseLookup, courseId) {
  return courseLookup.get(courseId)?.title || courseLookup.get(String(courseId || '').toLowerCase())?.title || 'Chưa gắn khóa';
}

function AdminDataTable({ columns, rows, emptyText, renderRow, pageSize = 8, paginationLabel = 'mục' }) {
  const pagination = usePagination(rows, {
    pageSize,
    resetKey: rows.length
  });

  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? pagination.pageItems.map(renderRow) : (
              <tr>
                <td colSpan={columns.length}>{emptyText}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls {...pagination} label={paginationLabel} />
    </>
  );
}

export function AdminDashboardPage() {
  usePageTitle('Quản trị hệ thống');
  const auth = useAuth();
  const [adminData, setAdminData] = useState({
    profiles: [],
    courses: [],
    lessons: [],
    orders: [],
    progress: [],
    assignments: [],
    rolePermissions: defaultRolePermissions,
    mode: 'local'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [profileDraft, setProfileDraft] = useState(emptyProfileDraft);
  const [courseDraft, setCourseDraft] = useState(emptyCourseDraft);
  const [lessonDraft, setLessonDraft] = useState(emptyLessonDraft);
  const [permissionDraft, setPermissionDraft] = useState(defaultRolePermissions);
  const [uploadingCourseBanner, setUploadingCourseBanner] = useState(false);
  const [courseBannerError, setCourseBannerError] = useState('');

  // ── New feature state ──────────────────────────────────
  const [adminTab, setAdminTab] = useState('overview'); // 'overview' | 'users' | 'activity'
  const [usersWithOrders, setUsersWithOrders] = useState({ profiles: [], orders: [] });
  const [userFilter, setUserFilter] = useState('all'); // 'all' | 'purchased' | 'not_purchased'
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityFilter, setActivityFilter] = useState('');
  const videoUploadRef = useRef(null);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [videoUploading, setVideoUploading] = useState(false);

  async function reloadAdminData() {
    setLoading(true);
    const [nextData, nextUsers] = await Promise.all([
      getAdminDashboardData(),
      getUsersWithPurchaseInfo(),
    ]);
    setAdminData(nextData);
    setPermissionDraft(nextData.rolePermissions);
    setUsersWithOrders(nextUsers);
    setLoading(false);
  }

  async function loadActivityLogs() {
    setActivityLoading(true);
    const logs = await getActivityLogs(null, { limit: 200 });
    setActivityLogs(logs);
    setActivityLoading(false);
  }

  useEffect(() => {
    void reloadAdminData();
  }, []);

  useEffect(() => {
    if (adminTab === 'activity') void loadActivityLogs();
  }, [adminTab]);

  const profiles = adminData.profiles;
  const students = profiles.filter((profile) => profile.role === 'student');
  const teachers = profiles.filter((profile) => profile.role === 'teacher');
  const admins = profiles.filter((profile) => profile.role === 'admin');

  const profileLookup = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles]
  );

  const courseLookup = useMemo(() => {
    const lookup = new Map();
    adminData.courses.forEach((course) => {
      lookup.set(course.id, course);
      lookup.set(course.databaseId, course);
      lookup.set(String(course.id || '').toLowerCase(), course);
      lookup.set(String(course.databaseId || '').toLowerCase(), course);
    });
    return lookup;
  }, [adminData.courses]);

  const lessonsByCourse = useMemo(() => {
    const lookup = new Map();

    adminData.lessons.forEach((lesson) => {
      const courseId = lesson.courseId || '';
      const bucket = lookup.get(courseId) || [];
      bucket.push(lesson);
      lookup.set(courseId, bucket);
    });

    lookup.forEach((lessons) => {
      lessons.sort((left, right) => {
        const positionDiff = Number(left.position || 0) - Number(right.position || 0);
        if (positionDiff) return positionDiff;
        return String(left.title || '').localeCompare(String(right.title || ''), 'vi');
      });
    });

    return lookup;
  }, [adminData.lessons]);

  const lessonRows = useMemo(() => {
    return [...adminData.lessons].sort((left, right) => {
      const courseDiff = String(left.courseId || '').localeCompare(String(right.courseId || ''), 'vi');
      if (courseDiff) return courseDiff;

      const positionDiff = Number(left.position || 0) - Number(right.position || 0);
      if (positionDiff) return positionDiff;

      return String(left.title || '').localeCompare(String(right.title || ''), 'vi');
    });
  }, [adminData.lessons]);

  const paidOrders = adminData.orders.filter((order) => order.status === 'paid');
  const paymentReviewOrders = adminData.orders.filter((order) =>
    ['pending_payment', 'pending', 'awaiting_admin', 'paid'].includes(order.status)
  );
  const revenue = paidOrders.reduce((total, order) => total + Number(order.amount || 0), 0);

  const metrics = useMemo(
    () => [
      { label: 'Người dùng', value: String(profiles.length) },
      { label: 'Giảng viên', value: String(teachers.length) },
      { label: 'Học viên', value: String(students.length) },
      { label: 'Khóa / Bài', value: `${adminData.courses.length}/${adminData.lessons.length}` }
    ],
    [adminData.courses.length, adminData.lessons.length, profiles.length, students.length, teachers.length]
  );

  const teacherSummary = useMemo(
    () =>
      teachers.map((teacher) => {
        const teacherCourses = adminData.courses.filter((course) => course.teacherId === teacher.id);
        const teacherAssignments = adminData.assignments.filter((assignment) => assignment.teacher_id === teacher.id);
        return {
          ...teacher,
          coursesCount: teacherCourses.length,
          assignmentsCount: teacherAssignments.length,
          publishedCount: teacherCourses.filter((course) => course.status === 'published').length
        };
      }),
    [adminData.assignments, adminData.courses, teachers]
  );

  const studentSummary = useMemo(
    () =>
      students.map((student) => {
        const studentOrders = adminData.orders.filter((order) => order.userId === student.id);
        const completedLessons = adminData.progress.filter((item) => item.userId === student.id && item.completed);
        return {
          ...student,
          ordersCount: studentOrders.length,
          paidCourses: studentOrders.filter((order) => order.status === 'paid').length,
          completedLessons: completedLessons.length
        };
      }),
    [adminData.orders, adminData.progress, students]
  );
  const filteredUsers = useMemo(
    () =>
      usersWithOrders.profiles.filter((user) => {
        const paidCount = usersWithOrders.orders.filter(
          (order) => order.userId === user.id && order.status === 'paid'
        ).length;

        if (userFilter === 'purchased') return paidCount > 0;
        if (userFilter === 'not_purchased') return paidCount === 0;
        if (['student', 'teacher', 'admin'].includes(userFilter)) return user.role === userFilter;
        return true;
      }),
    [userFilter, usersWithOrders.orders, usersWithOrders.profiles]
  );
  const usersPagination = usePagination(filteredUsers, {
    pageSize: 10,
    resetKey: `${userFilter}|${filteredUsers.length}`
  });
  const filteredActivityLogs = useMemo(
    () => activityLogs.filter((log) => !activityFilter || log.action === activityFilter),
    [activityFilter, activityLogs]
  );
  const activityPagination = usePagination(filteredActivityLogs, {
    pageSize: 10,
    resetKey: `${activityFilter}|${filteredActivityLogs.length}`
  });

  function getNextLessonPosition(courseId, excludeLessonId = '') {
    const courseLessons = lessonsByCourse.get(courseId || '') || [];
    return (
      courseLessons.reduce((maxPosition, lesson) => {
        if (excludeLessonId && (lesson.id === excludeLessonId || lesson.databaseId === excludeLessonId)) {
          return maxPosition;
        }

        const lessonPosition = Number(lesson.position || 0);
        return lessonPosition > maxPosition ? lessonPosition : maxPosition;
      }, 0) + 1
    );
  }

  function updateProfileDraft(field, value) {
    setProfileDraft((previous) => ({ ...previous, [field]: value }));
  }

  function updateCourseDraft(field, value) {
    setCourseDraft((previous) => ({ ...previous, [field]: value }));
  }

  function updateLessonDraft(field, value) {
    setLessonDraft((previous) => {
      if (field === 'courseId') {
        return {
          ...previous,
          courseId: value,
          position: String(getNextLessonPosition(String(value || ''), previous.id || previous.databaseId || ''))
        };
      }

      return { ...previous, [field]: value };
    });
  }

  function resetProfileDraft() {
    setProfileDraft(emptyProfileDraft);
  }

  function resetCourseDraft() {
    setCourseDraft(emptyCourseDraft);
    setCourseBannerError('');
    setUploadingCourseBanner(false);
  }

  function resetLessonDraft() {
    const defaultCourseId = getCourseKey(adminData.courses[0] || {}) || '';
    setLessonDraft({
      ...emptyLessonDraft,
      courseId: defaultCourseId,
      position: String(getNextLessonPosition(defaultCourseId))
    });
  }

  async function handleShiftLessonPosition(lesson, direction) {
    const courseLessons = lessonsByCourse.get(lesson.courseId || '') || [];
    const currentIndex = courseLessons.findIndex((item) => item.id === lesson.id && item.databaseId === lesson.databaseId);
    const targetIndex = currentIndex + direction;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= courseLessons.length) {
      return;
    }

    const targetLesson = courseLessons[targetIndex];

    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      await saveAdminLesson({ ...lesson, position: Number(targetLesson.position || 0) });
      await saveAdminLesson({ ...targetLesson, position: Number(lesson.position || 0) });
      await reloadAdminData();
      setMessage({ type: 'success', text: 'Đã đổi vị trí bài học.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Chưa thể đổi vị trí bài học.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      await saveAdminProfile(profileDraft);
      await reloadAdminData();
      resetProfileDraft();
      setMessage({ type: 'success', text: 'Đã lưu hồ sơ người dùng.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Chưa thể lưu hồ sơ người dùng.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProfile(profile) {
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      await deleteAdminProfile(profile.id);
      await reloadAdminData();
      setMessage({ type: 'success', text: `Đã xóa hồ sơ ${profile.fullName}.` });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Chưa thể xóa hồ sơ.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveCourse(event) {
    event.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      await saveAdminCourse({
        ...courseDraft,
        price: normalizeVndAmount(courseDraft.price)
      });
      await reloadAdminData();
      resetCourseDraft();
      setMessage({ type: 'success', text: 'Đã lưu khóa học.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Chưa thể lưu khóa học.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleCourseBannerChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const errorMessage = validateImageFile(file);
    if (errorMessage) {
      setCourseBannerError(errorMessage);
      return;
    }

    setCourseBannerError('');
    setUploadingCourseBanner(true);

    try {
      const result = await uploadCourseImage(file, courseDraft.id || courseDraft.slug || courseDraft.title || 'course');
      if (result?.url) {
        updateCourseDraft('bannerUrl', result.url);
      } else {
        setCourseBannerError('Không tải được ảnh lên. Hãy kiểm tra bucket "course-images" đã được tạo.');
      }
    } catch (error) {
      setCourseBannerError(error.message || 'Đã xảy ra lỗi khi tải ảnh.');
    } finally {
      setUploadingCourseBanner(false);
      event.target.value = '';
    }
  }

  async function handleDeleteCourse(course) {
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      await deleteAdminCourse(course);
      await reloadAdminData();
      setMessage({ type: 'success', text: `Đã xóa khóa ${course.title}.` });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Chưa thể xóa khóa học.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveLesson(event) {
    event.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      await saveAdminLesson({
        ...lessonDraft,
        position: Number(lessonDraft.position || 1)
      });
      await reloadAdminData();
      resetLessonDraft();
      setMessage({ type: 'success', text: 'Đã lưu bài học.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Chưa thể lưu bài học.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteLesson(lesson) {
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      await deleteAdminLesson(lesson);
      await reloadAdminData();
      setMessage({ type: 'success', text: `Đã xóa bài ${lesson.title}.` });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Chưa thể xóa bài học.' });
    } finally {
      setSaving(false);
    }
  }

  function updatePermission(role, permissionKey, checked) {
    setPermissionDraft((previous) =>
      previous.map((item) =>
        item.role === role
          ? {
              ...item,
              permissions: {
                ...item.permissions,
                [permissionKey]: checked
              }
            }
          : item
      )
    );
  }

  async function handleSavePermissions() {
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const nextPermissions = await saveRolePermissions(permissionDraft);
      setPermissionDraft(nextPermissions);
      await reloadAdminData();
      setMessage({ type: 'success', text: 'Đã cập nhật quyền hệ thống.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Chưa thể lưu quyền hệ thống.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleApprovePayment(order) {
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      await approvePaymentOrder(order, auth.session?.access_token);
      await reloadAdminData();
      setMessage({ type: 'success', text: `Đã mở khóa ${getCourseTitle(courseLookup, order.courseId)} cho học viên.` });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Chưa thể mở khóa đơn hàng.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleLessonVideoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = validateVideoFile(file);
    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      event.target.value = '';
      return;
    }

    const lessonKey = lessonDraft.databaseId || lessonDraft.id || `draft-${Date.now()}`;
    setVideoUploading(true);
    setVideoUploadProgress(0);
    setMessage({ type: '', text: '' });

    try {
      const result = await uploadLessonVideo(file, lessonKey, setVideoUploadProgress);
      if (!result?.url) {
        throw new Error('Không thể tải video lên. Kiểm tra bucket lesson-videos trên Supabase Storage.');
      }

      updateLessonDraft('videoUrl', result.url);
      setMessage({ type: 'success', text: 'Video đã được tải lên. Nhớ lưu bài học để giữ URL.' });
    } catch (uploadError) {
      setMessage({ type: 'error', text: uploadError.message || 'Tải video thất bại.' });
    } finally {
      setVideoUploading(false);
      setVideoUploadProgress(0);
      event.target.value = '';
    }
  }

  return (
    <DashboardShell
      title="Bảng điều khiển quản trị"
      description="Tổng hợp dữ liệu giảng viên, học viên, khóa học, bài học và quyền hệ thống trong một nơi."
      metrics={metrics}
    >
      {/* ── Tab Navigation ── */}
      <section className="section">
        <div className="admin-tabs-nav" role="tablist" aria-label="Điều hướng quản trị">
          {[
            { id: 'overview', label: '📊 Tổng quan' },
            { id: 'payments', label: '💳 Thanh toán' },
            { id: 'users', label: '👥 Người dùng' },
            { id: 'activity', label: '📋 Lịch sử hoạt động' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={adminTab === tab.id}
              className={`admin-tab-btn ${adminTab === tab.id ? 'is-active' : ''}`}
              onClick={() => setAdminTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {adminTab === 'payments' ? (
        <section className="content-card content-card--enterprise admin-panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">Duyệt thanh toán</span>
              <h2>Yêu cầu mở khóa sau chuyển khoản</h2>
            </div>
            <span className="pill">{paymentReviewOrders.length} đơn</span>
          </div>

          {message.text ? (
            <div className={`auth-message ${message.type === 'success' ? 'auth-message--success' : message.type === 'error' ? 'auth-message--error' : ''}`}>
              {message.text}
            </div>
          ) : null}

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Học viên</th>
                  <th>Khóa học</th>
                  <th>Số tiền</th>
                  <th>Nội dung CK</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {paymentReviewOrders.map((order) => {
                  const user = profileLookup.get(order.userId);
                  const course = courseLookup.get(order.courseId) || courseLookup.get(order.localCourseId);
                  const canApprove = ['pending', 'pending_payment', 'awaiting_admin'].includes(order.status);

                  return (
                    <tr key={order.id}>
                      <td>
                        <strong>{order.studentName || user?.fullName || 'Học viên'}</strong>
                        <span>{order.studentEmail || user?.email || order.userId}</span>
                      </td>
                      <td>{order.courseTitle || course?.title || order.courseId}</td>
                      <td>{formatMoney(order.amount)}</td>
                      <td>{order.transferCode || order.id}</td>
                      <td>
                        <span className={`pill ${order.status === 'paid' ? 'pill--success' : ''}`}>
                          {paymentStatusLabels[order.status] || order.status}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="button-ghost"
                          disabled={!canApprove || saving}
                          onClick={() => handleApprovePayment(order)}
                        >
                          {order.status === 'paid' ? 'Đã mở' : canApprove ? 'Mở khóa' : 'Chờ xác nhận'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {paymentReviewOrders.length === 0 ? (
                  <tr><td colSpan={6} className="empty-state">Chưa có yêu cầu thanh toán cần xử lý.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* ── Tab: Người dùng ── */}
      {adminTab === 'users' ? (
        <section className="content-card content-card--enterprise">
          <div className="section-head">
            <div>
              <span className="eyebrow">Quản lý người dùng</span>
              <h2>Thông tin đăng ký &amp; mua hàng</h2>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                className="text-control"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                style={{ padding: '0.4rem 0.75rem', borderRadius: '0.4rem' }}
              >
                <option value="all">Tất cả</option>
                <option value="purchased">Đã mua</option>
                <option value="not_purchased">Chưa mua</option>
                <option value="student">Học viên</option>
                <option value="teacher">Giảng viên</option>
                <option value="admin">Quản trị</option>
              </select>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => exportUsersToExcel(usersWithOrders.profiles, usersWithOrders.orders)}
                title="Xuất Excel danh sách người dùng"
              >
                ⬇ Xuất Excel
              </button>
            </div>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Họ tên</th>
                  <th>Email</th>
                  <th>SĐT</th>
                  <th>Vai trò</th>
                  <th>Ngày đăng ký</th>
                  <th>Đã mua</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {usersPagination.pageItems
                  .map((u) => {
                    const paidCourses = usersWithOrders.orders.filter(
                      (o) => o.userId === u.id && o.status === 'paid'
                    );
                    return (
                      <tr key={u.id}>
                        <td>{u.fullName || '—'}</td>
                        <td>{u.email}</td>
                        <td>{u.phone || '—'}</td>
                        <td><span className="pill">{u.role}</span></td>
                        <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '—'}</td>
                        <td>{paidCourses.length} khóa</td>
                        <td>
                          <span className={`pill ${paidCourses.length > 0 ? 'pill--success' : ''}`}>
                            {paidCourses.length > 0 ? 'Đã mua' : 'Chưa mua'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                {filteredUsers.length === 0 ? (
                  <tr><td colSpan={7} className="empty-state">Không có dữ liệu người dùng.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <PaginationControls {...usersPagination} label="người dùng" />
        </section>
      ) : null}

      {/* ── Tab: Lịch sử hoạt động ── */}
      {adminTab === 'activity' ? (
        <section className="content-card content-card--enterprise">
          <div className="section-head">
            <div>
              <span className="eyebrow">Theo dõi hành vi</span>
              <h2>Lịch sử hoạt động người dùng</h2>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                className="text-control"
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value)}
                style={{ padding: '0.4rem 0.75rem', borderRadius: '0.4rem' }}
              >
                <option value="">Tất cả hành động</option>
                <option value="login">Đăng nhập</option>
                <option value="signup">Đăng ký</option>
                <option value="view_lesson">Xem bài học</option>
                <option value="complete_lesson">Hoàn thành bài</option>
                <option value="complete_exercise">Làm bài tập</option>
                <option value="purchase">Mua khóa học</option>
              </select>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => loadActivityLogs()}
                disabled={activityLoading}
              >
                ↺ Làm mới
              </button>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => exportActivityToExcel(activityLogs, usersWithOrders.profiles)}
                title="Xuất Excel lịch sử hoạt động"
              >
                ⬇ Xuất Excel
              </button>
            </div>
          </div>

          {activityLoading ? <p>Đang tải lịch sử...</p> : null}

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Hành động</th>
                  <th>Nội dung</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {activityPagination.pageItems
                  .map((log) => {
                    const user = usersWithOrders.profiles.find((u) => u.id === log.user_id);
                    const actionLabel = {
                      login: 'Đăng nhập', logout: 'Đăng xuất', signup: 'Đăng ký',
                      view_lesson: 'Xem bài học', complete_lesson: 'Hoàn thành bài',
                      complete_exercise: 'Làm bài tập', purchase: 'Mua khóa học',
                      view_course: 'Xem khóa học',
                    }[log.action] || log.action;
                    return (
                      <tr key={log.id}>
                        <td>{user ? `${user.fullName} (${user.email})` : log.user_id?.slice(0, 8)}</td>
                        <td><span className="exercise-chip">{actionLabel}</span></td>
                        <td>{log.target_title || log.target_id || '—'}</td>
                        <td>{log.created_at ? new Date(log.created_at).toLocaleString('vi-VN') : '—'}</td>
                      </tr>
                    );
                  })}
                {filteredActivityLogs.length === 0 && !activityLoading ? (
                  <tr><td colSpan={4} className="empty-state">Chưa có lịch sử hoạt động.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <PaginationControls {...activityPagination} label="hoạt động" />
        </section>
      ) : null}

      {/* ── Tab: Tổng quan (original content) ── */}
      {adminTab === 'overview' ? (
      <>
      <section className="content-card content-card--enterprise admin-overview">
        <div className="section-head">
          <div>
            <span className="eyebrow">Trung tâm quản trị</span>
            <h2>Tổng quan vận hành</h2>
          </div>
          <span className="pill">
            {loading
              ? 'Đang tải'
              : adminData.mode === 'supabase'
                ? 'Supabase'
                : adminData.mode === 'supabase-partial'
                  ? 'Supabase partial'
                  : 'Local fallback'}
          </span>
        </div>

        {message.text ? (
          <div className={`auth-message ${message.type === 'success' ? 'auth-message--success' : ''}`}>
            {message.text}
          </div>
        ) : null}

        <div className="admin-summary-grid">
          <article>
            <span>Doanh thu đã thanh toán</span>
            <strong>{formatMoney(revenue)}</strong>
          </article>
          <article>
            <span>Giao dịch paid</span>
            <strong>{paidOrders.length}</strong>
          </article>
          <article>
            <span>Bài đã hoàn thành</span>
            <strong>{adminData.progress.filter((item) => item.completed).length}</strong>
          </article>
          <article>
            <span>Nhiệm vụ giảng viên</span>
            <strong>{adminData.assignments.length}</strong>
          </article>
        </div>

        <div className="admin-overview-actions">
          <button
            type="button"
            className="button button-ghost"
            onClick={() => exportOrdersToExcel(adminData.orders, profiles, adminData.courses)}
            title="Xuất Excel danh sách đơn hàng"
          >
            ⬇ Xuất Excel đơn hàng
          </button>
        </div>
      </section>

      <section className="section admin-management-grid">
        <form className="content-card content-card--enterprise dashboard-form admin-panel" onSubmit={handleSaveProfile}>
          <div className="section-head">
            <div>
              <span className="eyebrow">Người dùng</span>
              <h2>Thêm / sửa học viên, giảng viên, admin</h2>
            </div>
            <button type="button" className="button-ghost" onClick={resetProfileDraft}>
              Tạo mới
            </button>
          </div>

          <div className="dashboard-form__grid">
            <label className="auth-field">
              <span>Họ tên</span>
              <input value={profileDraft.fullName} onChange={(event) => updateProfileDraft('fullName', event.target.value)} />
            </label>
            <label className="auth-field">
              <span>Email</span>
              <input type="email" value={profileDraft.email} onChange={(event) => updateProfileDraft('email', event.target.value)} />
            </label>
            <label className="auth-field">
              <span>Số điện thoại</span>
              <input type="tel" value={profileDraft.phone} onChange={(event) => updateProfileDraft('phone', event.target.value)} />
            </label>
            <label className="auth-field">
              <span>Vai trò</span>
              <select value={profileDraft.role} onChange={(event) => updateProfileDraft('role', event.target.value)}>
                <option value="student">Học viên</option>
                <option value="teacher">Giảng viên</option>
                <option value="admin">Quản trị</option>
              </select>
            </label>
            <label className="auth-field">
              <span>Avatar URL</span>
              <input value={profileDraft.avatarUrl} onChange={(event) => updateProfileDraft('avatarUrl', event.target.value)} />
            </label>
          </div>

          <button type="submit" className="button dashboard-submit" disabled={saving || !profileDraft.fullName.trim()}>
            {profileDraft.id ? 'Cập nhật người dùng' : 'Thêm người dùng'}
          </button>

          <small className="admin-note">
            Thêm người dùng trong trình duyệt tạo hồ sơ quản trị. Tạo/xóa tài khoản đăng nhập Auth thật cần Edge Function dùng service-role.
          </small>
        </form>

        <div className="content-card content-card--enterprise admin-panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">Tổng hợp người dùng</span>
              <h2>Học viên, giảng viên và admin</h2>
            </div>
            <span className="pill">{profiles.length} hồ sơ</span>
          </div>

          <AdminDataTable
            columns={['Tên', 'Email', 'SĐT', 'Vai trò', 'Nguồn', 'Thao tác']}
            rows={profiles}
            emptyText="Chưa có hồ sơ người dùng."
            renderRow={(profile) => (
              <tr key={profile.id}>
                <td>{profile.fullName}</td>
                <td>{profile.email || 'Chưa có email'}</td>
                <td>{profile.phone || 'Chưa có SĐT'}</td>
                <td>{adminRoleLabels[profile.role] || profile.role}</td>
                <td>{profile.source || 'supabase'}</td>
                <td>
                  <div className="admin-row-actions">
                    <button type="button" className="button-ghost" onClick={() => setProfileDraft(profile)}>
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="button-ghost danger"
                      disabled={profile.id === auth.user?.id || saving}
                      onClick={() => handleDeleteProfile(profile)}
                    >
                      Xóa
                    </button>
                  </div>
                </td>
              </tr>
            )}
          />
        </div>
      </section>

      <section className="section admin-management-grid">
        <form className="content-card content-card--enterprise dashboard-form admin-panel" onSubmit={handleSaveCourse}>
          <div className="section-head">
            <div>
              <span className="eyebrow">Khóa học</span>
              <h2>Thêm / sửa / xóa khóa học</h2>
            </div>
            <button type="button" className="button-ghost" onClick={resetCourseDraft}>
              Tạo mới
            </button>
          </div>

          <div className="dashboard-form__grid">
            <label className="auth-field">
              <span>Tên khóa</span>
              <input value={courseDraft.title} onChange={(event) => updateCourseDraft('title', event.target.value)} />
            </label>
            <label className="auth-field">
              <span>Slug</span>
              <input value={courseDraft.slug} onChange={(event) => updateCourseDraft('slug', event.target.value)} placeholder="tu-dong-neu-bo-trong" />
            </label>
            <label className="auth-field">
              <span>Giảng viên phụ trách</span>
              <select value={courseDraft.teacherId} onChange={(event) => updateCourseDraft('teacherId', event.target.value)}>
                <option value="">Chưa gắn giảng viên</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="auth-field">
              <span>Trạng thái</span>
              <select value={courseDraft.status} onChange={(event) => updateCourseDraft('status', event.target.value)}>
                <option value="draft">Nháp</option>
                <option value="published">Công khai</option>
                <option value="hidden">Ẩn</option>
              </select>
            </label>
            <label className="auth-field">
              <span>Giá VND</span>
              <input type="number" min="0" step="10000" value={courseDraft.price} onChange={(event) => updateCourseDraft('price', event.target.value)} />
            </label>
            <div className="auth-field auth-field--full">
              <span>Ảnh đại diện (banner)</span>
              <input
                type="file"
                accept="image/jpeg, image/png, image/webp, image/gif"
                onChange={handleCourseBannerChange}
                disabled={uploadingCourseBanner}
              />
              <small style={{ color: 'var(--muted)', lineHeight: 1.5 }}>
                Ảnh này sẽ hiển thị ở đầu thẻ khóa học cho học viên. Có thể tải file lên hoặc dán link ảnh bên dưới.
              </small>
              {uploadingCourseBanner ? <span className="upload-progress">Đang tải ảnh lên...</span> : null}
              {courseBannerError ? <span className="error-message" style={{ color: 'var(--error)' }}>{courseBannerError}</span> : null}
              <input
                value={courseDraft.bannerUrl}
                onChange={(event) => updateCourseDraft('bannerUrl', event.target.value)}
                placeholder="Dán URL ảnh nếu muốn dùng link"
              />
              {courseDraft.bannerUrl ? (
                <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem' }}>
                  <img
                    src={courseDraft.bannerUrl}
                    alt="Banner Preview"
                    style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: 'var(--radius)' }}
                  />
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={() => updateCourseDraft('bannerUrl', '')}
                    style={{ width: 'fit-content' }}
                  >
                    Xóa ảnh
                  </button>
                </div>
              ) : null}
            </div>
            <label className="auth-field auth-field--full">
              <span>Mô tả</span>
              <textarea rows="3" value={courseDraft.description} onChange={(event) => updateCourseDraft('description', event.target.value)} />
            </label>
          </div>

          <button type="submit" className="button dashboard-submit" disabled={saving || !courseDraft.title.trim()}>
            {courseDraft.id ? 'Cập nhật khóa học' : 'Thêm khóa học'}
          </button>
        </form>

        <div className="content-card content-card--enterprise admin-panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">Danh sách khóa</span>
              <h2>Khóa học toàn hệ thống</h2>
            </div>
            <span className="pill">{adminData.courses.length} khóa</span>
          </div>

          <AdminDataTable
            columns={['Khóa', 'Giảng viên', 'Giá', 'Trạng thái', 'Thao tác']}
            rows={adminData.courses}
            emptyText="Chưa có khóa học."
            renderRow={(course) => (
              <tr key={`${course.id}-${course.databaseId}`}>
                <td>
                  <strong>{course.title}</strong>
                  <span>{course.slug}</span>
                </td>
                <td>{profileLookup.get(course.teacherId)?.fullName || 'Chưa gắn'}</td>
                <td>{formatMoney(course.price)}</td>
                <td>{course.status}</td>
                <td>
                  <div className="admin-row-actions">
                    <button type="button" className="button-ghost" onClick={() => setCourseDraft({ ...emptyCourseDraft, ...course })}>
                      Sửa
                    </button>
                    <button type="button" className="button-ghost danger" disabled={saving} onClick={() => handleDeleteCourse(course)}>
                      Xóa
                    </button>
                  </div>
                </td>
              </tr>
            )}
          />
        </div>
      </section>

      <section className="section admin-management-grid">
        <form className="content-card content-card--enterprise dashboard-form admin-panel" onSubmit={handleSaveLesson}>
          <div className="section-head">
            <div>
              <span className="eyebrow">Bài học</span>
              <h2>Thay đổi, thêm, sửa, xóa bài học</h2>
            </div>
            <button type="button" className="button-ghost" onClick={resetLessonDraft}>
              Tạo mới
            </button>
          </div>

          <div className="dashboard-form__grid">
            <label className="auth-field">
              <span>Khóa học</span>
              <select value={lessonDraft.courseId} onChange={(event) => updateLessonDraft('courseId', event.target.value)}>
                <option value="">Chọn khóa học</option>
                {adminData.courses.map((course) => (
                  <option key={`${course.id}-${course.databaseId}`} value={getCourseKey(course)}>
                    {course.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="auth-field">
              <span>Tên bài học</span>
              <input value={lessonDraft.title} onChange={(event) => updateLessonDraft('title', event.target.value)} />
            </label>
            <label className="auth-field">
              <span>Thứ tự</span>
              <input type="number" min="1" value={lessonDraft.position} onChange={(event) => updateLessonDraft('position', event.target.value)} />
            </label>
            <label className="auth-field">
              <span>Video URL</span>
              <input value={lessonDraft.videoUrl} onChange={(event) => updateLessonDraft('videoUrl', event.target.value)} />
            </label>
            <label className="auth-field auth-field--full">
              <span>Tải video lên Storage</span>
              <div className="admin-upload-field">
                <input
                  ref={videoUploadRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
                  onChange={handleLessonVideoUpload}
                  disabled={videoUploading || saving}
                />
                {videoUploading ? (
                  <div className="admin-upload-progress">
                    <span>Đang tải video... {videoUploadProgress}%</span>
                    <div className="meter">
                      <span style={{ width: `${videoUploadProgress}%` }} />
                    </div>
                  </div>
                ) : (
                  <small className="admin-note">MP4, WebM, MOV, MKV — tối đa 500MB. URL sẽ tự điền sau khi tải xong.</small>
                )}
              </div>
            </label>
            <label className="auth-field auth-field--full">
              <span>Nội dung bài</span>
              <textarea rows="4" value={lessonDraft.content} onChange={(event) => updateLessonDraft('content', event.target.value)} />
            </label>
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={lessonDraft.isPreview}
                onChange={(event) => updateLessonDraft('isPreview', event.target.checked)}
              />
              <span>Cho xem thử</span>
            </label>
          </div>

          <button type="submit" className="button dashboard-submit" disabled={saving || !lessonDraft.title.trim() || !lessonDraft.courseId}>
            {lessonDraft.id ? 'Cập nhật bài học' : 'Thêm bài học'}
          </button>
        </form>

        <div className="content-card content-card--enterprise admin-panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">Danh sách bài</span>
              <h2>Bài học theo khóa</h2>
            </div>
            <span className="pill">{adminData.lessons.length} bài</span>
          </div>

          <AdminDataTable
            columns={['Bài học', 'Khóa', 'Thứ tự', 'Xem thử', 'Thao tác']}
            rows={lessonRows}
            emptyText="Chưa có bài học."
            renderRow={(lesson) => (
              <tr key={`${lesson.id}-${lesson.databaseId}`}>
                <td>
                  <strong>{lesson.title}</strong>
                  <span>{lesson.content ? `${lesson.content.slice(0, 64)}...` : 'Chưa có nội dung'}</span>
                </td>
                <td>{getCourseTitle(courseLookup, lesson.courseId)}</td>
                <td>{lesson.position}</td>
                <td>{lesson.isPreview ? 'Có' : 'Không'}</td>
                <td>
                  <div className="admin-row-actions">
                    <button
                      type="button"
                      className="button-ghost"
                      disabled={saving || lesson.position <= 1}
                      onClick={() => handleShiftLessonPosition(lesson, -1)}
                    >
                      Lên
                    </button>
                    <button
                      type="button"
                      className="button-ghost"
                      disabled={saving || lesson.position >= (lessonsByCourse.get(lesson.courseId || '') || []).length}
                      onClick={() => handleShiftLessonPosition(lesson, 1)}
                    >
                      Xuống
                    </button>
                    <button
                      type="button"
                      className="button-ghost"
                      onClick={() =>
                        setLessonDraft({
                          ...emptyLessonDraft,
                          courseId: lesson.courseId,
                          position: String(Number(lesson.position || 0) + 1)
                        })
                      }
                    >
                      Thêm sau
                    </button>
                    <button
                      type="button"
                      className="button-ghost"
                      onClick={() => setLessonDraft({ ...emptyLessonDraft, ...lesson })}
                    >
                      Sửa
                    </button>
                    <button type="button" className="button-ghost danger" disabled={saving} onClick={() => handleDeleteLesson(lesson)}>
                      Xóa
                    </button>
                  </div>
                </td>
              </tr>
            )}
          />
        </div>
      </section>

      <section className="section split-layout">
        <div className="content-card content-card--enterprise admin-panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">Thông tin giảng viên</span>
              <h2>Tất cả teacher và nội dung phụ trách</h2>
            </div>
            <span className="pill">{teacherSummary.length} teacher</span>
          </div>

          <AdminDataTable
            columns={['Giảng viên', 'Email', 'Khóa', 'Bài giao', 'Công khai']}
            rows={teacherSummary}
            emptyText="Chưa có giảng viên."
            renderRow={(teacher) => (
              <tr key={teacher.id}>
                <td>{teacher.fullName}</td>
                <td>{teacher.email || 'Chưa có email'}</td>
                <td>{teacher.coursesCount}</td>
                <td>{teacher.assignmentsCount}</td>
                <td>{teacher.publishedCount}</td>
              </tr>
            )}
          />
        </div>

        <div className="content-card content-card--enterprise admin-panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">Thông tin học sinh</span>
              <h2>Tất cả student và tiến độ</h2>
            </div>
            <span className="pill">{studentSummary.length} student</span>
          </div>

          <AdminDataTable
            columns={['Học sinh', 'Email', 'Khóa paid', 'Bài hoàn thành', 'Đơn hàng']}
            rows={studentSummary}
            emptyText="Chưa có học viên."
            renderRow={(student) => (
              <tr key={student.id}>
                <td>{student.fullName}</td>
                <td>{student.email || 'Chưa có email'}</td>
                <td>{student.paidCourses}</td>
                <td>{student.completedLessons}</td>
                <td>{student.ordersCount}</td>
              </tr>
            )}
          />
        </div>
      </section>

      <section className="content-card content-card--enterprise admin-panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">Quyền hệ thống</span>
            <h2>Phân quyền theo vai trò</h2>
          </div>
          <button type="button" className="button" onClick={handleSavePermissions} disabled={saving}>
            Lưu quyền
          </button>
        </div>

        <div className="admin-permission-grid">
          {permissionDraft.map((rolePermission) => (
            <article key={rolePermission.role} className="admin-permission-card">
              <div>
                <span className="eyebrow">{rolePermission.role}</span>
                <h3>{rolePermission.label}</h3>
              </div>

              <div className="admin-permission-list">
                {Object.entries(permissionLabels).map(([permissionKey, label]) => (
                  <label key={`${rolePermission.role}-${permissionKey}`} className="admin-checkbox">
                    <input
                      type="checkbox"
                      checked={Boolean(rolePermission.permissions[permissionKey])}
                      onChange={(event) => updatePermission(rolePermission.role, permissionKey, event.target.checked)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
      </>
      ) : null}
    </DashboardShell>
  );
}
