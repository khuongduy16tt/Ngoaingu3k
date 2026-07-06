import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { getEffectiveRole } from '../lib/permissions';
import { createAssignment, getAssignmentsForStudent, getAssignmentsForTeacher, getCourseOptions } from '../lib/assignmentService';
import { getCourseCatalog, getOwnedCourseIds } from '../lib/courseService';

function DashboardShell({ title, description, metrics, children }) {
  return (
    <div className="page">
      <section className="dashboard-head">
        <div>
          <span className="eyebrow">Dashboard</span>
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
  return (
    <article className="content-card content-card--enterprise assignment-card">
      <div className="assignment-card__head">
        <div>
          <span className="eyebrow">{assignment.courseTitle}</span>
          <h3>{assignment.title}</h3>
          <p>{assignment.lessonTitle}</p>
        </div>
        <span className="pill">{assignment.assignmentScope === 'course_buyers' ? 'Course buyers' : 'Selected students'}</span>
      </div>
      {assignment.description ? <p className="assignment-card__description">{assignment.description}</p> : null}
      <div className="assignment-card__meta">
        <span>{assignment.recipients.length} student(s)</span>
        <span>{assignment.audioName || 'No audio'}</span>
        <span>{assignment.attachmentName || 'No attachment'}</span>
      </div>
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
      { label: 'Courses owned', value: String(ownedCount) },
      { label: 'Available tasks', value: String(assignments.length) },
      { label: 'Average score', value: '89' },
      { label: 'Study streak', value: '12 days' }
    ],
    [assignments.length, ownedCount]
  );

  return (
    <DashboardShell
      title="Dashboard"
      description="Purchased courses, assigned lessons, grades, and certificate tracking."
      metrics={metrics}
    >
      <section className="section split-layout">
        <div className="content-card content-card--enterprise">
          <h2>Your assigned lessons</h2>
          {loading ? <p>Loading assignments...</p> : null}
          {!loading && assignments.length === 0 ? (
            <p className="empty-state">No assignments yet. Ask your teacher to grant access.</p>
          ) : null}
          <div className="assignment-list">
            {assignments.map((assignment) => (
              <AssignmentCard key={assignment.id} assignment={assignment} />
            ))}
          </div>
        </div>

        <div className="content-card content-card--enterprise">
          <h2>Access rules</h2>
          <ul className="plain-list">
            <li>Students see only lessons assigned to their email.</li>
            <li>Course-buyers see buyer-only lessons if enabled by teacher.</li>
            <li>Audio and attachments are prepared by the teacher.</li>
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
  const [recipientInput, setRecipientInput] = useState('minh@student.demo, linh@student.demo');
  const [form, setForm] = useState({
    courseKey: courses[0]?.key || 'english-foundation',
    courseTitle: courses[0]?.title || 'English Foundation A1-A2',
    lessonTitle: 'Lesson 2. Pronunciation',
    title: 'Pronunciation task',
    description: 'Upload the audio, then deliver the listening activity to selected students.',
    assignmentScope: 'selected_students',
    audioName: 'sample-audio.mp3',
    audioUrl: 'https://example.com/sample-audio.mp3',
    attachmentName: 'worksheet.pdf',
    attachmentUrl: 'https://example.com/worksheet.pdf'
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

  async function handleCreateAssignment(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!teacherId) {
      setError('Missing teacher account.');
      return;
    }

    setSaving(true);
    try {
      const recipientEmails = recipientInput
        .split(/[\n,;]/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);

      await createAssignment({
        teacherId,
        assignment: form,
        recipients: recipientEmails
      });

      const nextAssignments = await getAssignmentsForTeacher(teacherId);
      setAssignments(nextAssignments);
      setSuccess('Assignment saved to Supabase successfully.');
    } catch (submissionError) {
      setError(submissionError.message || 'Could not save assignment.');
    } finally {
      setSaving(false);
    }
  }

  const metrics = useMemo(
    () => [
      { label: 'Active courses', value: String(courses.length || 0) },
      { label: 'Assignments', value: String(assignments.length) },
      { label: 'Recipients', value: assignments.reduce((sum, assignment) => sum + assignment.recipients.length, 0).toString() },
      { label: 'Saved in DB', value: 'Yes' }
    ],
    [assignments, courses.length]
  );

  return (
    <DashboardShell
      title="Dashboard"
      description="Create assignments, upload lesson files, and deliver them to selected students."
      metrics={metrics}
    >
      <section className="section split-layout">
        <form className="content-card content-card--enterprise dashboard-form" onSubmit={handleCreateAssignment}>
          <div className="section-head">
            <div>
              <span className="eyebrow">Assignment manager</span>
              <h2>Create lesson assignment</h2>
            </div>
            <span className="pill">Supabase ready</span>
          </div>

          {error ? <div className="auth-message">{error}</div> : null}
          {success ? <div className="auth-message auth-message--success">{success}</div> : null}

          <div className="dashboard-form__grid">
            <label className="auth-field">
              <span>Course</span>
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
              <span>Assignment scope</span>
              <select
                value={form.assignmentScope}
                onChange={(event) => setForm((previous) => ({ ...previous, assignmentScope: event.target.value }))}
              >
                <option value="selected_students">Selected students</option>
                <option value="course_buyers">Course buyers</option>
              </select>
            </label>

            <label className="auth-field">
              <span>Lesson title</span>
              <input
                value={form.lessonTitle}
                onChange={(event) => setForm((previous) => ({ ...previous, lessonTitle: event.target.value }))}
                placeholder="Lesson 2. Pronunciation"
              />
            </label>

            <label className="auth-field">
              <span>Assignment title</span>
              <input
                value={form.title}
                onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))}
                placeholder="Pronunciation task"
              />
            </label>

            <label className="auth-field auth-field--full">
              <span>Description</span>
              <textarea
                rows="4"
                value={form.description}
                onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
                placeholder="Describe what students should do..."
              />
            </label>

            <label className="auth-field">
              <span>Audio file name</span>
              <input
                value={form.audioName}
                onChange={(event) => setForm((previous) => ({ ...previous, audioName: event.target.value }))}
                placeholder="lesson-audio.mp3"
              />
            </label>

            <label className="auth-field">
              <span>Audio URL</span>
              <input
                value={form.audioUrl}
                onChange={(event) => setForm((previous) => ({ ...previous, audioUrl: event.target.value }))}
                placeholder="https://..."
              />
            </label>

            <label className="auth-field">
              <span>Attachment file name</span>
              <input
                value={form.attachmentName}
                onChange={(event) => setForm((previous) => ({ ...previous, attachmentName: event.target.value }))}
                placeholder="worksheet.pdf"
              />
            </label>

            <label className="auth-field">
              <span>Attachment URL</span>
              <input
                value={form.attachmentUrl}
                onChange={(event) => setForm((previous) => ({ ...previous, attachmentUrl: event.target.value }))}
                placeholder="https://..."
              />
            </label>

            <label className="auth-field auth-field--full">
              <span>Student emails, separated by comma</span>
              <textarea
                rows="3"
                value={recipientInput}
                onChange={(event) => setRecipientInput(event.target.value)}
                placeholder="minh@student.demo, linh@student.demo"
              />
            </label>
          </div>

          <button type="submit" className="button dashboard-submit" disabled={saving || !teacherId}>
            {saving ? 'Saving...' : 'Save to Supabase'}
          </button>
        </form>

        <div className="content-card content-card--enterprise">
          <div className="section-head">
            <div>
              <span className="eyebrow">Saved assignments</span>
              <h2>What you have already delivered</h2>
            </div>
            <span className="pill">{loading ? 'Loading' : `${assignments.length} items`}</span>
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
      title="Dashboard"
      description="Users, approvals, payments, and platform analytics."
      metrics={[
        { label: 'Users', value: '12,480' },
        { label: 'Revenue', value: '$128k' },
        { label: 'Transactions', value: '1,248' },
        { label: 'Approval queue', value: '6' }
      ]}
    >
      <section className="section split-layout">
        <div className="content-card content-card--enterprise">
          <h2>Platform controls</h2>
          <ul className="plain-list">
            <li>Approve teacher courses and assignments</li>
            <li>Monitor student enrollment and payments</li>
            <li>Audit access to learning materials</li>
          </ul>
        </div>

        <div className="content-card content-card--enterprise">
          <h2>Next integration points</h2>
          <ul className="plain-list">
            <li>Database persistence</li>
            <li>JWT auth and refresh tokens</li>
            <li>Realtime progress tracking</li>
          </ul>
        </div>
      </section>
    </DashboardShell>
  );
}
