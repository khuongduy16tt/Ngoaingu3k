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
    expect(screen.getByText(/file âm thanh sẽ sớm được cập nhật/)).toBeInTheDocument(); // câu nghe chờ audio
  });

  it('chọn đáp án vẫn đổi được, chỉ chấm khi bấm Kiểm tra câu này', () => {
    const lesson = {
      id: 'l3',
      exercises: [
        { id: 'q1', type: 'true_false', prompt: 'Nhận định 1?', correctAnswer: 'false', explanation: 'Giải thích câu 1.' },
        { id: 'q2', type: 'fill_blank', prompt: 'Điền từ?', acceptedAnswers: ['好'], explanation: 'Giải thích câu 2.' }
      ]
    };
    render(<LessonExercisePreview lesson={lesson} isTeacher={false} />);

    const [checkQ1, checkQ2] = screen.getAllByRole('button', { name: 'Kiểm tra câu này' });
    expect(checkQ1).toBeDisabled();
    fireEvent.click(screen.getByText('Sai'));
    // chọn nhầm rồi đổi ý: chưa chấm gì cả
    fireEvent.click(screen.getByText('Đúng'));
    expect(screen.queryByText(/Chưa đúng/)).not.toBeInTheDocument();
    expect(screen.queryByText('Giải thích câu 1.')).not.toBeInTheDocument();
    fireEvent.click(checkQ1);
    expect(screen.getByText(/Chưa đúng/)).toBeInTheDocument();
    expect(screen.getByText('Giải thích câu 1.')).toBeInTheDocument();
    expect(screen.queryByText('Giải thích câu 2.')).not.toBeInTheDocument();

    const checkButton = checkQ2;
    expect(checkButton).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('Gõ đáp án của bạn...'), { target: { value: '好' } });
    fireEvent.click(checkButton);
    expect(screen.getByText('Chính xác.')).toBeInTheDocument();
    expect(screen.getByText('Giải thích câu 2.')).toBeInTheDocument();
  });

  it('calls onSubmitted (auto mark complete) once every question is answered', () => {
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

    // chọn xong bấm kiểm tra từng câu; câu cuối xong thì báo điểm cả bài
    const [checkQ1, checkQ2] = screen.getAllByRole('button', { name: 'Kiểm tra câu này' });
    fireEvent.click(screen.getByText('A. Đáp án A'));
    fireEvent.click(checkQ1);
    expect(onSubmitted).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Đúng'));
    expect(onSubmitted).not.toHaveBeenCalled();
    fireEvent.click(checkQ2);

    expect(onSubmitted).toHaveBeenCalledTimes(1);
    expect(onSubmitted).toHaveBeenCalledWith({ score: 2, maxScore: 2, tabId: '' });
    expect(screen.getByText('Kết quả: 2/2 điểm')).toBeInTheDocument();
  });
});
