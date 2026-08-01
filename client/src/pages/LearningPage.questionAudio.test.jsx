import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LessonExercisePreview, VideoQuestionEditor } from './LearningPage';

// File nghe gắn được cho MỌI dạng câu, không riêng dạng "Nghe & gõ lại": câu
// trắc nghiệm kiểu "nghe rồi chọn đáp án" cũng cần audio.

const mcq = (overrides = {}) => ({
  id: 'q1',
  type: 'multiple_choice',
  prompt: 'Nghe và chọn từ đúng',
  options: [
    { label: 'A', text: 'xin chào' },
    { label: 'B', text: 'tạm biệt' }
  ],
  correctAnswer: 'A',
  ...overrides
});

function renderEditor(question, onSave = vi.fn()) {
  const { container } = render(
    <MemoryRouter>
      <VideoQuestionEditor
        lesson={{ id: 'lesson-1', databaseId: 'lesson-1', exercises: [question] }}
        saving={false}
        status={null}
        onSave={onSave}
      />
    </MemoryRouter>
  );
  return { container, onSave };
}

describe('VideoQuestionEditor — file nghe của câu hỏi', () => {
  it('hiện ô gắn file nghe cho câu trắc nghiệm', () => {
    renderEditor(mcq());

    expect(screen.getByText('File nghe của câu hỏi (tùy chọn)')).toBeInTheDocument();
    expect(screen.getByText('Chọn file âm thanh')).toBeInTheDocument();
  });

  it('đổi nhãn khi câu là dạng Nghe & gõ lại', () => {
    renderEditor(mcq({ type: 'listening', acceptedAnswers: ['xin chào'] }));

    expect(screen.getByText('File nghe của câu hỏi (học viên nghe rồi gõ lại)')).toBeInTheDocument();
  });

  it('dán link audio cho câu trắc nghiệm thì link được lưu xuống', () => {
    const { container, onSave } = renderEditor(mcq());

    // Ô dán link của phần audio — phần ảnh cũng có một ô "https://..." riêng.
    fireEvent.change(container.querySelector('.audio-upload-field input[type="url"]'), {
      target: { value: 'https://cdn.example.com/cau-1.mp3' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu vào Supabase' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const [savedQuestions] = onSave.mock.calls[0];
    expect(savedQuestions[0].type).toBe('multiple_choice');
    expect(savedQuestions[0].audioUrl).toBe('https://cdn.example.com/cau-1.mp3');
    // Đáp án trắc nghiệm không được mất khi gắn thêm audio.
    expect(savedQuestions[0].correctAnswer).toBe('A');
  });
});

describe('LessonExercisePreview — học viên nghe được audio của câu', () => {
  it('phát được file nghe gắn riêng cho câu trắc nghiệm', () => {
    const { container } = render(
      <LessonExercisePreview
        lesson={{ id: 'lesson-1', title: 'Bài 1' }}
        tab={{
          id: 'tab-1',
          title: 'Bài tập nghe',
          exercises: [mcq({ audioUrl: 'https://cdn.example.com/cau-1.mp3', audioName: 'cau-1.mp3' })]
        }}
        isTeacher={false}
      />
    );

    const audio = container.querySelector('.lesson-question__audio audio');
    expect(audio).toHaveAttribute('src', 'https://cdn.example.com/cau-1.mp3');
  });
});
