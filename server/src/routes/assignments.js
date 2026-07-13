import { Router } from 'express';
import { supabaseAdmin, isSupabaseAdminReady } from '../config/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Chỉ giáo viên và admin mới được phép giao bài qua API này
router.use(requireAuth, requireRole('teacher', 'admin'));

router.post('/', async (req, res) => {
  if (!isSupabaseAdminReady()) {
    return res.status(503).json({ message: 'Server chưa cấu hình Supabase service role.' });
  }

  const { teacherId, assignment, recipients } = req.body || {};

  if (!teacherId || !assignment) {
    return res.status(400).json({ message: 'Thiếu dữ liệu giao bài.' });
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

  try {
    const { data, error } = await supabaseAdmin
      .from('lesson_assignments')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    const createdId = data?.id;

    if (assignment.assignmentScope === 'selected_students' && Array.isArray(recipients) && recipients.length) {
      const recipientRows = recipients
        .map((r) => String(r || '').trim().toLowerCase())
        .filter(Boolean)
        .map((studentEmail) => ({ assignment_id: createdId, student_email: studentEmail }));

      if (recipientRows.length) {
        const { error: recipientError } = await supabaseAdmin
          .from('lesson_assignment_recipients')
          .insert(recipientRows);

        if (recipientError) {
          throw recipientError;
        }
      }
    }

    return res.json({ id: createdId });
  } catch (err) {
    console.error('[POST /api/assignments]', err?.message || err);
    return res.status(500).json({ message: err?.message || 'Không thể tạo giao bài.' });
  }
});

export default router;
