import { getStoredPurchasedCourseIds, readAllTeacherManagedCourses, readTeacherManagedCourses } from './courseService';
import { isSupabaseReady, supabase } from './supabase';
import { apiFetch } from './api';

export const assignmentFallbackCourses = [
  { key: 'english-foundation', title: 'Tiếng Anh nền tảng A1-A2' },
  { key: 'business-communication', title: 'Giao tiếp doanh nghiệp' },
  { key: 'ielts-boost', title: 'Tăng tốc IELTS chuyên sâu' }
];

function normalizeRecipients(recipients = []) {
  return recipients.map((recipient) => ({
    studentEmail: recipient.student_email || recipient.studentEmail || ''
  }));
}

function normalizeExerciseConfig(config) {
  if (!config) {
    return {};
  }

  if (typeof config === 'string') {
    try {
      return JSON.parse(config);
    } catch {
      return {};
    }
  }

  return config;
}

function isMissingExerciseConfigColumn(error) {
  return /exercise_config/i.test(error?.message || '');
}

function isMissingAssignmentAttemptsTable(error) {
  return /lesson_assignment_attempts/i.test(error?.message || '');
}

function normalizeCourseIds(courseIds = []) {
  return new Set((courseIds || []).map((courseId) => String(courseId).toLowerCase()).filter(Boolean));
}

function isVisibleToStudent(assignment, normalizedEmail, ownedCourseIds) {
  if (assignment.assignmentScope === 'course_buyers') {
    return ownedCourseIds.has(String(assignment.courseKey || '').toLowerCase());
  }

  return assignment.recipients.some(
    (recipient) => recipient.studentEmail.toLowerCase() === normalizedEmail
  );
}

function readStoredAttempts(studentKey) {
  try {
    const rawValue = localStorage.getItem(`learning-assignment-attempts:${studentKey || 'local'}`);
    return rawValue ? JSON.parse(rawValue) : {};
  } catch {
    return {};
  }
}

function writeStoredAttempts(studentKey, attemptsByAssignment) {
  try {
    localStorage.setItem(
      `learning-assignment-attempts:${studentKey || 'local'}`,
      JSON.stringify(attemptsByAssignment)
    );
  } catch {
    // ignore storage failures
  }
}

const assignmentSelectBase = `
  id,
  teacher_id,
  course_key,
  course_title,
  lesson_title,
  title,
  description,
  assignment_scope,
  audio_name,
  audio_url,
  attachment_name,
  attachment_url,
  created_at,
  recipients:lesson_assignment_recipients(student_email)
`;

const assignmentSelectWithExercise = `
  id,
  teacher_id,
  course_key,
  course_title,
  lesson_title,
  title,
  description,
  assignment_scope,
  audio_name,
  audio_url,
  attachment_name,
  attachment_url,
  exercise_config,
  created_at,
  recipients:lesson_assignment_recipients(student_email)
`;

function normalizeAssignment(item) {
  return {
    id: item.id,
    teacherId: item.teacher_id,
    courseKey: item.course_key,
    courseTitle: item.course_title,
    lessonTitle: item.lesson_title,
    title: item.title,
    description: item.description || '',
    assignmentScope: item.assignment_scope || 'selected_students',
    audioName: item.audio_name || '',
    audioUrl: item.audio_url || '',
    attachmentName: item.attachment_name || '',
    attachmentUrl: item.attachment_url || '',
    exerciseConfig: normalizeExerciseConfig(item.exercise_config || item.exerciseConfig),
    createdAt: item.created_at,
    recipients: normalizeRecipients(item.recipients)
  };
}

function normalizeAssignmentAttempt(item) {
  return {
    id: item.id || item.assignmentId,
    assignmentId: item.assignment_id || item.assignmentId,
    studentId: item.student_id || item.studentId || '',
    studentEmail: item.student_email || item.studentEmail || '',
    answers: item.answers || {},
    score: Number(item.score || 0),
    maxScore: Number(item.max_score || item.maxScore || 0),
    submittedAt: item.submitted_at || item.submittedAt || ''
  };
}

async function selectAssignments(createQuery, includeExerciseConfig = true) {
  const query = createQuery(includeExerciseConfig ? assignmentSelectWithExercise : assignmentSelectBase);
  const { data, error } = await query.order('created_at', { ascending: false });

  if (error && includeExerciseConfig && isMissingExerciseConfigColumn(error)) {
    return selectAssignments(createQuery, false);
  }

  return { data, error };
}

export async function getAssignmentsForTeacher(teacherId) {
  if (!isSupabaseReady() || !teacherId) {
    return [];
  }

  const { data, error } = await selectAssignments(
    (fields) => supabase.from('lesson_assignments').select(fields).eq('teacher_id', teacherId)
  );

  if (error || !data) {
    return [];
  }

  return data.map(normalizeAssignment);
}

export async function getAssignmentsForStudent(studentEmail, ownedCourseIds = getStoredPurchasedCourseIds()) {
  if (!isSupabaseReady() || !studentEmail) {
    return [];
  }

  const { data, error } = await selectAssignments((fields) => supabase.from('lesson_assignments').select(fields));

  if (error || !data) {
    return [];
  }

  const normalizedEmail = studentEmail.toLowerCase();
  const ownedCourseIdSet = normalizeCourseIds(ownedCourseIds);

  return data
    .map(normalizeAssignment)
    .filter((assignment) => isVisibleToStudent(assignment, normalizedEmail, ownedCourseIdSet));
}

