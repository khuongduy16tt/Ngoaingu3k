import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CourseLessonList } from './CourseLessonList';

const sections = [
  {
    title: 'Chủ đề 1',
    lessons: [
      { id: 'l1', title: 'Mục lục HSK 5 - Ngữ pháp' },
      { id: 'l2', title: 'Video bài giảng ngữ pháp' },
      { id: 'l3', title: 'Bài tập ngữ pháp' }
    ]
  },
  {
    title: 'Chủ đề 2',
    lessons: [
      { id: 'l4', title: 'Nghe hiểu 1' },
      { id: 'l5', title: 'Nghe hiểu 2' }
    ]
  }
];

const progressMap = {
  l1: { completed: true },
  l2: { completed: true },
  l4: { completed: true, score: 6, maxScore: 10 }
};

describe('CourseLessonList', () => {
  it('shows learned units, section counters and stars', () => {
    const { container } = render(<CourseLessonList sections={sections} progressMap={progressMap} />);

    expect(container.querySelector('.lesson-list__units').textContent).toBe('Đã học 3/5 Units');
    expect(screen.getByText('2/3 Sections')).toBeInTheDocument();
    // Chương 1: 2 bài xong không có điểm → 3 sao mỗi bài.
    expect(screen.getByText('6/9')).toBeInTheDocument();
    // Chương 2: 1 bài đạt 6/10 điểm → 2 sao.
    expect(screen.getByText('2/6')).toBeInTheDocument();
  });

  it('numbers sections from the pagination offset', () => {
    render(<CourseLessonList sections={[sections[1]]} sectionOffset={3} progressMap={{}} />);

    expect(screen.getByText('04')).toBeInTheDocument();
  });

  it('expands only the first section until another header is clicked', () => {
    render(<CourseLessonList sections={sections} progressMap={progressMap} />);

    expect(screen.getByText('Mục lục HSK 5 - Ngữ pháp')).toBeInTheDocument();
    expect(screen.queryByText('Nghe hiểu 1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Chủ đề 2'));
    expect(screen.getByText('Nghe hiểu 1')).toBeInTheDocument();
  });

  it('opens a lesson when the list is interactive', () => {
    const onSelectLesson = vi.fn();
    render(<CourseLessonList sections={sections} progressMap={progressMap} onSelectLesson={onSelectLesson} />);

    fireEvent.click(screen.getByText('Video bài giảng ngữ pháp'));
    expect(onSelectLesson).toHaveBeenCalledWith('l2');
  });

  it('renders read-only rows without a select handler', () => {
    const { container } = render(<CourseLessonList sections={sections} progressMap={progressMap} />);

    expect(container.querySelectorAll('button.lesson-list-item')).toHaveLength(0);
    expect(container.querySelectorAll('div.lesson-list-item')).toHaveLength(3);
  });

  it('marks the trophies earned for each section', () => {
    const { container } = render(<CourseLessonList sections={sections} progressMap={progressMap} />);
    const trophyRows = container.querySelectorAll('.lesson-list__trophies');

    // 6/9 sao → 2 cúp, 2/6 sao → 1 cúp.
    expect(trophyRows[0].querySelectorAll('.lesson-list__trophy.is-earned')).toHaveLength(2);
    expect(trophyRows[1].querySelectorAll('.lesson-list__trophy.is-earned')).toHaveLength(1);
  });
});
