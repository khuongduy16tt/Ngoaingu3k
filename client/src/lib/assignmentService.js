import { isSupabaseReady, supabase } from './supabase';

export const assignmentFallbackCourses = [
  { key: 'english-foundation', title: 'English Foundation A1-A2' },
  { key: 'business-communication', title: 'Business Communication' },
  { key: 'ielts-boost', title: 'IELTS Boost Sprint' }
];

function normalizeRecipients(recipients = []) {
  return recipients.map((recipient) => ({
    studentEmail: recipient.student_email || recipient.studentEmail || ''
  }));
}

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
    createdAt: item.created_at,
    recipients: normalizeRecipients(item.recipients)
  };
}

export async function getAssignmentsForTeacher(teacherId) {
  if (!isSupabaseReady() || !teacherId) {
    return [];
  }

  const { data, error } = await supabase
    .from('lesson_assignments')
    .select(
      `
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
      `
    )
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map(normalizeAssignment);
}

export async function getAssignmentsForStudent(studentEmail) {
  if (!isSupabaseReady() || !studentEmail) {
    return [];
  }

  const { data, error } = await supabase
    .from('lesson_assignments')
    .select(
      `
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
      `
    )
    .order('created_at', { ascending: false });

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
    throw new Error('Supabase is not ready.');
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
    attachment_url: assignment.attachmentUrl
  };

  const { data: created, error: createError } = await supabase
    .from('lesson_assignments')
    .insert(payload)
    .select('id')
    .single();

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
