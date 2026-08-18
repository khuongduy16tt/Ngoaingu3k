import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LessonTabManager } from './LearningPage';

const lesson = {
  id: 'lesson-1',
  databaseId: 'lesson-1',
  title: 'Chủ đề 1',
  tabs: [
    { id: 'video', kind: 'video', title: 'Video', videoUrl: '' },
    { id: 'grammar', kind: 'exercise', title: 'Ngữ pháp', exercises: [] },
    { id: 'vocabulary', kind: 'exercise', title: 'Từ vựng', exercises: [] }
  ]
};

describe('LessonTabManager', () => {
  it('chọn đúng tab để sửa nội dung bằng nút thao tác rõ ràng', () => {
    const { container } = render(
      <MemoryRouter>
        <LessonTabManager lesson={lesson} saving={false} status={null} onSave={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /Ngữ pháp/ })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Sửa câu hỏi' })[1]);

    expect(screen.getByRole('heading', { name: /Từ vựng/ })).toBeInTheDocument();
    expect(container.querySelectorAll('.lesson-tab-manager__row')[2]).toHaveClass('is-selected');
  });
});
