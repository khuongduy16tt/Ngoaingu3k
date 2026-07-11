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
  saveAdminCourse,
  saveAdminLesson,
  saveAdminProfile,
  saveRolePermissions
} from '../lib/adminService';
import { getCourseCatalog, getOwnedCourseIds } from '../lib/courseService';
import { usePageTitle } from '../hooks/usePageTitle';
import { getActivityLogs } from '../lib/activityService';
import {
  exportUsersToExcel,
  exportOrdersToExcel,
  exportActivityToExcel
} from '../lib/reportService';
import { uploadLessonVideo, validateVideoFile } from '../lib/storageService';
import { PaginationControls, usePagination } from '../components/Pagination';

const exerciseTypeLabels = {
  mcq: 'Trắc nghiệm',
  tf: 'Đúng / Sai',
  match: 'Nối cặp',
  blank: 'Điền khuyết',
  flash: 'Thẻ ghi nhớ'
};

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

const teacherCourseStorageKey = 'teacher-managed-courses-v1';

const demoCourseStudents = [
  { name: 'Minh Anh', email: 'minh.anh@ngoaingu3k.com', courseId: 'english-foundation', progress: 82, score: 91, lastActive: 'Hôm nay' },
  { name: 'Gia Huy', email: 'gia.huy@ngoaingu3k.com', courseId: 'english-foundation', progress: 64, score: 78, lastActive: 'Hôm qua' },
  { name: 'Linh Chi', email: 'linh.chi@ngoaingu3k.com', courseId: 'business-communication', progress: 48, score: 84, lastActive: '2 ngày trước' },
  { name: 'Quốc Bảo', email: 'quoc.bao@ngoaingu3k.com', courseId: 'business-communication', progress: 71, score: 88, lastActive: 'Hôm nay' },
  { name: 'Hoàng Nam', email: 'hoang.nam@ngoaingu3k.com', courseId: 'ielts-boost', progress: 35, score: 73, lastActive: '3 ngày trước' },
  { name: 'Thanh Trúc', email: 'thanh.truc@ngoaingu3k.com', courseId: 'ielts-boost', progress: 59, score: 86, lastActive: 'Hôm qua' }
];

function readStoredTeacherCourses(teacherId) {
  try {
    const rawValue = localStorage.getItem(`${teacherCourseStorageKey}:${teacherId || 'local'}`);
    return rawValue ? JSON.parse(rawValue) : [];
  } catch {
    return [];
  }
}

function writeStoredTeacherCourses(teacherId, courses) {
  try {
    localStorage.setItem(`${teacherCourseStorageKey}:${teacherId || 'local'}`, JSON.stringify(courses));
  } catch {
    // ignore storage failures
  }
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
  return {
    id: course.id || course.slug || `course-${index + 1}`,
    title: course.title || 'Khóa học chưa đặt tên',
    summary: course.summary || course.description || 'Khóa học được giảng viên đăng lên hệ thống.',
    category: course.category || 'Kỹ năng cốt lõi',
    level: course.level || 'Nền tảng',
    duration: course.duration || '6 tuần',
    lessonsCount: Number(course.lessonsCount || course.lessons_count || 12),
    price: course.price || '$49',
    status: course.status || 'published',
    publishedAt: course.publishedAt || 'Đã đăng'
  };
}

function average(values) {
  const validValues = values.filter((value) => Number.isFinite(Number(value)));
  if (!validValues.length) return 0;
  return Math.round(validValues.reduce((total, value) => total + Number(value), 0) / validValues.length);
}

function getProgressLabel(progress) {
  if (progress >= 80) return 'Tốt';
  if (progress >= 50) return 'Đang ổn';
  return 'Cần hỗ trợ';
}

function getScoreLabel(score) {
  if (score >= 85) return 'Hiệu quả cao';
  if (score >= 70) return 'Ổn định';
  return 'Cần can thiệp';
}

