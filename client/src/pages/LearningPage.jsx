import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { getEffectiveRole } from '../lib/permissions';
import { createAssignment, getAssignmentsForStudent, getAssignmentsForTeacher, getCourseOptions } from '../lib/assignmentService';
import { PURCHASED_COURSES_STORAGE_KEY } from '../lib/courseService';

const lessons = [
  { id: 'lesson-1', title: 'Lesson 1. Introduction', status: 'done', note: 'Warm up + basic greetings' },
  { id: 'lesson-2', title: 'Lesson 2. Pronunciation', status: 'active', note: 'Main lesson with audio practice' },
  { id: 'lesson-3', title: 'Lesson 3. Small talk', status: 'locked', note: 'Unlock after receiving access' },
  { id: 'lesson-4', title: 'Lesson 4. Mini test', status: 'locked', note: 'Chapter quiz' }
];

const exerciseTabs = [
  { id: 'mcq', label: 'Multiple choice' },
  { id: 'tf', label: 'True / false' },
  { id: 'match', label: 'Matching' },
  { id: 'blank', label: 'Fill in the blank' },
  { id: 'flash', label: 'Flashcard' }
];

const matchingPairs = [
  { word: 'Apple', answer: 'Quả táo' },
  { word: 'Teacher', answer: 'Giáo viên' },
  { word: 'Practice', answer: 'Luyện tập' }
];