export async function createAssignment({ teacherId, assignment, recipients, accessToken } = {}) {
  // Nếu có accessToken (người dùng đã xác thực), gọi endpoint server dùng service role
  if (accessToken) {
    const payload = { teacherId, assignment, recipients };
    const result = await apiFetch('/api/assignments', { method: 'POST', token: accessToken, body: payload });
    return result?.id;
  }

  if (!isSupabaseReady() || !teacherId) {
    throw new Error('Hệ thống chưa sẵn sàng.');
  }

  const payload = {
    teacher_id: teacherId,
    course_key: assignment.courseKey,
    course_title: assignment.courseTitle,
    lesson_title: assignment.lessonTitle,
    title: assignment.title,
    description: assignment.description,
    assignment_scope: assignment.assignmentScope,
    audio_name: assignment.audioName,
    audio_url: assignment.audioUrl,
    attachment_name: assignment.attachmentName,
    attachment_url: assignment.attachmentUrl,
    exercise_config: assignment.exerciseConfig || {}
  };

  let { data: created, error: createError } = await supabase
    .from('lesson_assignments')
    .insert(payload)
    .select('id')
    .single();

  if (createError && isMissingExerciseConfigColumn(createError)) {
    const { exercise_config: _exerciseConfig, ...fallbackPayload } = payload;
    const fallbackResult = await supabase
      .from('lesson_assignments')
      .insert(fallbackPayload)
      .select('id')
      .single();

    created = fallbackResult.data;
    createError = fallbackResult.error;
  }

  if (createError) {
    throw createError;
  }

  if (assignment.assignmentScope === 'selected_students' && recipients.length) {
    const recipientRows = recipients
      .map((recipient) => recipient.trim().toLowerCase())
      .filter(Boolean)
      .map((studentEmail) => ({
        assignment_id: created.id,
        student_email: studentEmail
      }));

    if (recipientRows.length) {
      const { error: recipientError } = await supabase
        .from('lesson_assignment_recipients')
        .insert(recipientRows);

      if (recipientError) {
        throw recipientError;
      }
    }
  }

  return created.id;
}

function normalizeCourseOption(course) {
  const key = String(course?.key || course?.id || course?.slug || course?.databaseId || '').trim();
  const title = String(course?.title || course?.name || course?.summary || '').trim();

  if (!key || !title) {
    return null;
  }

  return { key, title };
}

function dedupeCourseOptions(courses = []) {
  const seen = new Set();

  return (Array.isArray(courses) ? courses : []).filter((course) => {
    const key = String(course?.key || '').trim();
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function getCourseOptions(teacherId = '') {
  const managedCourses = teacherId
    ? readTeacherManagedCourses(teacherId)
    : readAllTeacherManagedCourses();

  const managedOptions = dedupeCourseOptions(
    managedCourses
      .map(normalizeCourseOption)
      .filter(Boolean)
  );

  const fallbackOptions = dedupeCourseOptions(
    assignmentFallbackCourses
      .map(normalizeCourseOption)
      .filter(Boolean)
  );

  return dedupeCourseOptions([...managedOptions, ...fallbackOptions]);
}

export async function getAssignmentAttemptsForStudent(studentId, studentEmail) {
  const studentKey = studentId || studentEmail || 'local';
  const storedAttempts = readStoredAttempts(studentKey);

  if (!isSupabaseReady() || !studentId) {
    return Object.values(storedAttempts).map(normalizeAssignmentAttempt);
  }

  const { data, error } = await supabase
    .from('lesson_assignment_attempts')
    .select('id, assignment_id, student_id, student_email, answers, score, max_score, submitted_at')
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false });

  if (error) {
    if (!isMissingAssignmentAttemptsTable(error)) {
      console.warn('Unable to load assignment attempts.', error);
    }
    return Object.values(storedAttempts).map(normalizeAssignmentAttempt);
  }

  return (data || []).map(normalizeAssignmentAttempt);
}

export async function saveAssignmentAttempt({
  assignmentId,
  studentId,
  studentEmail,
  answers,
  score,
  maxScore
}) {
  const submittedAt = new Date().toISOString();
  const studentKey = studentId || studentEmail || 'local';
  const localAttempt = {
    id: assignmentId,
    assignmentId,
    studentId: studentId || '',
    studentEmail: studentEmail || '',
    answers,
    score,
    maxScore,
    submittedAt
  };

  const storedAttempts = readStoredAttempts(studentKey);
  writeStoredAttempts(studentKey, {
    ...storedAttempts,
    [assignmentId]: localAttempt
  });

  if (!isSupabaseReady() || !studentId) {
    return localAttempt;
  }

  const { data, error } = await supabase
    .from('lesson_assignment_attempts')
    .upsert(
      {
        assignment_id: assignmentId,
        student_id: studentId,
        student_email: studentEmail || '',
        answers,
        score,
        max_score: maxScore,
        submitted_at: submittedAt
      },
      { onConflict: 'assignment_id,student_id' }
    )
    .select('id, assignment_id, student_id, student_email, answers, score, max_score, submitted_at')
    .single();

  if (error) {
    if (!isMissingAssignmentAttemptsTable(error)) {
      console.warn('Unable to save assignment attempt.', error);
    }
    return localAttempt;
  }

  return normalizeAssignmentAttempt(data);
}
