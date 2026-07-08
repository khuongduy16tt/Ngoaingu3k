import { isSupabaseReady, supabase } from './supabase';

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

export async function getAssignmentsForStudent(studentEmail) {
  if (!isSupabaseReady() || !studentEmail) {
    return [];
  }

  const { data, error } = await selectAssignments((fields) => supabase.from('lesson_assignments').select(fields));

  if (error || !data) {
    return [];
  }

  const normalizedEmail = studentEmail.toLowerCase();

  return data
    .map(normalizeAssignment)
    .filter(
      (assignment) =>
        assignment.assignmentScope === 'course_buyers' ||
        assignment.recipients.some((recipient) => recipient.studentEmail.toLowerCase() === normalizedEmail)
    );
}

export async function createAssignment({ teacherId, assignment, recipients }) {
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

export function getCourseOptions() {
  return assignmentFallbackCourses;
}
