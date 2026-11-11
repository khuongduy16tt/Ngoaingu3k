import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Bài không có video (khóa HSK 5 - Từ vựng) hiện bộ flashcard cùng số chủ đề.

const COURSE_ID = '4a1b7160-444e-4685-af87-a62420ac821a';

vi.mock('../providers/AuthProvider', () => ({
  useAuth: () => ({ user: null, profile: null })
}));

vi.mock('../lib/flashcardService', () => ({
  getFlashcardSets: vi.fn(async () => [
    { id: 'set-15', title: 'HSK 5 - Chủ đề 15', cardIds: ['c1'] },
    { id: 'set-16', title: 'HSK 5 - Chủ đề 16', cardIds: ['c2'] }
  ]),
  getFlashcardSetById: vi.fn(async (id) => ({
    id,
    title: id === 'set-15' ? 'HSK 5 - Chủ đề 15' : 'HSK 5 - Chủ đề 16',
    cards: [
      { id: 'c1', term: '迟早', definition: 'sớm muộn' },
      { id: 'c2', term: '宝贵', definition: 'quý báu' }
    ]
  })),
  getFlashcardProgress: vi.fn(async () => ({})),
  saveFlashcardProgress: vi.fn(async () => {})
}));

const { LessonTabbedContent } = await import('./LearningPage');

const exerciseTab = {
  id: 'e1',
  kind: 'exercise',
  title: 'Hoàn thành cụm từ',
  exercises: [
    {
      id: 'q1',
      type: 'multiple_choice',
      prompt: 'Câu 1',
      options: [
        { label: 'A', text: 'A' },
        { label: 'B', text: 'B' }
      ],
      correctAnswer: 'A'
    }
  ]
};

function renderLesson(lesson, courseId = COURSE_ID) {
  return render(
    <MemoryRouter>
      <LessonTabbedContent lesson={lesson} courseId={courseId} isTeacher={false} dashboardPath="/dashboard" />
    </MemoryRouter>
  );
}

describe('LessonTabbedContent — flashcard thay video', () => {
  it('bài không có video hiện bộ thẻ cùng số chủ đề', async () => {
    renderLesson({
      id: 'l15',
      title: 'TỪ VỰNG',
      sectionTitle: 'Chủ đề 15',
      tabs: [{ id: 'v', kind: 'video', title: 'Video bài học', videoUrl: '' }, exerciseTab]
    });

    expect(await screen.findByText('Flashcard từ vựng')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'HSK 5 - Chủ đề 15' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Flashcard từ vựng\s*2 thẻ/ })).toBeInTheDocument();
    expect(screen.queryByText(/chưa có video/i)).not.toBeInTheDocument();
  });

  it('chủ đề chưa có bộ thẻ thì giữ như cũ (mở phần Bài tập)', async () => {
    renderLesson({
      id: 'l3',
      title: 'TỪ VỰNG',
      sectionTitle: 'Chủ đề 3',
      tabs: [{ id: 'v', kind: 'video', title: 'Video bài học', videoUrl: '' }, exerciseTab]
    });

    expect((await screen.findAllByText('Câu 1')).length).toBeGreaterThan(0);
    expect(screen.getByRole('tab', { name: /Video bài học/ })).toBeInTheDocument();
  });

  it('bài đã có video thì vẫn hiện video', () => {
    renderLesson({
      id: 'l16',
      title: 'Ngữ pháp',
      sectionTitle: 'Chủ đề 16',
      tabs: [{ id: 'v', kind: 'video', title: 'Video bài học', videoUrl: 'https://youtu.be/abc123' }, exerciseTab]
    });

    expect(screen.getByRole('tab', { name: /Video bài học/ })).toBeInTheDocument();
    expect(screen.queryByText('Flashcard từ vựng')).not.toBeInTheDocument();
  });
});