export function TeacherDashboardPage() {
  usePageTitle('Bảng điều khiển giảng viên');
  const auth = useAuth();
  const teacherId = auth.user?.id || 'local';
  const [teacherCourses, setTeacherCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [courseDraft, setCourseDraft] = useState({
    title: '',
    category: 'Kỹ năng cốt lõi',
    level: 'Nền tảng',
    duration: '6 tuần',
    lessonsCount: '12',
    price: '49',
    summary: ''
  });

  useEffect(() => {
    let active = true;

    async function loadTeacherCourses() {
      setLoading(true);
      const storedCourses = readStoredTeacherCourses(teacherId);
      const catalogCourses = await getCourseCatalog();
      const fallbackCourses = catalogCourses.slice(0, 3).map((course, index) => normalizeManagedCourse(course, index));
      const nextCourses = storedCourses.length ? storedCourses : fallbackCourses;

      if (active) {
        setTeacherCourses(nextCourses);
        if (!storedCourses.length) {
          writeStoredTeacherCourses(teacherId, nextCourses);
        }
        setLoading(false);
      }
    }

    void loadTeacherCourses();

    return () => {
      active = false;
    };
  }, [teacherId]);

  const courseLookup = useMemo(
    () => new Map(teacherCourses.map((course) => [course.id, course])),
    [teacherCourses]
  );

  const studentRows = useMemo(
    () =>
      demoCourseStudents
        .filter((student) => courseLookup.has(student.courseId))
        .map((student) => ({
          ...student,
          courseTitle: courseLookup.get(student.courseId)?.title || 'Khóa học'
        })),
    [courseLookup]
  );

  const visibleStudentRows = useMemo(
    () =>
      selectedCourseId === 'all'
        ? studentRows
        : studentRows.filter((student) => student.courseId === selectedCourseId),
    [selectedCourseId, studentRows]
  );

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
  const studentRowsPagination = usePagination(visibleStudentRows, {
    pageSize: 8,
    resetKey: `${selectedCourseId}|${visibleStudentRows.length}`
  });

  function updateDraft(field, value) {
    setCourseDraft((previous) => ({ ...previous, [field]: value }));
  }

  function persistCourses(nextCourses) {
    setTeacherCourses(nextCourses);
    writeStoredTeacherCourses(teacherId, nextCourses);
  }

  function handlePublishCourse(event) {
    event.preventDefault();
    setMessage({ type: '', text: '' });

    if (!courseDraft.title.trim()) {
      setMessage({ type: 'error', text: 'Hãy nhập tên khóa học trước khi đăng.' });
      return;
    }

    setSaving(true);
    const slug = createCourseSlug(courseDraft.title);
    const nextCourse = normalizeManagedCourse({
      id: `${slug}-${Date.now()}`,
      ...courseDraft,
      lessonsCount: Number(courseDraft.lessonsCount) || 1,
      price: `$${Number(courseDraft.price || 0)}`,
      status: 'published',
      publishedAt: 'Vừa đăng'
    });
    const nextCourses = [nextCourse, ...teacherCourses];
    persistCourses(nextCourses);
    setSelectedCourseId(nextCourse.id);
    setCourseDraft({
      title: '',
      category: 'Kỹ năng cốt lõi',
      level: 'Nền tảng',
      duration: '6 tuần',
      lessonsCount: '12',
      price: '49',
      summary: ''
    });
    setMessage({ type: 'success', text: 'Khóa học đã được đăng lên khu quản lý của giảng viên.' });
    setSaving(false);
  }

  function toggleCourseStatus(courseId) {
    const nextCourses = teacherCourses.map((course) =>
      course.id === courseId
        ? { ...course, status: course.status === 'published' ? 'hidden' : 'published' }
        : course
    );
    persistCourses(nextCourses);
  }

  return (
    <DashboardShell
      title="Bảng điều khiển giảng viên"
      description="Đăng khóa học, theo dõi học sinh đang học từng khóa, tiến độ hoàn thành và hiệu quả học tập."
      metrics={metrics}
    >
      <section className="section teacher-course-dashboard">
        <form className="content-card content-card--enterprise dashboard-form teacher-course-publisher" onSubmit={handlePublishCourse}>
          <div className="section-head">
            <div>
              <span className="eyebrow">Quản lý khóa học</span>
              <h2>Đăng khóa học mới</h2>
            </div>
            <span className="pill">{loading ? 'Đang tải' : `${teacherCourses.length} khóa`}</span>
          </div>

          {message.text ? (
            <div className={`auth-message ${message.type === 'success' ? 'auth-message--success' : ''}`}>
              {message.text}
            </div>
          ) : null}

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
              <span>Giá bán USD</span>
              <input
                type="number"
                min="0"
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
          </div>

          <button type="submit" className="button dashboard-submit" disabled={saving}>
            {saving ? 'Đang đăng...' : 'Đăng khóa học'}
          </button>
        </form>

        <div className="content-card content-card--enterprise teacher-course-overview">
          <div className="section-head">
            <div>
              <span className="eyebrow">Khóa đã đăng</span>
              <h2>Kiểm soát khóa học đang vận hành</h2>
            </div>
            <span className="pill">{publishedCount} công khai</span>
          </div>

          <div className="teacher-course-list">
            {courseStatsPagination.pageItems.map((course) => (
              <article key={course.id} className="teacher-course-card">
                <div>
                  <span className="eyebrow">{course.category}</span>
                  <h3>{course.title}</h3>
                  <p>{course.summary}</p>
                </div>

                <div className="teacher-course-card__meta">
                  <span>{course.level}</span>
                  <span>{course.lessonsCount} bài</span>
                  <span>{course.duration}</span>
                  <span>{course.price}</span>
                </div>

                <div className="teacher-course-card__stats">
                  <span>
                    <strong>{course.studentsCount}</strong>
                    học sinh
                  </span>
                  <span>
                    <strong>{course.averageProgress}%</strong>
                    tiến độ
                  </span>
                  <span>
                    <strong>{course.averageScore}%</strong>
                    hiệu quả
                  </span>
                </div>

                <div className="teacher-course-card__actions">
                  <button type="button" className="button-ghost" onClick={() => setSelectedCourseId(course.id)}>
                    Xem học sinh
                  </button>
                  <button type="button" className="button-ghost" onClick={() => toggleCourseStatus(course.id)}>
                    {course.status === 'published' ? 'Ẩn khóa' : 'Mở lại'}
                  </button>
                </div>
              </article>
            ))}
          </div>
          <PaginationControls {...courseStatsPagination} label="khóa học" />
        </div>
      </section>

      <section className="content-card content-card--enterprise teacher-student-monitor">
        <div className="section-head">
          <div>
            <span className="eyebrow">Theo dõi học sinh</span>
            <h2>Ai đang học khóa nào, tiến độ và hiệu quả ra sao</h2>
          </div>
          <label className="teacher-course-filter">
            <span>Khóa học</span>
            <select value={selectedCourseId} onChange={(event) => setSelectedCourseId(event.target.value)}>
              <option value="all">Tất cả khóa</option>
              {teacherCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="teacher-monitor-summary">
          <article>
            <span>Học sinh trong bộ lọc</span>
            <strong>{visibleStudentRows.length}</strong>
          </article>
          <article>
            <span>Tiến độ trung bình</span>
            <strong>{average(visibleStudentRows.map((student) => student.progress))}%</strong>
          </article>
          <article>
            <span>Hiệu quả trung bình</span>
            <strong>{average(visibleStudentRows.map((student) => student.score))}%</strong>
          </article>
        </div>

        <div className="teacher-student-table-wrap">
          <table className="teacher-student-table">
            <thead>
              <tr>
                <th>Học sinh</th>
                <th>Đang học khóa</th>
                <th>Tiến độ</th>
                <th>Hiệu quả</th>
                <th>Hoạt động</th>
              </tr>
            </thead>
            <tbody>
              {studentRowsPagination.pageItems.map((student) => (
                <tr key={`${student.email}-${student.courseId}`}>
                  <td>
                    <strong>{student.name}</strong>
                    <span>{student.email}</span>
                  </td>
                  <td>{student.courseTitle}</td>
                  <td>
                    <div className="teacher-progress-cell">
                      <div className="meter">
                        <span style={{ width: `${student.progress}%` }} />
                      </div>
                      <small>{student.progress}% · {getProgressLabel(student.progress)}</small>
                    </div>
                  </td>
                  <td>
                    <strong>{student.score}%</strong>
                    <span>{getScoreLabel(student.score)}</span>
                  </td>
                  <td>{student.lastActive}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls {...studentRowsPagination} label="học sinh" />
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
  price: '49',
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

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
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

  const paidOrders = adminData.orders.filter((order) => order.status === 'paid');
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

  function updateProfileDraft(field, value) {
    setProfileDraft((previous) => ({ ...previous, [field]: value }));
  }

  function updateCourseDraft(field, value) {
    setCourseDraft((previous) => ({ ...previous, [field]: value }));
  }

  function updateLessonDraft(field, value) {
    setLessonDraft((previous) => ({ ...previous, [field]: value }));
  }

  function resetProfileDraft() {
    setProfileDraft(emptyProfileDraft);
  }

  function resetCourseDraft() {
    setCourseDraft(emptyCourseDraft);
  }

  function resetLessonDraft() {
    setLessonDraft({
      ...emptyLessonDraft,
      courseId: getCourseKey(adminData.courses[0] || {}) || ''
    });
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
        price: Number(courseDraft.price || 0)
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
              <span>Giá USD</span>
              <input type="number" min="0" value={courseDraft.price} onChange={(event) => updateCourseDraft('price', event.target.value)} />
            </label>
            <label className="auth-field">
              <span>Banner URL</span>
              <input value={courseDraft.bannerUrl} onChange={(event) => updateCourseDraft('bannerUrl', event.target.value)} />
            </label>
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
            rows={adminData.lessons}
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
