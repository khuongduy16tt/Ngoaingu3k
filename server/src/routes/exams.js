import { Router } from 'express';
import { supabaseAdmin, isSupabaseAdminReady } from '../config/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Chỉ giáo viên và admin được quản lý đề thi qua API này.
router.use(requireAuth, requireRole('teacher', 'admin'));

function buildExamPayload(exam = {}) {
  const payload = {};

  if (exam.title !== undefined) payload.title = exam.title;
  if (exam.description !== undefined) payload.description = exam.description;
  if (exam.courseKey !== undefined) payload.course_key = exam.courseKey;
  if (exam.assignmentScope !== undefined) payload.assignment_scope = exam.assignmentScope;
  if (exam.status !== undefined) payload.status = exam.status;
  if (exam.sections !== undefined) payload.sections = exam.sections;

  return payload;
}

async function replaceRecipients(examId, scope, recipients) {
  if (!Array.isArray(recipients)) {
    return;
  }

  const { error: deleteError } = await supabaseAdmin
    .from('exam_recipients')
    .delete()
    .eq('exam_id', examId);

  if (deleteError) {
    throw deleteError;
  }

  if (scope !== 'selected_students') {
    return;
  }

  const recipientRows = recipients
    .map((email) => String(email || '').trim().toLowerCase())
    .filter(Boolean)
    .map((studentEmail) => ({ exam_id: examId, student_email: studentEmail }));

  if (recipientRows.length) {
    const { error: insertError } = await supabaseAdmin.from('exam_recipients').insert(recipientRows);

    if (insertError) {
      throw insertError;
    }
  }
}

async function assertExamAccess(req, examId) {
  const { data: exam, error } = await supabaseAdmin
    .from('exams')
    .select('id, teacher_id, assignment_scope')
    .eq('id', examId)
    .maybeSingle();

  if (error || !exam) {
    return { exam: null, status: 404, message: 'Không tìm thấy đề thi.' };
  }

  if (req.user.role !== 'admin' && exam.teacher_id !== req.user.id) {
    return { exam: null, status: 403, message: 'Bạn không có quyền với đề thi này.' };
  }

  return { exam };
}

router.post('/', async (req, res) => {
  if (!isSupabaseAdminReady()) {
    return res.status(503).json({ message: 'Server chưa cấu hình Supabase service role.' });
  }

  const { teacherId, exam, recipients } = req.body || {};

  if (!teacherId || !exam?.title) {
    return res.status(400).json({ message: 'Thiếu dữ liệu đề thi.' });
  }

  if (req.user.role !== 'admin' && teacherId !== req.user.id) {
    return res.status(403).json({ message: 'Bạn chỉ có thể tạo đề thi cho chính mình.' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('exams')
      .insert({ teacher_id: teacherId, ...buildExamPayload(exam) })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    await replaceRecipients(data.id, exam.assignmentScope, recipients);

    return res.json({ id: data.id });
  } catch (err) {
    console.error('[POST /api/exams]', err?.message || err);
    return res.status(500).json({ message: err?.message || 'Không thể tạo đề thi.' });
  }
});

router.put('/:examId', async (req, res) => {
  if (!isSupabaseAdminReady()) {
    return res.status(503).json({ message: 'Server chưa cấu hình Supabase service role.' });
  }

  const { examId } = req.params;
  const { exam, recipients } = req.body || {};

  if (!exam || typeof exam !== 'object') {
    return res.status(400).json({ message: 'Thiếu dữ liệu cập nhật đề thi.' });
  }

  try {
    const access = await assertExamAccess(req, examId);
    if (!access.exam) {
      return res.status(access.status).json({ message: access.message });
    }

    const payload = buildExamPayload(exam);

    if (Object.keys(payload).length) {
      const { error } = await supabaseAdmin
        .from('exams')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', examId);

      if (error) {
        throw error;
      }
    }

    if (recipients !== undefined) {
      await replaceRecipients(
        examId,
        exam.assignmentScope || access.exam.assignment_scope,
        recipients
      );
    }

    return res.json({ id: examId });
  } catch (err) {
    console.error('[PUT /api/exams/:examId]', err?.message || err);
    return res.status(500).json({ message: err?.message || 'Không thể cập nhật đề thi.' });
  }
});

router.delete('/:examId', async (req, res) => {
  if (!isSupabaseAdminReady()) {
    return res.status(503).json({ message: 'Server chưa cấu hình Supabase service role.' });
  }

  const { examId } = req.params;

  try {
    const access = await assertExamAccess(req, examId);
    if (!access.exam) {
      return res.status(access.status).json({ message: access.message });
    }

    const { error } = await supabaseAdmin.from('exams').delete().eq('id', examId);

    if (error) {
      throw error;
    }

    return res.json({ id: examId });
  } catch (err) {
    console.error('[DELETE /api/exams/:examId]', err?.message || err);
    return res.status(500).json({ message: err?.message || 'Không thể xóa đề thi.' });
  }
});

export default router;
