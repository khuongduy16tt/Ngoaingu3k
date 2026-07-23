import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LessonReadingPanel, LessonExercisePreview } from './LearningPage';

// Kiểm tra các thành phần render nội dung khóa HSK vỡ lòng nhập từ Google Sheet:
// bài luyện đọc, bảng phiên âm, câu hỏi có chữ Hán thay ảnh và câu nghe chờ audio.

describe('LessonReadingPanel', () => {
  it('renders a reading list (luyện đọc)', () => {
    render(
      <LessonReadingPanel
        lesson={{ exerciseType: 'Luyện đọc', readingItems: ['你好', '很好', '不忙'], pinyinTable: '' }}
      />
    );
    expect(screen.getByText('你好')).toBeInTheDocument();
    expect(screen.getByText('很好')).toBeInTheDocument();
    expect(screen.getByText('不忙')).toBeInTheDocument();
  });

  it('renders the pinyin reference table (bảng phiên âm)', () => {
    render(<LessonReadingPanel lesson={{ exerciseType: 'Đọc bảng phiên âm', readingItems: [], pinyinTable: 'initials' }} />);
    expect(screen.getByText('Thanh mẫu (声母)')).toBeInTheDocument();
    expect(screen.getByText('Vận mẫu (韵母)')).toBeInTheDocument();
    // vài ô phiên âm điển hình
    expect(screen.getByText('b')).toBeInTheDocument();
    expect(screen.getByText('ang')).toBeInTheDocument();
    expect(screen.getByText('Thanh điệu (声调)')).toBeInTheDocument();
  });
});

describe('LessonExercisePreview', () => {
  it('renders MCQ, true/false, hanzi image and audio-pending hint', () => {
    const lesson = {
      id: 'l1',
      exerciseType: 'Luyện tập',
      exercises: [
        {
          id: 'q1',
          type: 'multiple_choice',
          prompt: 'Chữ Hán sau áp dụng quy tắc bút thuận nào?',
          options: [
            { label: 'A', text: 'Phẩy trước mác sau' },
            { label: 'B', text: 'Trái trước phải sau' }
          ],
          correctAnswer: 'A',
          imageHanzi: '八',
          explanation: ''
        },
        {
          id: 'q2',
          type: 'true_false',
          prompt: 'Chữ Hán là chữ tượng hình',
          correctAnswer: 'false',
          explanation: 'Chỉ ~4% là tượng hình.'
        },
        {
          id: 'q3',
          type: 'multiple_choice',
          prompt: 'Nghe và chọn thanh mẫu',
          options: [
            { label: 'A', text: 'p' },
            { label: 'B', text: 'b' }
          ],
          correctAnswer: 'A',
          audioPending: true,
          explanation: ''
        }
      ]
    };
    render(<LessonExercisePreview lesson={lesson} isTeacher={false} />);

    expect(screen.getByText('Chữ Hán sau áp dụng quy tắc bút thuận nào?')).toBeInTheDocument();
    expect(screen.getByText('八')).toBeInTheDocument(); // hanzi thay ảnh
    expect(screen.getByText('A. Phẩy trước mác sau')).toBeInTheDocument();
    expect(screen.getByText('Chữ Hán là chữ tượng hình')).toBeInTheDocument();
    expect(screen.getByText('Đúng')).toBeInTheDocument();
    expect(screen.getByText('Sai')).toBeInTheDocument();
    expect(screen.getByText(/audio phát âm sẽ được cập nhật/)).toBeInTheDocument(); // câu nghe chờ audio
  });

  it('calls onSubmitted (auto mark complete) after answering all and submitting', () => {
    const onSubmitted = vi.fn();
    const lesson = {
      id: 'l2',
      exerciseType: 'Luyện tập',
      exercises: [
        {
          id: 'q1',
          type: 'multiple_choice',
          prompt: 'Câu 1?',
          options: [
            { label: 'A', text: 'Đáp án A' },
            { label: 'B', text: 'Đáp án B' }
          ],
          correctAnswer: 'A'
        },
        { id: 'q2', type: 'true_false', prompt: 'Nhận định?', correctAnswer: 'true' }
      ]
    };
    render(<LessonExercisePreview lesson={lesson} isTeacher={false} onSubmitted={onSubmitted} />);

    // trả lời hết rồi nộp
    fireEvent.click(screen.getByText('A. Đáp án A'));
    fireEvent.click(screen.getByText('Đúng'));
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra đáp án' }));

    expect(onSubmitted).toHaveBeenCalledTimes(1);
  });
});