const demoStudents = [
  { email: 'minh@student.demo', label: 'Minh' },
  { email: 'linh@student.demo', label: 'Linh' },
  { email: 'tuan@student.demo', label: 'Tuấn' }
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

export default function LearningPage() {
  const auth = useAuth();
  const currentRole = getEffectiveRole(auth);
  const currentEmail = auth.user?.email || auth.profile?.full_name || 'demo@student.demo';

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
    const recipientEmails = demoStudents
      .filter((student) => allowedStudents.includes(student.email))
      .map((student) => student.email);

    await createAssignment({
      teacherId: auth.user?.id,
      assignment: {
        courseKey: 'english-foundation',
        courseTitle: 'English Foundation A1-A2',
        lessonTitle: currentLesson.title,
        title: `${currentLesson.title} learning pack`,
        description: currentLesson.note,
        assignmentScope: 'selected_students',
        audioName: audioMap[selectedLessonId]?.name || '',
        audioUrl: audioMap[selectedLessonId]?.url || '',
        attachmentName: fileMap[selectedLessonId]?.name || '',
        attachmentUrl: fileMap[selectedLessonId]?.url || ''
      },
      recipients: recipientEmails
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
            <span className="eyebrow">Learning room</span>
            <h2>Chapter 1. Greetings</h2>
            <p>A real teaching flow: teacher uploads, student receives, then learns in one continuous room.</p>
          </div>

          <div className="lesson-sidebar__progress">
            <div>
              <strong>Progress</strong>
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
                {lesson.status === 'done' ? 'OK' : lesson.status === 'active' ? 'IN' : '--'}
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
              <span className="eyebrow">Current lesson</span>
              <h1>{currentLesson.title}</h1>
              <p>{currentLesson.note}</p>

              <div className="learning-flow">
                <PracticeBadge title="1. Listen" text="Use uploaded audio or teacher-provided recording." />
                <PracticeBadge title="2. Practice" text="Transcript, notes, and vocabulary are shown below." />
                <PracticeBadge title="3. Submit" text="Teacher can assign to selected students or all buyers." />
              </div>
            </div>

            <div className="learning-hero__panel">
              <div className="learning-status">
                <span>Access</span>
                <strong>{hasLessonAccess ? 'Unlocked' : 'Locked'}</strong>
                <p>{hasLessonAccess ? 'You can study this lesson now.' : 'You need purchase or teacher access.'}</p>
              </div>

              <div className="learning-stat-grid">
                <article>
                  <span>Audio</span>
                  <strong>{lessonAudio ? 'Ready' : 'Missing'}</strong>
                </article>
                <article>
                  <span>Attachment</span>
                  <strong>{lessonFile ? 'Ready' : 'Missing'}</strong>
                </article>
                <article>
                  <span>Audience</span>
                  <strong>{allowedStudents.length}</strong>
                </article>
                <article>
                  <span>Tasks</span>
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
                    <span className="eyebrow">Lesson studio</span>
                    <h2>Everything students need in one place</h2>
                  </div>
                  <span className="pill">No embedded Drive frame</span>
                </div>

                <div className="learning-media__grid">
                  <div className="lesson-upload-box">
                    <strong>Audio lesson</strong>
                    <p>
                      {lessonAudio
                        ? `Uploaded file: ${lessonAudio.name}`
                        : 'No audio uploaded yet. Teacher can upload one below.'}
                    </p>
                    {lessonAudio?.url ? <audio controls src={lessonAudio.url} className="lesson-audio" /> : null}
                  </div>

                  <div className="lesson-upload-box">
                    <strong>Transcript / attachment</strong>
                    <p>
                      {lessonFile
                        ? `Attached file: ${lessonFile.name}`
                        : 'No attachment uploaded yet. Use this area for PDF, transcript, or worksheet.'}
                    </p>
                    {lessonFile?.url ? (
                      <a className="auth-link" href={lessonFile.url} download={lessonFile.name}>
                        Download attachment
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className="lesson-notes-grid">
                  <article className="lesson-note-card">
                    <strong>Transcript</strong>
                    <p>Teacher can paste or later sync transcript from PDF / audio processing.</p>
                  </article>
                  <article className="lesson-note-card">
                    <strong>Notes</strong>
                    <p>Call out pronunciation, key phrases, and what students should repeat aloud.</p>
                  </article>
                  <article className="lesson-note-card">
                    <strong>Homework</strong>
                    <p>Ask students to record a reply, submit answers, or complete the matching task.</p>
                  </article>
                </div>
              </section>

              <section className="content-card content-card--enterprise">
                <div className="section-head">
                  <div>
                    <span className="eyebrow">Exercises</span>
                    <h2>Practice modes for the lesson</h2>
                  </div>
                  <span className="pill">Interactive</span>
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
                      <h3>Multiple choice</h3>
                      <p>Which word best matches "hello"?</p>
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
                        {mcqAnswer ? `Selected: ${mcqAnswer}` : 'Choose one answer to see feedback.'}
                      </div>
                    </div>
                  ) : null}

                  {activeTab === 'tf' ? (
                    <div className="exercise-card">
                      <h3>True / false</h3>
                      <p>"Good morning" is used before noon.</p>
                      <div className="exercise-options">
                        {['True', 'False'].map((option) => (
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
                      <div className={tfAnswer === 'True' ? 'exercise-feedback success' : 'exercise-feedback'}>
                        {tfAnswer ? (tfAnswer === 'True' ? 'Correct — that is true.' : 'Not quite. It is true.') : 'Pick a statement.'}
                      </div>
                    </div>
                  ) : null}

                  {activeTab === 'match' ? (
                    <div className="exercise-card">
                      <h3>Matching</h3>
                      <p>Match the English word to the Vietnamese meaning.</p>
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
                              <option value="">Choose meaning</option>
                              {matchingPairs.map((pair) => (
                                <option key={pair.answer} value={pair.answer}>
                                  {pair.answer}
                                </option>
                              ))}
                            </select>
                          </label>
                        ))}
                      </div>
                      <div className="exercise-feedback">{matchAnswers.filter(Boolean).length}/3 pairs selected.</div>
                    </div>
                  ) : null}

                  {activeTab === 'blank' ? (
                    <div className="exercise-card">
                      <h3>Fill in the blank</h3>
                      <p>Hello, my name ____ Linh.</p>
                      <input
                        type="text"
                        value={blankAnswer}
                        onChange={(event) => setBlankAnswer(event.target.value)}
                        placeholder="Type your answer"
                        className="lesson-input"
                      />
                      <div className={blankAnswer.trim().toLowerCase() === 'is' ? 'exercise-feedback success' : 'exercise-feedback'}>
                        {blankAnswer
                          ? blankAnswer.trim().toLowerCase() === 'is'
                            ? 'Correct — "is" fits here.'
                            : 'Try again. Hint: use a form of "to be".'
                          : 'Type your answer to check it.'}
                      </div>
                    </div>
                  ) : null}

                  {activeTab === 'flash' ? (
                    <div className="exercise-card">
                      <h3>Flashcard</h3>
                      <button type="button" className="flashcard" onClick={() => setFlashFlip((value) => !value)}>
                        <span>{flashFlip ? 'Xin chào = Hello' : 'Hello'}</span>
                        <small>{flashFlip ? 'Tap to flip back' : 'Tap to reveal translation'}</small>
                      </button>
                    </div>
                  ) : null}
                </div>
              </section>
            </>
          ) : (
            <section className="content-card content-card--enterprise lesson-lock">
              <span className="eyebrow">Access control</span>
              <h2>You have no access to this lesson yet.</h2>
              <p>Students can only receive lesson materials if they either bought the course or were explicitly selected by the teacher.</p>
              <div className="lesson-lock__chips">
                <span className="pill">Purchased course required</span>
                <span className="pill">Teacher selection required</span>
              </div>
            </section>
          )}

          {isTeacher ? (
            <section className="content-card content-card--enterprise lesson-teacher-panel">
              <div className="section-head">
                <div>
                  <span className="eyebrow">Teacher tools</span>
                  <h2>Upload audio, attachment, and save assignment</h2>
                </div>
                <span className="pill">Teacher only</span>
              </div>

              <div className="teacher-assignment-grid">
                <div className="lesson-upload-box">
                  <strong>Upload audio file</strong>
                  <p>Use mp3 / wav for listening tasks.</p>
                  <label className="upload-button">
                    Choose audio
                    <input type="file" accept="audio/*" onChange={handleAudioUpload} />
                  </label>
                  <span className="upload-filename">{lessonAudio?.name || 'No audio uploaded yet'}</span>
                </div>

                <div className="lesson-upload-box">
                  <strong>Attach worksheet / PDF</strong>
                  <p>Add transcript, quiz sheet, or vocabulary list.</p>
                  <label className="upload-button">
                    Choose file
                    <input type="file" onChange={handleAttachmentUpload} />
                  </label>
                  <span className="upload-filename">{lessonFile?.name || 'No file uploaded yet'}</span>
                </div>
              </div>

              <div className="teacher-assignment-grid">
                <div className="lesson-upload-box">
                  <strong>Publish to course buyers</strong>
                  <p>Students who bought the course receive this lesson automatically.</p>
                  <button
                    type="button"
                    className={purchasedCourses.includes('english-foundation') ? 'answer-pill is-active' : 'answer-pill'}
                    onClick={() =>
                      setPurchasedCourses((previous) =>
                        previous.includes('english-foundation') ? previous : [...previous, 'english-foundation']
                      )
                    }
                  >
                    English Foundation A1-A2
                  </button>
                </div>

                <div className="lesson-upload-box">
                  <strong>Send to selected students</strong>
                  <div className="teacher-recipient-list">
                    {demoStudents.map((student) => (
                      <label key={student.email} className="teacher-recipient">
                        <input
                          type="checkbox"
                          checked={allowedStudents.includes(student.email)}
                          onChange={() => toggleRecipient(student.email)}
                        />
                        <span>
                          {student.label}
                          <small>{student.email}</small>
                        </span>
                      </label>
                    ))}
                  </div>

                  <div className="teacher-recipient-actions">
                    <select value={selectedStudentEmail} onChange={(event) => setSelectedStudentEmail(event.target.value)}>
                      {demoStudents.map((student) => (
                        <option key={student.email} value={student.email}>
                          {student.label}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="button" onClick={publishAccessToSelected}>
                      Grant access
                    </button>
                  </div>
                </div>
              </div>

              <button type="button" className="button dashboard-submit" onClick={saveAssignmentToSupabase}>
                Save assignment to Supabase
              </button>
            </section>
          ) : null}

          <section className="content-card content-card--enterprise">
            <div className="section-head">
              <div>
                <span className="eyebrow">{isTeacher ? 'Teacher feed' : 'My assignments'}</span>
                <h2>{isTeacher ? 'Saved assignments' : 'Your assigned lessons'}</h2>
              </div>
              <span className="pill">{loadingAssignments ? 'Loading' : `${visibleAssignments.length} items`}</span>
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
                        {assignment.assignmentScope === 'course_buyers' ? 'Course buyers' : 'Selected students'}
                      </span>
                    </div>
                    {assignment.description ? <p className="assignment-card__description">{assignment.description}</p> : null}
                    <div className="assignment-card__meta">
                      <span>{assignment.recipients.length} student(s)</span>
                      <span>{assignment.audioName || 'No audio'}</span>
                      <span>{assignment.attachmentName || 'No attachment'}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-state">
                {isTeacher ? 'No assignments have been saved yet.' : 'No assignment has been granted to your account yet.'}
              </p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
