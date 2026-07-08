import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { getEffectiveRole } from '../lib/permissions';
import { createAssignment, getAssignmentsForStudent, getAssignmentsForTeacher, getCourseOptions } from '../lib/assignmentService';
import { getCourseCatalog, getOwnedCourseIds } from '../lib/courseService';

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

function formatAssignmentScope(scope) {
  return scope === 'course_buyers' ? 'Học viên đã mua khóa' : 'Học viên được chọn';
}

function AssignmentExercisePreview({ assignment, showAnswer = false }) {
  const config = getExerciseConfig(assignment);
  const options = (config.options || []).filter(Boolean);
  const pairs = (config.pairs || []).filter((pair) => pair.term || pair.answer);

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
        <span>{exerciseTypeLabels[config.type] || 'Bài luyện'}</span>
        <span>Bước {config.lessonPosition || '1'} trong lộ trình</span>
        <span>{assignment.audioName || 'Chưa có audio'}</span>
        <span>{assignment.attachmentName || 'Chưa có tài liệu'}</span>
      </div>
      <AssignmentExercisePreview assignment={assignment} />
    </article>
  );
}

export function StudentDashboardPage() {
  const auth = useAuth();
  const email = auth.user?.email || '';
  const [assignments, setAssignments] = useState([]);
  const [ownedCount, setOwnedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const [nextAssignments, courses] = await Promise.all([
        getAssignmentsForStudent(email),
        getCourseCatalog()
      ]);
      const nextOwnedIds = await getOwnedCourseIds(auth.user?.id, courses);

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
            {assignments.map((assignment) => (
              <AssignmentCard key={assignment.id} assignment={assignment} />
            ))}
          </div>
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

export function TeacherDashboardPage() {
  const auth = useAuth();
  const teacherId = auth.user?.id;
  const [courses] = useState(getCourseOptions());
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showStudentView, setShowStudentView] = useState(false);
  const [form, setForm] = useState({
    courseKey: courses[0]?.key || 'english-foundation',
    courseTitle: courses[0]?.title || 'Tiếng Anh nền tảng A1-A2',
    lessonTitle: 'Bài 2. Phát âm trọng tâm',
    title: 'Nhiệm vụ luyện phát âm',
    description: 'Giao hoạt động nghe cho học viên đã mua khóa trong đúng lộ trình học.',
    assignmentScope: 'course_buyers',
    audioName: 'sample-audio.mp3',
    audioUrl: 'https://example.com/sample-audio.mp3',
    attachmentName: 'worksheet.pdf',
    attachmentUrl: 'https://example.com/worksheet.pdf',
    exerciseConfig: defaultExerciseConfig
  });

  useEffect(() => {
    if (!courses.length) return;
    setForm((previous) => ({
      ...previous,
      courseKey: courses[0].key,
      courseTitle: courses[0].title
    }));
  }, [courses]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const nextAssignments = await getAssignmentsForTeacher(teacherId);
      if (active) {
        setAssignments(nextAssignments);
        setLoading(false);
      }
    }

    if (teacherId) {
      void load();
    } else {
      setLoading(false);
    }

    return () => {
      active = false;
    };
  }, [teacherId]);

  function updateExerciseConfig(nextConfig) {
    setForm((previous) => ({
      ...previous,
      exerciseConfig: {
        ...getExerciseConfig(previous),
        ...nextConfig
      }
    }));
  }

  function updateExerciseOption(index, value) {
    const nextOptions = [...getExerciseConfig(form).options];
    nextOptions[index] = value;
    updateExerciseConfig({ options: nextOptions });
  }

  function updateMatchingPair(index, field, value) {
    const nextPairs = getExerciseConfig(form).pairs.map((pair, pairIndex) =>
      pairIndex === index ? { ...pair, [field]: value } : pair
    );
    updateExerciseConfig({ pairs: nextPairs });
  }

  async function handleCreateAssignment(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!teacherId) {
      setError('Thiếu tài khoản giảng viên.');
      return;
    }

    setSaving(true);
    try {
      await createAssignment({
        teacherId,
        assignment: {
          ...form,
          assignmentScope: 'course_buyers'
        },
        recipients: []
      });

      const nextAssignments = await getAssignmentsForTeacher(teacherId);
      setAssignments(nextAssignments);
      setSuccess('Nhiệm vụ học tập đã được lưu thành công.');
    } catch (submissionError) {
      setError(submissionError.message || 'Chưa thể lưu nhiệm vụ học tập.');
    } finally {
      setSaving(false);
    }
  }

  const metrics = useMemo(
    () => [
      { label: 'Khóa đang vận hành', value: String(courses.length || 0) },
      { label: 'Nhiệm vụ đã tạo', value: String(assignments.length) },
      { label: 'Bài trong lộ trình', value: String(assignments.length) },
      { label: 'Trạng thái lưu', value: 'Hoàn tất' }
    ],
    [assignments, courses.length]
  );

  return (
    <DashboardShell
      title="Bảng điều khiển giảng viên"
      description="Tạo nhiệm vụ học tập, quản lý học liệu và phân phối bài học cho đúng nhóm học viên."
      metrics={metrics}
    >
      <section className="section split-layout">
        <form className="content-card content-card--enterprise dashboard-form" onSubmit={handleCreateAssignment}>
          <div className="section-head">
            <div>
              <span className="eyebrow">Quản lý giao bài</span>
              <h2>Tạo nhiệm vụ học tập</h2>
            </div>
            <button type="button" className="button-ghost" onClick={() => setShowStudentView((value) => !value)}>
              Student view
            </button>
          </div>

          {error ? <div className="auth-message">{error}</div> : null}
          {success ? <div className="auth-message auth-message--success">{success}</div> : null}

          <div className="dashboard-form__grid">
            <label className="auth-field">
              <span>Khóa học</span>
              <select
                value={form.courseKey}
                onChange={(event) => {
                  const nextCourse = courses.find((course) => course.key === event.target.value) || courses[0];
                  setForm((previous) => ({
                    ...previous,
                    courseKey: nextCourse?.key || previous.courseKey,
                    courseTitle: nextCourse?.title || previous.courseTitle
                  }));
                }}
              >
                {courses.map((course) => (
                  <option key={course.key} value={course.key}>
                    {course.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="auth-field">
              <span>Thứ tự trong lộ trình</span>
              <input
                type="number"
                min="1"
                value={getExerciseConfig(form).lessonPosition}
                onChange={(event) => updateExerciseConfig({ lessonPosition: event.target.value })}
                placeholder="1"
              />
            </label>

            <label className="auth-field">
              <span>Tên bài học</span>
              <input
                value={form.lessonTitle}
                onChange={(event) => setForm((previous) => ({ ...previous, lessonTitle: event.target.value }))}
                placeholder="Bài 2. Phát âm trọng tâm"
              />
            </label>

            <label className="auth-field">
              <span>Tên nhiệm vụ</span>
              <input
                value={form.title}
                onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))}
                placeholder="Nhiệm vụ luyện phát âm"
              />
            </label>

            <label className="auth-field auth-field--full">
              <span>Mô tả</span>
              <textarea
                rows="4"
                value={form.description}
                onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
                placeholder="Mô tả yêu cầu học viên cần thực hiện..."
              />
            </label>

            <div className="auth-field auth-field--full assignment-builder">
              <span>Cấu hình bài tập</span>
              <div className="assignment-builder__grid">
                <label>
                  <span>Dạng bài</span>
                  <select
                    value={getExerciseConfig(form).type}
                    onChange={(event) => updateExerciseConfig({ type: event.target.value })}
                  >
                    {Object.entries(exerciseTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                {getExerciseConfig(form).type !== 'blank' && getExerciseConfig(form).type !== 'flash' ? (
                  <label>
                    <span>Câu hỏi / yêu cầu</span>
                    <input
                      value={getExerciseConfig(form).prompt}
                      onChange={(event) => updateExerciseConfig({ prompt: event.target.value })}
                      placeholder="Nhập câu hỏi học viên sẽ thấy"
                    />
                  </label>
                ) : null}

                {getExerciseConfig(form).type === 'mcq' ? (
                  <>
                    {getExerciseConfig(form).options.map((option, index) => (
                      <label key={`option-${index}`}>
                        <span>Phương án {index + 1}</span>
                        <input
                          value={option}
                          onChange={(event) => updateExerciseOption(index, event.target.value)}
                          placeholder={`Phương án ${index + 1}`}
                        />
                      </label>
                    ))}
                    <label>
                      <span>Đáp án đúng</span>
                      <select
                        value={getExerciseConfig(form).correctAnswer}
                        onChange={(event) => updateExerciseConfig({ correctAnswer: event.target.value })}
                      >
                        {getExerciseConfig(form).options.filter(Boolean).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                ) : null}

                {getExerciseConfig(form).type === 'tf' ? (
                  <label>
                    <span>Đáp án đúng</span>
                    <select
                      value={getExerciseConfig(form).trueFalseAnswer}
                      onChange={(event) => updateExerciseConfig({ trueFalseAnswer: event.target.value })}
                    >
                      <option value="Đúng">Đúng</option>
                      <option value="Sai">Sai</option>
                    </select>
                  </label>
                ) : null}

                {getExerciseConfig(form).type === 'match' ? (
                  <>
                    {getExerciseConfig(form).pairs.map((pair, index) => (
                      <div key={`pair-${index}`} className="assignment-builder__pair">
                        <label>
                          <span>Mục {index + 1}</span>
                          <input
                            value={pair.term}
                            onChange={(event) => updateMatchingPair(index, 'term', event.target.value)}
                            placeholder="Từ / câu hỏi"
                          />
                        </label>
                        <label>
                          <span>Đáp án đúng</span>
                          <input
                            value={pair.answer}
                            onChange={(event) => updateMatchingPair(index, 'answer', event.target.value)}
                            placeholder="Nghĩa / cặp đúng"
                          />
                        </label>
                      </div>
                    ))}
                  </>
                ) : null}

                {getExerciseConfig(form).type === 'blank' ? (
                  <>
                    <label>
                      <span>Câu điền khuyết</span>
                      <input
                        value={getExerciseConfig(form).blankText}
                        onChange={(event) => updateExerciseConfig({ blankText: event.target.value })}
                        placeholder="Hello, my name ____ Linh."
                      />
                    </label>
                    <label>
                      <span>Đáp án đúng</span>
                      <input
                        value={getExerciseConfig(form).blankAnswer}
                        onChange={(event) => updateExerciseConfig({ blankAnswer: event.target.value })}
                        placeholder="is"
                      />
                    </label>
                  </>
                ) : null}

                {getExerciseConfig(form).type === 'flash' ? (
                  <>
                    <label>
                      <span>Mặt trước</span>
                      <input
                        value={getExerciseConfig(form).flashFront}
                        onChange={(event) => updateExerciseConfig({ flashFront: event.target.value })}
                        placeholder="Hello"
                      />
                    </label>
                    <label>
                      <span>Mặt sau</span>
                      <input
                        value={getExerciseConfig(form).flashBack}
                        onChange={(event) => updateExerciseConfig({ flashBack: event.target.value })}
                        placeholder="Xin chào"
                      />
                    </label>
                  </>
                ) : null}

                <label>
                  <span>Phản hồi sau khi làm bài</span>
                  <input
                    value={getExerciseConfig(form).explanation}
                    onChange={(event) => updateExerciseConfig({ explanation: event.target.value })}
                    placeholder="Gợi ý hoặc giải thích ngắn"
                  />
                </label>
              </div>
            </div>

            <label className="auth-field">
              <span>Tên file audio</span>
              <input
                value={form.audioName}
                onChange={(event) => setForm((previous) => ({ ...previous, audioName: event.target.value }))}
                placeholder="lesson-audio.mp3"
              />
            </label>

            <label className="auth-field">
              <span>Đường dẫn audio</span>
              <input
                value={form.audioUrl}
                onChange={(event) => setForm((previous) => ({ ...previous, audioUrl: event.target.value }))}
                placeholder="https://..."
              />
            </label>

            <label className="auth-field">
              <span>Tên tài liệu đính kèm</span>
              <input
                value={form.attachmentName}
                onChange={(event) => setForm((previous) => ({ ...previous, attachmentName: event.target.value }))}
                placeholder="worksheet.pdf"
              />
            </label>

            <label className="auth-field">
              <span>Đường dẫn tài liệu</span>
              <input
                value={form.attachmentUrl}
                onChange={(event) => setForm((previous) => ({ ...previous, attachmentUrl: event.target.value }))}
                placeholder="https://..."
              />
            </label>

          </div>

          {showStudentView ? (
            <section className="student-view-preview">
              <div className="section-head">
                <div>
                  <span className="eyebrow">Student view</span>
                  <h3>Học viên sẽ nhìn thấy bài tập như sau</h3>
                </div>
                <span className="pill">{form.courseTitle}</span>
              </div>
              <article className="content-card content-card--enterprise assignment-card">
                <div className="assignment-card__head">
                  <div>
                    <span className="eyebrow">{form.courseTitle}</span>
                    <h3>{form.title}</h3>
                    <p>{form.lessonTitle}</p>
                  </div>
                </div>
                {form.description ? <p className="assignment-card__description">{form.description}</p> : null}
                <AssignmentExercisePreview assignment={form} />
              </article>
            </section>
          ) : null}

          <button type="submit" className="button dashboard-submit" disabled={saving || !teacherId}>
            {saving ? 'Đang lưu...' : 'Lưu nhiệm vụ'}
          </button>
        </form>

        <div className="content-card content-card--enterprise">
          <div className="section-head">
            <div>
              <span className="eyebrow">Nhiệm vụ đã lưu</span>
              <h2>Học liệu đã phân phối</h2>
            </div>
            <span className="pill">{loading ? 'Đang tải' : `${assignments.length} mục`}</span>
          </div>

          <div className="assignment-list">
            {assignments.map((assignment) => (
              <AssignmentCard key={assignment.id} assignment={assignment} />
            ))}
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}

export function AdminDashboardPage() {
  return (
    <DashboardShell
      title="Bảng điều khiển quản trị"
      description="Theo dõi người dùng, phê duyệt nội dung, thanh toán và chỉ số vận hành nền tảng."
      metrics={[
        { label: 'Người dùng', value: '12,480' },
        { label: 'Doanh thu', value: '$128k' },
        { label: 'Giao dịch', value: '1,248' },
        { label: 'Chờ phê duyệt', value: '6' }
      ]}
    >
      <section className="section split-layout">
        <div className="content-card content-card--enterprise">
          <h2>Điều phối nền tảng</h2>
          <ul className="plain-list">
            <li>Phê duyệt khóa học và nhiệm vụ do giảng viên tạo.</li>
            <li>Theo dõi ghi danh, thanh toán và trạng thái học viên.</li>
            <li>Kiểm tra quyền truy cập vào học liệu và tài khoản liên quan.</li>
          </ul>
        </div>

        <div className="content-card content-card--enterprise">
          <h2>Kế hoạch vận hành tiếp theo</h2>
          <ul className="plain-list">
            <li>Hoàn thiện hồ sơ học viên và lịch sử giao dịch.</li>
            <li>Nâng cấp quy trình đăng nhập và bảo vệ tài khoản.</li>
            <li>Theo dõi tiến độ học tập nhanh hơn cho đội ngũ vận hành.</li>
          </ul>
        </div>
      </section>
    </DashboardShell>
  );
}
