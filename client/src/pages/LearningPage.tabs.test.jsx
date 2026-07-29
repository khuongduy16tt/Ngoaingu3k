import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LessonTabbedContent } from './LearningPage';

// Một chủ đề tách thành hai mục độc lập: Video và Bài tập. Chỉ khi bấm "Bài tập"
// mới trải ra các tab con, mỗi tab con là một đề riêng.

const mcq = (id, prompt) => ({
  id,
  type: 'multiple_choice',
  prompt,
  options: [
    { label: 'A', text: 'Đáp án A' },
    { label: 'B', text: 'Đáp án B' }
  ],
  correctAnswer: 'A'
});

function renderContent(lesson, props = {}) {
  return render(
    <MemoryRouter>
      <LessonTabbedContent lesson={lesson} isTeacher={false} dashboardPath="/dashboard/teacher" {...props} />
    </MemoryRouter>
  );
}

const lessonWithTabs = {
  id: 'topic-1',
  title: 'Chủ đề 1',
  tabs: [
    { id: 'v', kind: 'video', title: 'Video bài học', videoUrl: 'https://youtu.be/abc123' },
    { id: 'e1', kind: 'exercise', title: 'Bài tập ngữ pháp 1', exercises: [mcq('q1', 'Câu ngữ pháp 1')] },
    { id: 'e2', kind: 'exercise', title: 'Bài tập ngữ pháp 2', exercises: [mcq('q2', 'Câu ngữ pháp 2')] },
    { id: 'e3', kind: 'exercise', title: 'Bài tập nghe 1', exercises: [mcq('q3', 'Câu nghe 1')] }
  ]
};

describe('LessonTabbedContent', () => {
  it('mở ở phần Video và chưa trải bài tập ra', () => {
    renderContent(lessonWithTabs);

    expect(screen.getByRole('tab', { name: /Video bài học/ })).toHaveAttribute('aria-selected', 'true');
    // Tab con và câu hỏi chưa hiện — tránh rối mắt
    expect(screen.queryByRole('tab', { name: /Bài tập ngữ pháp 1/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Câu ngữ pháp 1')).not.toBeInTheDocument();
  });

  it('bấm Bài tập thì trải ra đủ các tab con đã đặt tên', () => {
    renderContent(lessonWithTabs);
    fireEvent.click(screen.getByRole('tab', { name: /^Bài tập/ }));

    expect(screen.getByRole('tab', { name: /Bài tập ngữ pháp 1/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Bài tập ngữ pháp 2/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Bài tập nghe 1/ })).toBeInTheDocument();
  });

  it('chỉ hiện câu hỏi của tab con đang chọn', () => {
    renderContent(lessonWithTabs);
    fireEvent.click(screen.getByRole('tab', { name: /^Bài tập/ }));

    // Tab con đầu tiên được chọn sẵn
    expect(screen.getByText('Câu ngữ pháp 1')).toBeInTheDocument();
    expect(screen.queryByText('Câu ngữ pháp 2')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Bài tập ngữ pháp 2/ }));
    expect(screen.getByText('Câu ngữ pháp 2')).toBeInTheDocument();
    expect(screen.queryByText('Câu ngữ pháp 1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Bài tập nghe 1/ }));
    expect(screen.getByText('Câu nghe 1')).toBeInTheDocument();
    expect(screen.queryByText('Câu ngữ pháp 2')).not.toBeInTheDocument();
  });

  it('đếm số bài và số câu trên mục Bài tập', () => {
    renderContent(lessonWithTabs);
    expect(screen.getByText('3 bài · 3 câu')).toBeInTheDocument();
  });

  it('dựng tab từ bài học cũ chỉ có exercises phẳng', () => {
    renderContent({
      id: 'legacy',
      title: 'Bài cũ',
      videoUrl: 'https://youtu.be/legacy',
      exerciseType: 'Luyện tập',
      exercises: [mcq('q1', 'Câu bài cũ')]
    });

    fireEvent.click(screen.getByRole('tab', { name: /^Bài tập/ }));
    expect(screen.getByRole('tab', { name: /Luyện tập/ })).toBeInTheDocument();
    expect(screen.getByText('Câu bài cũ')).toBeInTheDocument();
  });

  it('báo rõ khi chủ đề chưa có bài tập', () => {
    renderContent({ id: 'no-ex', title: 'Chỉ có video', videoUrl: 'https://youtu.be/abc' });

    fireEvent.click(screen.getByRole('tab', { name: /^Bài tập/ }));
    expect(screen.getByText('Chủ đề này chưa có bài tập')).toBeInTheDocument();
  });

  it('đổi chủ đề thì quay lại phần Video', () => {
    const { rerender } = renderContent(lessonWithTabs);
    fireEvent.click(screen.getByRole('tab', { name: /^Bài tập/ }));
    expect(screen.getByText('Câu ngữ pháp 1')).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <LessonTabbedContent
          lesson={{ ...lessonWithTabs, id: 'topic-2', title: 'Chủ đề 2' }}
          isTeacher={false}
          dashboardPath="/dashboard/teacher"
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('tab', { name: /Video bài học/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('Câu ngữ pháp 1')).not.toBeInTheDocument();
  });
});
