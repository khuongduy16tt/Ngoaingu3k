import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { getEffectiveRole } from '../lib/permissions';
import { createAssignment, getAssignmentsForStudent, getAssignmentsForTeacher, getCourseOptions } from '../lib/assignmentService';
import { PURCHASED_COURSES_STORAGE_KEY } from '../lib/courseService';

const lessons = [
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

const demoStudents = [
  { email: 'minh@ngoaingu3k.com', label: 'Minh' },
  { email: 'linh@ngoaingu3k.com', label: 'Linh' },
  { email: 'tuan@ngoaingu3k.com', label: 'Tuấn' }
];

const storageKeys = {
  audioByLesson: 'learning-audio-by-lesson',
  filesByLesson: 'learning-files-by-lesson',
  allowedStudents: 'learning-allowed-students',
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

function PracticeBadge({ title, text }) {
  return (
    <article className="practice-badge">
      <strong>{title}</strong>
      <span>{text}</span>
    </article>
  );
}

function formatAssignmentScope(scope) {
  return scope === 'course_buyers' ? 'Học viên đã mua khóa' : 'Học viên được chọn';
}

export default function LearningPage() {
  const auth = useAuth();
  const currentRole = getEffectiveRole(auth);
  const currentEmail = auth.user?.email || auth.profile?.full_name || 'hocvien@ngoaingu3k.com';

  const [selectedLessonId, setSelectedLessonId] = useState('lesson-2');
  const [activeTab, setActiveTab] = useState('mcq');
  const [mcqAnswer, setMcqAnswer] = useState('');
  const [tfAnswer, setTfAnswer] = useState('');
  const [matchAnswers, setMatchAnswers] = useState(['', '', '']);
  const [blankAnswer, setBlankAnswer] = useState('');
  const [flashFlip, setFlashFlip] = useState(false);
  const [audioMap, setAudioMap] = useState(() => readStoredJson(storageKeys.audioByLesson, {}));
  const [fileMap, setFileMap] = useState(() => readStoredJson(storageKeys.filesByLesson, {}));
  const [allowedStudents, setAllowedStudents] = useState(() => readStoredJson(storageKeys.allowedStudents, []));
  const [purchasedCourses, setPurchasedCourses] = useState(() => readStoredJson(storageKeys.purchasedCourses, []));
  const [selectedStudentEmail, setSelectedStudentEmail] = useState(demoStudents[0].email);
  const [teacherAssignments, setTeacherAssignments] = useState([]);
  const [studentAssignments, setStudentAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [showTeacherStudentView, setShowTeacherStudentView] = useState(false);

  useEffect(() => {
    writeStoredJson(storageKeys.audioByLesson, audioMap);
  }, [audioMap]);

  useEffect(() => {
    writeStoredJson(storageKeys.filesByLesson, fileMap);
  }, [fileMap]);

  useEffect(() => {
    writeStoredJson(storageKeys.allowedStudents, allowedStudents);
  }, [allowedStudents]);

  useEffect(() => {
    writeStoredJson(storageKeys.purchasedCourses, purchasedCourses);
  }, [purchasedCourses]);

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
          const nextStudentAssignments = await getAssignmentsForStudent(email);
          if (active) {
            setStudentAssignments(nextStudentAssignments);
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
  }, [auth.user?.id, auth.user?.email]);

  const currentLesson = lessons.find((lesson) => lesson.id === selectedLessonId) || lessons[1];
  const lessonIndex = useMemo(() => lessons.findIndex((lesson) => lesson.id === selectedLessonId), [selectedLessonId]);
  const lessonProgress = Math.round(((lessonIndex + 1) / lessons.length) * 100);
  const isTeacher = currentRole === 'teacher' || currentRole === 'admin';
  const hasPurchasedCourse = purchasedCourses.includes('english-foundation');
  const isSelectedRecipient = allowedStudents.includes(currentEmail);
  const hasLessonAccess = hasPurchasedCourse || isSelectedRecipient || isTeacher;

  function handleAudioUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const nextAudio = {
      name: file.name,
      url: URL.createObjectURL(file)
    };

    setAudioMap((previous) => {
      const existing = previous[selectedLessonId];
      if (existing?.url) {
        URL.revokeObjectURL(existing.url);
      }

      return {
        ...previous,
        [selectedLessonId]: nextAudio
      };
    });
  }

  function handleAttachmentUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const nextFile = {
      name: file.name,
      url: URL.createObjectURL(file)
    };

    setFileMap((previous) => {
      const existing = previous[selectedLessonId];
      if (existing?.url) {
        URL.revokeObjectURL(existing.url);
      }

      return {
        ...previous,
        [selectedLessonId]: nextFile
      };
    });
  }

  function toggleRecipient(email) {
    setAllowedStudents((previous) =>
      previous.includes(email) ? previous.filter((item) => item !== email) : [...previous, email]
    );
  }

  function publishAccessToSelected() {
    if (!allowedStudents.includes(selectedStudentEmail)) {
      setAllowedStudents((previous) => [...previous, selectedStudentEmail]);
    }
  }

  async function saveAssignmentToSupabase() {
    await createAssignment({
      teacherId: auth.user?.id,
      assignment: {
        courseKey: 'english-foundation',
        courseTitle: 'Tiếng Anh nền tảng A1-A2',
        lessonTitle: currentLesson.title,
        title: `${currentLesson.title} - bộ học liệu`,
        description: currentLesson.note,
        assignmentScope: 'course_buyers',
        audioName: audioMap[selectedLessonId]?.name || '',
        audioUrl: audioMap[selectedLessonId]?.url || '',
        attachmentName: fileMap[selectedLessonId]?.name || '',
        attachmentUrl: fileMap[selectedLessonId]?.url || ''
      },
      recipients: []
    });
  }

  const lessonAudio = audioMap[selectedLessonId];
  const lessonFile = fileMap[selectedLessonId];
  const visibleAssignments = isTeacher ? teacherAssignments : studentAssignments;

  return (
    <div className="page learning-page">
      <section className="learning-shell">
        <aside className="lesson-sidebar">
          <div className="sidebar-head">
            <span className="eyebrow">Phòng học</span>
            <h2>Chương 1. Chào hỏi chuyên nghiệp</h2>
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

          {lessons.map((lesson) => (
            <button
              key={lesson.id}
              type="button"
              className={`lesson-item ${lesson.status} ${selectedLessonId === lesson.id ? 'is-selected' : ''}`}
              onClick={() => setSelectedLessonId(lesson.id)}
            >
              <span className="lesson-item__icon" aria-hidden="true">
                {lesson.status === 'done' ? 'OK' : lesson.status === 'active' ? 'HỌC' : 'KHÓA'}
              </span>
              <span className="lesson-item__copy">
                <strong>{lesson.title}</strong>
                <span>{lesson.note}</span>
              </span>
            </button>
          ))}
        </aside>

        <div className="learning-stage">
          <section className="content-card content-card--enterprise learning-hero">
            <div className="learning-hero__copy">
              <span className="eyebrow">Bài học hiện tại</span>
              <h1>{currentLesson.title}</h1>
              <p>{currentLesson.note}</p>

              <div className="learning-flow">
                <PracticeBadge title="1. Nghe" text="Sử dụng audio do giảng viên tải lên hoặc bản ghi được cung cấp." />
                <PracticeBadge title="2. Luyện tập" text="Transcript, ghi chú và từ vựng được đặt ngay bên dưới." />
                <PracticeBadge title="3. Nộp bài" text="Giảng viên có thể giao cho học viên được chọn hoặc toàn bộ người mua khóa." />
              </div>
            </div>

            <div className="learning-hero__panel">
              <div className="learning-status">
                <span>Quyền truy cập</span>
                <strong>{hasLessonAccess ? 'Đã mở khóa' : 'Đang khóa'}</strong>
                <p>{hasLessonAccess ? 'Bạn có thể học bài này ngay.' : 'Cần mua khóa học hoặc được giảng viên cấp quyền.'}</p>
              </div>

              <div className="learning-stat-grid">
                <article>
                  <span>Âm thanh</span>
                  <strong>{lessonAudio ? 'Sẵn sàng' : 'Chưa có'}</strong>
                </article>
                <article>
                  <span>Tài liệu</span>
                  <strong>{lessonFile ? 'Sẵn sàng' : 'Chưa có'}</strong>
                </article>
                <article>
                  <span>Quyền học</span>
                  <strong>{hasLessonAccess ? 'Mở' : 'Khóa'}</strong>
                </article>
                <article>
                  <span>Nhiệm vụ</span>
                  <strong>{visibleAssignments.length}</strong>
                </article>
              </div>
            </div>
          </section>

          {hasLessonAccess ? (
            <>
              <section className="content-card content-card--enterprise learning-media">
                <div className="section-head">
                  <div>
                    <span className="eyebrow">Học liệu</span>
                    <h2>Tài nguyên học tập trong một không gian</h2>
                  </div>
                </div>

                <div className="learning-media__grid">
                  <div className="lesson-upload-box">
                    <strong>File nghe</strong>
                    <p>
                      {lessonAudio
                        ? `File đã tải lên: ${lessonAudio.name}`
                        : 'Chưa có audio. Giảng viên có thể tải file ở khu vực bên dưới.'}
                    </p>
                    {lessonAudio?.url ? <audio controls src={lessonAudio.url} className="lesson-audio" /> : null}
                  </div>

                  <div className="lesson-upload-box">
                    <strong>Bản chép lời / tài liệu đính kèm</strong>
                    <p>
                      {lessonFile
                        ? `Tài liệu đã đính kèm: ${lessonFile.name}`
                        : 'Chưa có tài liệu. Khu vực này dùng cho PDF, transcript hoặc worksheet.'}
                    </p>
                    {lessonFile?.url ? (
                      <a className="auth-link" href={lessonFile.url} download={lessonFile.name}>
                        Tải tài liệu
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className="lesson-notes-grid">
                  <article className="lesson-note-card">
                    <strong>Bản chép lời</strong>
                    <p>Giảng viên có thể dán bản chép lời hoặc đồng bộ từ PDF / xử lý audio ở bước sau.</p>
                  </article>
                  <article className="lesson-note-card">
                    <strong>Ghi chú</strong>
                    <p>Làm nổi bật phát âm, cụm từ trọng tâm và nội dung học viên cần luyện nói lại.</p>
                  </article>
                  <article className="lesson-note-card">
                    <strong>Bài tập về nhà</strong>
                    <p>Yêu cầu học viên ghi âm phản hồi, nộp đáp án hoặc hoàn thành bài nối cặp.</p>
                  </article>
                </div>
              </section>

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

          {isTeacher ? (
            <section className="content-card content-card--enterprise lesson-teacher-panel">
              <div className="section-head">
                <div>
                  <span className="eyebrow">Công cụ giảng viên</span>
                  <h2>Tải audio, đính kèm tài liệu và lưu nhiệm vụ học tập</h2>
                </div>
                <span className="pill">Chỉ dành cho giảng viên</span>
              </div>

              <div className="teacher-assignment-grid">
                <div className="lesson-upload-box">
                  <strong>Tải file audio</strong>
                  <p>Sử dụng mp3 / wav cho hoạt động nghe và luyện phát âm.</p>
                  <label className="upload-button">
                    Chọn audio
                    <input type="file" accept="audio/*" onChange={handleAudioUpload} />
                  </label>
                  <span className="upload-filename">{lessonAudio?.name || 'Chưa tải audio'}</span>
                </div>

                <div className="lesson-upload-box">
                  <strong>Đính kèm worksheet / PDF</strong>
                  <p>Thêm transcript, phiếu bài tập hoặc danh sách từ vựng.</p>
                  <label className="upload-button">
                    Chọn file
                    <input type="file" onChange={handleAttachmentUpload} />
                  </label>
                  <span className="upload-filename">{lessonFile?.name || 'Chưa tải tài liệu'}</span>
                </div>
              </div>

              <div className="teacher-assignment-grid">
                <div className="lesson-upload-box">
                  <strong>Phát hành cho học viên đã mua khóa</strong>
                  <p>Học viên đã mua khóa sẽ tự động nhận quyền truy cập bài học này.</p>
                  <button
                    type="button"
                    className={purchasedCourses.includes('english-foundation') ? 'answer-pill is-active' : 'answer-pill'}
                    onClick={() =>
                      setPurchasedCourses((previous) =>
                        previous.includes('english-foundation') ? previous : [...previous, 'english-foundation']
                      )
                    }
                  >
                    Tiếng Anh nền tảng A1-A2
                  </button>
                </div>

                <div className="lesson-upload-box">
                  <strong>Student view</strong>
                  <p>Xem nhanh học viên sẽ nhìn thấy bài học, học liệu và bài luyện như thế nào trước khi phát hành theo khóa.</p>
                  <button
                    type="button"
                    className="button"
                    onClick={() => setShowTeacherStudentView((value) => !value)}
                  >
                    {showTeacherStudentView ? 'Ẩn Student view' : 'Student view'}
                  </button>
                </div>
              </div>

              {showTeacherStudentView ? (
                <div className="student-view-preview">
                  <div className="section-head">
                    <div>
                      <span className="eyebrow">Student view</span>
                      <h3>Học viên đã mua khóa sẽ thấy bài học này</h3>
                    </div>
                    <span className="pill">Tiếng Anh nền tảng A1-A2</span>
                  </div>
                  <div className="lesson-upload-box">
                    <strong>{currentLesson.title}</strong>
                    <p>{currentLesson.note}</p>
                    <div className="lesson-notes-grid">
                      <article className="lesson-note-card">
                        <strong>File nghe</strong>
                        <p>{lessonAudio?.name || 'Audio sẽ hiển thị tại đây khi giảng viên tải lên.'}</p>
                      </article>
                      <article className="lesson-note-card">
                        <strong>Tài liệu</strong>
                        <p>{lessonFile?.name || 'Tài liệu sẽ hiển thị tại đây khi giảng viên đính kèm.'}</p>
                      </article>
                      <article className="lesson-note-card">
                        <strong>Bài luyện</strong>
                        <p>Học viên làm bài theo dạng bài giảng viên cấu hình trong lộ trình khóa.</p>
                      </article>
                    </div>
                  </div>
                </div>
              ) : null}

              <button type="button" className="button dashboard-submit" onClick={saveAssignmentToSupabase}>
                Lưu nhiệm vụ
              </button>
            </section>
          ) : null}

          <section className="content-card content-card--enterprise">
            <div className="section-head">
              <div>
                <span className="eyebrow">{isTeacher ? 'Bảng giao việc' : 'Nhiệm vụ của tôi'}</span>
                <h2>{isTeacher ? 'Nhiệm vụ đã lưu' : 'Bài học được giao'}</h2>
              </div>
              <span className="pill">{loadingAssignments ? 'Đang tải' : `${visibleAssignments.length} mục`}</span>
            </div>

            {visibleAssignments.length ? (
              <div className="assignment-list">
                {visibleAssignments.map((assignment) => (
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
                      <span>{assignment.recipients.length} học viên</span>
                      <span>{assignment.audioName || 'Chưa có audio'}</span>
                      <span>{assignment.attachmentName || 'Chưa có tài liệu'}</span>
                    </div>
                  </article>
                ))}
              </div>
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
