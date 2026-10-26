import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LessonExercisePreview } from './LearningPage';

// Bài làm dở của một tab bài tập phải còn nguyên khi đổi tab rồi quay lại
// (component bị dựng lại) hoặc tải lại trang.

const lesson = {
  id: 'chu-de-1',
  exercises: [
    { id: 'q1', type: 'true_false', prompt: 'Nhận định 1?', correctAnswer: 'true' },
    { id: 'q2', type: 'fill_blank', prompt: 'Điền từ?', acceptedAnswers: ['好'] }
  ]
};

function answerFirst() {
  fireEvent.click(screen.getByText('Đúng'));
  fireEvent.click(screen.getAllByRole('button', { name: 'Kiểm tra câu này' })[0]);
}

beforeEach(() => {
  localStorage.clear();
});

describe('LessonExercisePreview — giữ bài làm dở', () => {
  it('dựng lại component vẫn thấy câu đã chấm và chữ đang gõ', () => {
    const { unmount } = render(<LessonExercisePreview lesson={lesson} isTeacher={false} />);
    answerFirst();
    fireEvent.change(screen.getByPlaceholderText('Gõ đáp án của bạn...'), { target: { value: '好' } });
    unmount();

    render(<LessonExercisePreview lesson={lesson} isTeacher={false} />);
    expect(screen.getByText('Chính xác.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Gõ đáp án của bạn...')).toHaveValue('好');
    expect(screen.getByText('1/2 câu đã làm')).toBeInTheDocument();
  });

  it('"Làm lại" xóa luôn bản lưu', () => {
    const { unmount } = render(<LessonExercisePreview lesson={lesson} isTeacher={false} />);
    answerFirst();
    fireEvent.click(screen.getByRole('button', { name: 'Làm lại' }));
    unmount();

    render(<LessonExercisePreview lesson={lesson} isTeacher={false} />);
    expect(screen.getByText('0/2 câu đã làm')).toBeInTheDocument();
  });

  it('mỗi tab giữ bài làm riêng', () => {
    const tabA = { id: 'tab-a', title: 'Tab A', exercises: lesson.exercises };
    const tabB = { id: 'tab-b', title: 'Tab B', exercises: lesson.exercises };
    const { rerender } = render(<LessonExercisePreview lesson={lesson} tab={tabA} isTeacher={false} />);
    answerFirst();

    rerender(<LessonExercisePreview lesson={lesson} tab={tabB} isTeacher={false} />);
    expect(screen.getByText('0/2 câu đã làm')).toBeInTheDocument();

    rerender(<LessonExercisePreview lesson={lesson} tab={tabA} isTeacher={false} />);
    expect(screen.getByText('1/2 câu đã làm')).toBeInTheDocument();
  });
});
