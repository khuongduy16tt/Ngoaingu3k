import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Phòng thi: bài làm phải sống sót qua lần tải lại trang, tải đề lỗi phải có
// đường thử lại, giảng viên xem trước không được tạo lượt thi thật, và giữa
// hai phần có màn nghỉ (đồng hồ phần sau chưa chạy).

const authState = { role: 'student' };

vi.mock('../providers/AuthProvider', () => ({
  useAuth: () => ({
    ready: true,
    session: { access_token: 'token' },
    profile: { role: authState.role },
    user: { id: 'hv-1', email: 'hv@ngoaingu3k.local' }
  })
}));

vi.mock('../lib/courseService', async (importOriginal) => ({
  ...(await importOriginal()),
  getCourseCatalog: vi.fn(async () => []),
  getOwnedCourseIds: vi.fn(async () => ['khoa-1'])
}));

const getExamById = vi.fn();
const getExamAttemptsForStudent = vi.fn();
const saveExamAttempt = vi.fn();

vi.mock('../lib/examService', async (importOriginal) => ({
  ...(await importOriginal()),
  getExamById: (...args) => getExamById(...args),
  getExamAttemptsForStudent: (...args) => getExamAttemptsForStudent(...args),
  saveExamAttempt: (...args) => saveExamAttempt(...args)
}));

import ExamRoomPage from './ExamRoomPage';

const exam = {
  id: 'de-1',
  title: 'Đề thử',
  description: '',
  status: 'published',
  teacherId: 'gv-1',
  courseKey: 'khoa-1',
  assignmentScope: 'course_buyers',
  recipients: [],
  sections: [
    {
      id: 'phan-1',
      title: 'Ngữ pháp',
      type: 'grammar',
      durationMinutes: 10,
      questions: [
        { id: 'c1', type: 'true_false', prompt: 'Câu một', correctAnswer: 'true', points: 1 }
      ]
    },
    {
      id: 'phan-2',
      title: 'Từ vựng',
      type: 'vocabulary',
      durationMinutes: 5,
      questions: [
        { id: 'c2', type: 'true_false', prompt: 'Câu hai', correctAnswer: 'false', points: 1 }
      ]
    }
  ]
};

const SESSION_KEY = 'ngoaingu3k-exam-session:hv-1:de-1';

function renderRoom() {
  return render(
    <MemoryRouter initialEntries={['/exam/de-1']}>
      <Routes>
        <Route path="/exam/:examId" element={<ExamRoomPage />} />
        <Route path="/exams" element={<p>Danh sách đề</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  authState.role = 'student';
  localStorage.clear();
  getExamById.mockReset().mockResolvedValue(exam);
  getExamAttemptsForStudent.mockReset().mockResolvedValue([]);
  saveExamAttempt.mockReset().mockImplementation(async (payload) => ({ ...payload, id: 'luot-1' }));
});

afterEach(() => {
  localStorage.clear();
});

describe('ExamRoomPage', () => {
  it('khôi phục bài làm dở sau khi tải lại trang', async () => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        examId: 'de-1',
        phase: 'room',
        sectionIndex: 0,
        answers: { c1: 'true' },
        deadline: Date.now() + 5 * 60_000,
        startedAt: new Date().toISOString(),
        sectionTimes: {},
        sectionStartedAt: Date.now()
      })
    );

    renderRoom();

    expect(await screen.findByText(/Đã khôi phục bài làm đang dở/)).toBeInTheDocument();
    expect(screen.getByText('1/1 câu đã trả lời')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đúng' })).toHaveClass('is-selected');
  });

  it('lưu bài làm xuống máy trong lúc thi', async () => {
    renderRoom();
    fireEvent.click(await screen.findByRole('button', { name: 'Bắt đầu làm bài' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sai' }));

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(SESSION_KEY));
      expect(saved.answers).toEqual({ c1: 'false' });
      expect(saved.phase).toBe('room');
    });
  });

  it('nghỉ giữa hai phần, đồng hồ phần sau chỉ chạy khi bấm bắt đầu', async () => {
    renderRoom();
    fireEvent.click(await screen.findByRole('button', { name: 'Bắt đầu làm bài' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nộp phần này' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận nộp' }));

    expect(await screen.findByText('Phần tiếp theo: Từ vựng')).toBeInTheDocument();
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu phần 2' }));
    expect(screen.getByRole('timer')).toHaveTextContent('05:00');
  });

  it('Esc đóng hộp xác nhận nộp bài', async () => {
    renderRoom();
    fireEvent.click(await screen.findByRole('button', { name: 'Bắt đầu làm bài' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nộp phần này' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tiếp tục làm bài' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('nút Thoát hỏi lại rồi đưa về danh sách đề, bài làm vẫn còn', async () => {
    renderRoom();
    fireEvent.click(await screen.findByRole('button', { name: 'Bắt đầu làm bài' }));
    fireEvent.click(screen.getByRole('button', { name: 'Đúng' }));
    fireEvent.click(screen.getByRole('button', { name: 'Thoát' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rời phòng thi' }));

    expect(await screen.findByText('Danh sách đề')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(SESSION_KEY)).answers).toEqual({ c1: 'true' });
  });

  it('tải đề lỗi thì báo lỗi và cho thử lại', async () => {
    getExamById.mockRejectedValueOnce(new Error('mất mạng'));
    renderRoom();

    expect(await screen.findByText(/Chưa tải được đề thi/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByRole('button', { name: 'Bắt đầu làm bài' })).toBeInTheDocument();
  });

  it('giảng viên xem trước: làm hết đề nhưng không lưu lượt thi', async () => {
    authState.role = 'teacher';
    renderRoom();

    fireEvent.click(await screen.findByRole('button', { name: 'Bắt đầu làm bài' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nộp phần này' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận nộp' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Bắt đầu phần 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nộp bài' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận nộp' }));

    expect(await screen.findByText(/bản xem trước của giảng viên/)).toBeInTheDocument();
    expect(saveExamAttempt).not.toHaveBeenCalled();
    expect(getExamAttemptsForStudent).not.toHaveBeenCalled();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('học viên nộp xong thì lưu lượt thi và xóa bản lưu tạm', async () => {
    renderRoom();

    fireEvent.click(await screen.findByRole('button', { name: 'Bắt đầu làm bài' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nộp phần này' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận nộp' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Bắt đầu phần 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nộp bài' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận nộp' }));

    expect(await screen.findByText('Kết quả bài thi')).toBeInTheDocument();
    expect(saveExamAttempt).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });
});
