import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  EXAM_QUESTION_TYPES,
  EXAM_SECTION_TYPES,
  createExam,
  deleteExam,
  getExamAttemptsForExams,
  getExamsForTeacher,
  getSectionTypeLabel,
  normalizeExamSection,
  setExamStatus,
  updateExam
} from '../../lib/examService';
import { uploadExamAudio, uploadExamImage } from '../../lib/storageService';
import { getCourseOptions } from '../../lib/assignmentService';
import { PaginationControls, usePagination } from '../../components/Pagination';
import { AudioUploadField } from '../../components/AudioUploadField';
import { ImageUploadField } from '../../components/ImageUploadField';

const DRAFT_STORAGE_KEY = 'ngoaingu3k-exam-draft';
const DRAFT_AUTOSAVE_MS = 600;

function createEmptyQuestion() {
  return {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'multiple_choice',
    prompt: '',
    imageUrl: '',
    imageName: '',
    optionsText: '',
    correctAnswer: '',
    acceptedAnswersText: '',
    pairsText: '',
    explanation: ''
  };
}

function createEmptySection(type = 'listening') {
  return {
    id: `section-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    title: type === 'listening' ? 'Phần nghe' : 'Phần đọc',
    durationMinutes: type === 'listening' ? 30 : 45,
    audioUrl: '',
    audioName: '',
    passage: '',
    questions: [createEmptyQuestion()]
  };
}

function createEmptyDraft() {
  return {
    id: '',
    title: '',
    description: '',
    assignmentScope: 'selected_students',
    courseKey: '',
    recipientsText: '',
    status: 'draft',
    sections: [createEmptySection('listening'), createEmptySection('reading')]
  };
}

// ─── Tự động lưu bản nháp đang soạn ──────────────────────────────────────────
// Trình soạn đề trước đây chỉ giữ draft trong state React, nên đóng tab / thoát
// trình duyệt giữa chừng là mất sạch. Bản nháp giờ được ghi xuống localStorage
// theo từng giáo viên và hỏi khôi phục khi quay lại.

function getDraftStorageKey(teacherId) {
  return `${DRAFT_STORAGE_KEY}:${teacherId || 'local'}`;
}

function isFilled(value) {
  return String(value || '').trim() !== '';
}

// Chỉ coi là "có bản nháp" khi giáo viên đã nhập gì đó — tránh hỏi khôi phục
// cho một form trống vừa mở rồi thoát.
function hasDraftContent(draft) {
  if (!draft || !Array.isArray(draft.sections)) {
    return false;
  }

  if (isFilled(draft.title) || isFilled(draft.description) || isFilled(draft.recipientsText) || isFilled(draft.courseKey)) {
    return true;
  }

  return draft.sections.some(
    (section) =>
      isFilled(section?.audioUrl) ||
      isFilled(section?.passage) ||
      (Array.isArray(section?.questions) &&
        section.questions.some(
          (question) =>
            isFilled(question?.prompt) ||
            isFilled(question?.imageUrl) ||
            isFilled(question?.optionsText) ||
            isFilled(question?.acceptedAnswersText) ||
            isFilled(question?.pairsText) ||
            isFilled(question?.explanation)
        ))
  );
}

function readStoredDraft(teacherId) {
  try {
    const rawValue = localStorage.getItem(getDraftStorageKey(teacherId));
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue);
    return hasDraftContent(parsed?.draft) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredDraft(teacherId, draft) {
  try {
    localStorage.setItem(
      getDraftStorageKey(teacherId),
      JSON.stringify({ draft, savedAt: new Date().toISOString() })
    );
    return true;
  } catch {
    // Hết quota — thường do ảnh/audio nhúng dạng data URL khi chạy mock mode.
    return false;
  }
}

function clearStoredDraft(teacherId) {
  try {
    localStorage.removeItem(getDraftStorageKey(teacherId));
  } catch {
    // ignore storage failures
  }
}

// Convert editor state → the sections jsonb shape examService/room expect.
function draftToSections(draft) {
  return draft.sections.map((section, index) =>
    normalizeExamSection(
      {
        ...section,
        questions: section.questions.map((question) => ({
          id: question.id,
          type: question.type,
          prompt: question.prompt,
          imageUrl: question.imageUrl,
          imageName: question.imageName,
          options:
            question.type === 'multiple_choice'
              ? question.optionsText.split('\n').map((option) => option.trim()).filter(Boolean)
              : [],
          correctAnswer:
            question.type === 'true_false' || question.type === 'multiple_choice'
              ? question.correctAnswer
              : question.acceptedAnswersText.split(',')[0]?.trim() || '',
          acceptedAnswers:
            question.type === 'fill_blank'
              ? question.acceptedAnswersText.split(',').map((answer) => answer.trim()).filter(Boolean)
              : [],
          pairs:
            question.type === 'matching'
              ? question.pairsText
                  .split('\n')
                  .map((line) => {
                    const [left, right] = line.split('=');
                    return { left: (left || '').trim(), right: (right || '').trim() };
                  })
                  .filter((pair) => pair.left && pair.right)
              : [],
          explanation: question.explanation
        }))
      },
      index
    )
  );
}

// Convert a stored exam → editor state.
function examToDraft(exam) {
  return {
    id: exam.id,
    title: exam.title,
    description: exam.description,
    assignmentScope: exam.assignmentScope,
    courseKey: exam.courseKey,
    recipientsText: exam.recipients.map((recipient) => recipient.studentEmail).join('\n'),
    status: exam.status,
    sections: exam.sections.map((section) => ({
      id: section.id,
      type: section.type,
      title: section.title,
      durationMinutes: section.durationMinutes,
      audioUrl: section.audioUrl,
      audioName: section.audioName,
      passage: section.passage,
      questions: section.questions.map((question) => ({
        id: question.id,
        type: question.type,
        prompt: question.prompt,
        imageUrl: question.imageUrl || '',
        imageName: question.imageName || '',
        optionsText: question.options.join('\n'),
        correctAnswer: question.correctAnswer,
        acceptedAnswersText: question.acceptedAnswers.join(', '),
        pairsText: question.pairs.map((pair) => `${pair.left} = ${pair.right}`).join('\n'),
        explanation: question.explanation
      }))
    }))
  };
}

function validateDraft(draft) {
  if (!draft.title.trim()) {
    return 'Vui lòng nhập tên đề thi.';
  }

  if (!draft.sections.length) {
    return 'Đề thi cần ít nhất một phần thi.';
  }

  if (draft.assignmentScope === 'selected_students' && !draft.recipientsText.trim()) {
    return 'Vui lòng nhập email học viên được giao đề.';
  }

  if (draft.assignmentScope === 'course_buyers' && !draft.courseKey) {
    return 'Vui lòng chọn khóa học áp dụng.';
  }

  for (const section of draft.sections) {
    if (!section.questions.length) {
      return `Phần "${section.title}" chưa có câu hỏi nào.`;
    }

    for (const [index, question] of section.questions.entries()) {
      if (!question.prompt.trim()) {
        return `Phần "${section.title}" — câu ${index + 1} chưa có nội dung.`;
      }
      if (question.type === 'multiple_choice') {
        const options = question.optionsText.split('\n').map((option) => option.trim()).filter(Boolean);
        if (options.length < 2) {
          return `Phần "${section.title}" — câu ${index + 1} cần ít nhất 2 lựa chọn.`;
        }
        if (!options.includes(question.correctAnswer)) {
          return `Phần "${section.title}" — câu ${index + 1} chưa chọn đáp án đúng.`;
        }
      }
      if (question.type === 'true_false' && !['true', 'false'].includes(question.correctAnswer)) {
        return `Phần "${section.title}" — câu ${index + 1} chưa chọn Đúng/Sai.`;
      }
      if (question.type === 'fill_blank' && !question.acceptedAnswersText.trim()) {
        return `Phần "${section.title}" — câu ${index + 1} chưa có đáp án chấp nhận.`;
      }
      if (question.type === 'matching') {
        const pairs = question.pairsText
          .split('\n')
          .map((line) => line.split('='))
          .filter(([left, right]) => (left || '').trim() && (right || '').trim());
        if (pairs.length < 2) {
          return `Phần "${section.title}" — câu ${index + 1} cần ít nhất 2 cặp nối (mỗi dòng: Trái = Phải).`;
        }
      }
    }
  }

  return '';
}

function QuestionEditor({ question, index, onChange, onRemove, examId }) {
  const options = question.optionsText.split('\n').map((option) => option.trim()).filter(Boolean);

  function update(field, value) {
    onChange({ ...question, [field]: value });
  }

  return (
    <div className="exam-editor-question">
      <div className="exam-editor-question__head">
        <strong>Câu {index + 1}</strong>
        <select value={question.type} onChange={(event) => update('type', event.target.value)}>
          {EXAM_QUESTION_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        <button type="button" className="button-ghost danger" onClick={onRemove}>
          Xóa câu
        </button>
      </div>

      <label className="auth-field">
        <span>Nội dung câu hỏi</span>
        <textarea
          rows={2}
          value={question.prompt}
          onChange={(event) => update('prompt', event.target.value)}
          placeholder="Nhập câu hỏi..."
        />
      </label>

      <ImageUploadField
        imageUrl={question.imageUrl || ''}
        imageName={question.imageName || ''}
        onUploaded={({ imageUrl, imageName }) => onChange({ ...question, imageUrl, imageName })}
        onClear={() => onChange({ ...question, imageUrl: '', imageName: '' })}
        upload={(file, onProgress) => uploadExamImage(file, examId || 'new', onProgress)}
      />

      {question.type === 'multiple_choice' ? (
        <>
          <label className="auth-field">
            <span>Các lựa chọn (mỗi dòng một lựa chọn)</span>
            <textarea
              rows={4}
              value={question.optionsText}
              onChange={(event) => update('optionsText', event.target.value)}
              placeholder={'Đáp án A\nĐáp án B\nĐáp án C'}
            />
          </label>
          <label className="auth-field">
            <span>Đáp án đúng</span>
            <select value={question.correctAnswer} onChange={(event) => update('correctAnswer', event.target.value)}>
              <option value="">-- Chọn đáp án đúng --</option>
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}

      {question.type === 'true_false' ? (
        <label className="auth-field">
          <span>Đáp án đúng</span>
          <select value={question.correctAnswer} onChange={(event) => update('correctAnswer', event.target.value)}>
            <option value="">-- Chọn --</option>
            <option value="true">Đúng</option>
            <option value="false">Sai</option>
          </select>
        </label>
      ) : null}

      {question.type === 'fill_blank' ? (
        <label className="auth-field">
          <span>Đáp án chấp nhận (phân cách bằng dấu phẩy)</span>
          <input
            type="text"
            value={question.acceptedAnswersText}
            onChange={(event) => update('acceptedAnswersText', event.target.value)}
            placeholder="hello world, hello-world"
          />
        </label>
      ) : null}

      {question.type === 'matching' ? (
        <label className="auth-field">
          <span>Các cặp nối (mỗi dòng: Vế trái = Vế phải)</span>
          <textarea
            rows={4}
            value={question.pairsText}
            onChange={(event) => update('pairsText', event.target.value)}
            placeholder={'dog = con chó\ncat = con mèo'}
          />
        </label>
      ) : null}

      <label className="auth-field">
        <span>Giải thích (tùy chọn, hiện sau khi nộp bài)</span>
        <input
          type="text"
          value={question.explanation}
          onChange={(event) => update('explanation', event.target.value)}
          placeholder="Vì sao đáp án này đúng..."
        />
      </label>
    </div>
  );
}

function SectionEditor({ section, index, onChange, onRemove, examId }) {
  function update(field, value) {
    onChange({ ...section, [field]: value });
  }

  function updateQuestion(questionIndex, nextQuestion) {
    const questions = section.questions.map((question, i) => (i === questionIndex ? nextQuestion : question));
    update('questions', questions);
  }

  return (
    <div className="exam-editor-section">
      <div className="exam-editor-section__head">
        <strong>
          Phần {index + 1}: {getSectionTypeLabel(section.type)}
        </strong>
        <button type="button" className="button-ghost danger" onClick={onRemove}>
          Xóa phần
        </button>
      </div>

      <div className="exam-editor-section__grid">
        <label className="auth-field">
          <span>Loại phần thi</span>
          <select value={section.type} onChange={(event) => update('type', event.target.value)}>
            {EXAM_SECTION_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>

        <label className="auth-field">
          <span>Tên phần thi</span>
          <input type="text" value={section.title} onChange={(event) => update('title', event.target.value)} />
        </label>

        <label className="auth-field">
          <span>Thời gian (phút)</span>
          <input
            type="number"
            min={1}
            max={180}
            value={section.durationMinutes}
            onChange={(event) => update('durationMinutes', Number(event.target.value))}
          />
        </label>
      </div>

      {section.type === 'listening' ? (
        <AudioUploadField
          audioUrl={section.audioUrl}
          audioName={section.audioName}
          onUploaded={({ audioUrl, audioName }) => onChange({ ...section, audioUrl, audioName })}
          onClear={() => onChange({ ...section, audioUrl: '', audioName: '' })}
          upload={(file, onProgress) => uploadExamAudio(file, examId || 'new', onProgress)}
          onUseDuration={(seconds) => update('durationMinutes', Math.max(1, Math.ceil(seconds / 60)))}
        />
      ) : (
        <label className="auth-field">
          <span>Bài đọc (phân đoạn bằng dòng trống)</span>
          <textarea
            rows={6}
            value={section.passage}
            onChange={(event) => update('passage', event.target.value)}
            placeholder="Dán bài đọc tại đây..."
          />
        </label>
      )}

      <div className="exam-editor-section__questions">
        {section.questions.map((question, questionIndex) => (
          <QuestionEditor
            key={question.id}
            question={question}
            index={questionIndex}
            examId={examId}
            onChange={(nextQuestion) => updateQuestion(questionIndex, nextQuestion)}
            onRemove={() =>
              update(
                'questions',
                section.questions.filter((_, i) => i !== questionIndex)
              )
            }
          />
        ))}
      </div>

      <button
        type="button"
        className="button-ghost"
        onClick={() => update('questions', [...section.questions, createEmptyQuestion()])}
      >
        + Thêm câu hỏi
      </button>
    </div>
  );
}

export function TeacherExamPanel({ teacherId, accessToken }) {
  const [exams, setExams] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // list | edit
  const [draft, setDraft] = useState(() => createEmptyDraft());
  const [message, setMessage] = useState({ type: '', text: '' });
  const [saving, setSaving] = useState(false);
  const [recoveredDraft, setRecoveredDraft] = useState(null);
  const [autosavedAt, setAutosavedAt] = useState('');
  const [autosaveError, setAutosaveError] = useState('');
  // Ảnh chụp draft lúc mở trình soạn — chỉ tự lưu khi giáo viên đã sửa gì đó, để
  // mở xem một đề rồi thoát không tạo ra bản nháp "soạn dở" thừa.
  const draftBaselineRef = useRef('');
  const courseOptions = useMemo(() => getCourseOptions(teacherId), [teacherId]);

  async function reload() {
    setLoading(true);
    const nextExams = await getExamsForTeacher(teacherId);
    const nextAttempts = await getExamAttemptsForExams(nextExams.map((exam) => exam.id));
    setExams(nextExams);
    setAttempts(nextAttempts);
    setLoading(false);
  }

  useEffect(() => {
    void reload();
    setRecoveredDraft(readStoredDraft(teacherId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId]);

  // Tự lưu bản nháp sau mỗi lần gõ (debounce) để thoát trình duyệt giữa chừng
  // vẫn còn dữ liệu khi quay lại.
  useEffect(() => {
    if (view !== 'edit' || !hasDraftContent(draft) || JSON.stringify(draft) === draftBaselineRef.current) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      if (writeStoredDraft(teacherId, draft)) {
        setAutosavedAt(new Date().toISOString());
        setAutosaveError('');
      } else {
        setAutosavedAt('');
        setAutosaveError(
          'Bản nháp quá lớn để tự động lưu (thường do ảnh/audio nhúng trực tiếp). Hãy bấm "Lưu bản nháp".'
        );
      }
    }, DRAFT_AUTOSAVE_MS);

    return () => clearTimeout(timeoutId);
  }, [draft, view, teacherId]);

  const examTitleById = useMemo(() => {
    const map = new Map();
    exams.forEach((exam) => map.set(exam.id, exam.title));
    return map;
  }, [exams]);

  const attemptRows = useMemo(
    () =>
      attempts.map((attempt) => ({
        ...attempt,
        examTitle: examTitleById.get(attempt.examId) || attempt.examId
      })),
    [attempts, examTitleById]
  );
  const attemptsPagination = usePagination(attemptRows, { pageSize: 8, resetKey: attemptRows.length });

  // Mở trình soạn với nội dung khác sẽ ghi đè bản nháp đang lưu — hỏi trước.
  function confirmReplaceRecoveredDraft() {
    return (
      !recoveredDraft ||
      window.confirm('Bạn đang có một đề thi soạn dở chưa lưu. Mở đề khác sẽ xóa bản nháp đó. Tiếp tục?')
    );
  }

  function openEditor(nextDraft) {
    draftBaselineRef.current = JSON.stringify(nextDraft);
    setDraft(nextDraft);
    setAutosavedAt('');
    setAutosaveError('');
    setMessage({ type: '', text: '' });
    setView('edit');
  }

  function startCreate() {
    if (!confirmReplaceRecoveredDraft()) {
      return;
    }
    clearStoredDraft(teacherId);
    setRecoveredDraft(null);
    openEditor(createEmptyDraft());
  }

  function startEdit(exam) {
    if (!confirmReplaceRecoveredDraft()) {
      return;
    }
    clearStoredDraft(teacherId);
    setRecoveredDraft(null);
    openEditor(examToDraft(exam));
  }

  function resumeRecoveredDraft() {
    if (!recoveredDraft) {
      return;
    }
    const savedAt = recoveredDraft.savedAt;
    openEditor(recoveredDraft.draft);
    setAutosavedAt(savedAt || '');
    setRecoveredDraft(null);
  }

  function discardRecoveredDraft() {
    if (!window.confirm('Xóa bản nháp đang soạn dở? Thao tác này không thể hoàn tác.')) {
      return;
    }
    clearStoredDraft(teacherId);
    setRecoveredDraft(null);
  }

  // Rời trình soạn nhưng vẫn giữ bản nháp, để danh sách hiện nút "Tiếp tục soạn".
  function backToList() {
    setView('list');
    setRecoveredDraft(readStoredDraft(teacherId));
  }

  function updateDraft(field, value) {
    setDraft((previous) => ({ ...previous, [field]: value }));
  }

  function updateSection(index, nextSection) {
    setDraft((previous) => ({
      ...previous,
      sections: previous.sections.map((section, i) => (i === index ? nextSection : section))
    }));
  }

  async function handleSave(nextStatus) {
    const error = validateDraft(draft);
    if (error) {
      setMessage({ type: 'error', text: error });
      return;
    }

    setSaving(true);
    setMessage({ type: '', text: '' });

    const examPayload = {
      title: draft.title.trim(),
      description: draft.description.trim(),
      assignmentScope: draft.assignmentScope,
      courseKey: draft.assignmentScope === 'course_buyers' ? draft.courseKey : '',
      status: nextStatus || draft.status || 'draft',
      sections: draftToSections(draft),
      teacherId
    };
    const recipients =
      draft.assignmentScope === 'selected_students'
        ? draft.recipientsText
            .split(/[\n,;]+/)
            .map((email) => email.trim().toLowerCase())
            .filter(Boolean)
        : [];

    try {
      if (draft.id) {
        await updateExam({ examId: draft.id, exam: examPayload, recipients, accessToken });
      } else {
        await createExam({ teacherId, exam: examPayload, recipients, accessToken });
      }

      // Đã lưu lên server → bản nháp tạm không còn cần nữa.
      clearStoredDraft(teacherId);
      setRecoveredDraft(null);
      setAutosavedAt('');
      setAutosaveError('');

      setMessage({
        type: 'success',
        text:
          examPayload.status === 'published'
            ? 'Đã lưu và mở đề thi cho học viên.'
            : 'Đã lưu đề thi (bản nháp).'
      });
      setView('list');
      await reload();
    } catch (saveError) {
      setMessage({ type: 'error', text: saveError.message || 'Không thể lưu đề thi.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(exam) {
    const nextStatus = exam.status === 'published' ? 'draft' : 'published';
    try {
      await setExamStatus({ examId: exam.id, status: nextStatus, accessToken });
      setMessage({ type: '', text: '' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Không thể đổi trạng thái đề thi.' });
      return;
    }
    await reload();
  }

  async function handleDelete(exam) {
    if (!window.confirm(`Xóa đề thi "${exam.title}"? Kết quả đã nộp sẽ bị xóa theo.`)) {
      return;
    }
    try {
      await deleteExam({ examId: exam.id, accessToken });
      setMessage({ type: '', text: '' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Không thể xóa đề thi.' });
      return;
    }
    await reload();
  }

  return (
    <div className="content-card content-card--enterprise exam-manager">
      <div className="section-head">
        <div>
          <span className="eyebrow">Phòng thi mô phỏng</span>
          <h2>Đề thi &amp; kết quả</h2>
        </div>
        {view === 'list' ? (
          <button type="button" className="button" onClick={startCreate}>
            Tạo đề thi mới
          </button>
        ) : (
          <button type="button" className="button-ghost" onClick={backToList}>
            ← Quay lại danh sách
          </button>
        )}
      </div>

      {message.text ? (
        <div
          className={`auth-message ${
            message.type === 'success' ? 'auth-message--success' : message.type === 'error' ? 'auth-message--error' : ''
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {view === 'list' && recoveredDraft ? (
        <div className="exam-draft-recovery">
          <div className="exam-draft-recovery__text">
            <strong>Bạn có một đề thi đang soạn dở</strong>
            <span>
              {String(recoveredDraft.draft.title || '').trim() || 'Đề thi chưa đặt tên'}
              {recoveredDraft.savedAt
                ? ` · tự động lưu lúc ${new Date(recoveredDraft.savedAt).toLocaleString('vi-VN')}`
                : ''}
            </span>
          </div>
          <div className="exam-draft-recovery__actions">
            <button type="button" className="button" onClick={resumeRecoveredDraft}>
              Tiếp tục soạn
            </button>
            <button type="button" className="button-ghost danger" onClick={discardRecoveredDraft}>
              Xóa bản nháp
            </button>
          </div>
        </div>
      ) : null}

      {view === 'edit' ? (
        <div className="exam-editor">
          <div className="exam-editor__grid">
            <label className="auth-field">
              <span>Tên đề thi</span>
              <input
                type="text"
                value={draft.title}
                onChange={(event) => updateDraft('title', event.target.value)}
                placeholder="VD: Thi thử IELTS Listening + Reading tháng 8"
              />
            </label>

            <label className="auth-field">
              <span>Mô tả (tùy chọn)</span>
              <input
                type="text"
                value={draft.description}
                onChange={(event) => updateDraft('description', event.target.value)}
                placeholder="Ghi chú ngắn cho học viên"
              />
            </label>

            <label className="auth-field">
              <span>Phạm vi giao đề</span>
              <select
                value={draft.assignmentScope}
                onChange={(event) => updateDraft('assignmentScope', event.target.value)}
              >
                <option value="selected_students">Học viên chỉ định (theo email)</option>
                <option value="course_buyers">Học viên đã mua khóa</option>
              </select>
            </label>

            {draft.assignmentScope === 'course_buyers' ? (
              <label className="auth-field">
                <span>Khóa học áp dụng</span>
                <select value={draft.courseKey} onChange={(event) => updateDraft('courseKey', event.target.value)}>
                  <option value="">-- Chọn khóa học --</option>
                  {courseOptions.map((course) => (
                    <option key={course.key} value={course.key}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="auth-field">
                <span>Email học viên (mỗi dòng một email)</span>
                <textarea
                  rows={3}
                  value={draft.recipientsText}
                  onChange={(event) => updateDraft('recipientsText', event.target.value)}
                  placeholder={'hocvien1@gmail.com\nhocvien2@gmail.com'}
                />
              </label>
            )}
          </div>

          {draft.sections.map((section, index) => (
            <SectionEditor
              key={section.id}
              section={section}
              index={index}
              examId={draft.id}
              onChange={(nextSection) => updateSection(index, nextSection)}
              onRemove={() =>
                setDraft((previous) => ({
                  ...previous,
                  sections: previous.sections.filter((_, i) => i !== index)
                }))
              }
            />
          ))}

          <div className="exam-editor__section-actions">
            <button
              type="button"
              className="button-ghost"
              onClick={() =>
                setDraft((previous) => ({ ...previous, sections: [...previous.sections, createEmptySection('listening')] }))
              }
            >
              + Thêm phần Nghe
            </button>
            <button
              type="button"
              className="button-ghost"
              onClick={() =>
                setDraft((previous) => ({ ...previous, sections: [...previous.sections, createEmptySection('reading')] }))
              }
            >
              + Thêm phần Đọc
            </button>
          </div>

          <div className="exam-editor__autosave">
            {autosaveError ? (
              <span className="exam-editor__autosave-warning">{autosaveError}</span>
            ) : autosavedAt ? (
              <span>
                Đã tự động lưu tạm lúc {new Date(autosavedAt).toLocaleTimeString('vi-VN')} — thoát trình duyệt vẫn
                khôi phục được.
              </span>
            ) : (
              <span>Bản nháp sẽ được tự động lưu tạm trên máy này trong lúc bạn soạn.</span>
            )}
          </div>

          <div className="exam-editor__save-actions">
            <button type="button" className="button-ghost" disabled={saving} onClick={() => handleSave('draft')}>
              Lưu bản nháp
            </button>
            <button type="button" className="button" disabled={saving} onClick={() => handleSave('published')}>
              {saving ? 'Đang lưu...' : 'Lưu & mở cho học viên'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {loading ? (
            <p className="empty-state">Đang tải đề thi...</p>
          ) : exams.length ? (
            <div className="exam-manager__list">
              {exams.map((exam) => {
                const examAttempts = attempts.filter((attempt) => attempt.examId === exam.id);

                return (
                  <article key={exam.id} className="exam-manager__row">
                    <div className="exam-manager__row-main">
                      <strong>{exam.title}</strong>
                      <span>
                        {exam.sections.map((section) => getSectionTypeLabel(section.type)).join(' + ')} ·{' '}
                        {exam.sections.reduce((total, section) => total + section.questions.length, 0)} câu ·{' '}
                        {examAttempts.length} lượt nộp
                      </span>
                    </div>
                    <span className={`pill ${exam.status === 'published' ? '' : 'exam-manager__pill-draft'}`}>
                      {exam.status === 'published' ? 'Đang mở' : exam.status === 'archived' ? 'Lưu trữ' : 'Bản nháp'}
                    </span>
                    <div className="exam-manager__row-actions">
                      <button type="button" className="button-ghost" onClick={() => startEdit(exam)}>
                        Sửa
                      </button>
                      <button type="button" className="button-ghost" onClick={() => handleToggleStatus(exam)}>
                        {exam.status === 'published' ? 'Đóng đề' : 'Mở đề'}
                      </button>
                      <button type="button" className="button-ghost danger" onClick={() => handleDelete(exam)}>
                        Xóa
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="empty-state">Chưa có đề thi nào. Bấm “Tạo đề thi mới” để bắt đầu.</p>
          )}

          <div className="section-head exam-manager__results-head">
            <div>
              <span className="eyebrow">Kết quả</span>
              <h3>Lượt nộp bài của học viên</h3>
            </div>
            <button type="button" className="button-ghost" onClick={() => void reload()}>
              Làm mới
            </button>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Học viên</th>
                  <th>Đề thi</th>
                  <th>Điểm</th>
                  <th>Từng phần</th>
                  <th>Trạng thái</th>
                  <th>Nộp lúc</th>
                </tr>
              </thead>
              <tbody>
                {attemptRows.length ? (
                  attemptsPagination.pageItems.map((attempt) => (
                    <tr key={attempt.id}>
                      <td>{attempt.studentEmail || attempt.studentId}</td>
                      <td>{attempt.examTitle}</td>
                      <td>
                        <strong>
                          {attempt.score}/{attempt.maxScore}
                        </strong>
                      </td>
                      <td>
                        {attempt.sectionScores
                          .map((section) => `${section.title || section.type}: ${section.score}/${section.maxScore}`)
                          .join(' · ')}
                      </td>
                      <td>{attempt.status === 'auto_submitted' ? 'Hết giờ (tự nộp)' : 'Nộp đúng giờ'}</td>
                      <td>{attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString('vi-VN') : ''}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>Chưa có học viên nào nộp bài.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <PaginationControls {...attemptsPagination} label="lượt nộp" />
        </>
      )}
    </div>
  );
}
