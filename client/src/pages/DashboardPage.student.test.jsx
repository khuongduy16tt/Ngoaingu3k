import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Hai chỉ số "Điểm trung bình" và "Chuỗi học tập" trước đây là số cứng ('89',
// '12 ngày'). Test này khóa lại việc chúng lấy từ tiến độ thật, và khi học viên
// chưa có bài nào chấm điểm thì hiện gạch ngang chứ không hiện 0%.

vi.mock('../providers/AuthProvider', () => ({
  useAuth: () => ({
    session: null,
    profile: null,
    user: { id: 'hoc-vien-1', email: 'hocvien@ngoaingu3k.local' }
  })
}));

vi.mock('../lib/courseService', async (importOriginal) => ({
  ...(await importOriginal()),
  getCourseCatalog: vi.fn(async () => []),
  getOwnedCourseIds: vi.fn(async () => ['khoa-1', 'khoa-2'])
}));

vi.mock('../lib/assignmentService', async (importOriginal) => ({
  ...(await importOriginal()),
  getAssignmentsForStudent: vi.fn(async () => [])
}));

const getAllLessonProgress = vi.fn();
const getExamAttemptsForStudent = vi.fn();

vi.mock('../lib/progressService', () => ({
  getAllLessonProgress: (...args) => getAllLessonProgress(...args)
}));

vi.mock('../lib/examService', async (importOriginal) => ({
  ...(await importOriginal()),
  getExamAttemptsForStudent: (...args) => getExamAttemptsForStudent(...args)
}));

import { StudentDashboardPage } from './DashboardPage';

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/dashboard/student']}>
      <StudentDashboardPage />
    </MemoryRouter>
  );
}

function getMetricValue(label) {
  // Cấu trúc thẻ chỉ số: <article><span>nhãn</span><strong>giá trị</strong></article>
  return screen.getByText(label).parentElement.querySelector('strong').textContent;
}

describe('StudentDashboardPage — chỉ số học tập', () => {
  it('tính điểm trung bình và chuỗi ngày học từ tiến độ thật', async () => {
    const homNay = new Date();
    const homQua = new Date(homNay.getFullYear(), homNay.getMonth(), homNay.getDate() - 1);

    getAllLessonProgress.mockResolvedValue([
      { score: 8, maxScore: 10, updatedAt: homNay.toISOString() },
      { score: 6, maxScore: 10, updatedAt: homQua.toISOString() },
      // Bài video không chấm điểm, không được kéo điểm trung bình xuống.
      { score: null, maxScore: null, updatedAt: homQua.toISOString() }
    ]);
    getExamAttemptsForStudent.mockResolvedValue([]);

    renderDashboard();

    expect(await screen.findByText('Điểm trung bình')).toBeInTheDocument();
    expect(getMetricValue('Điểm trung bình')).toBe('70%');
    expect(getMetricValue('Chuỗi học tập')).toBe('2 ngày');
    expect(getMetricValue('Khóa đã sở hữu')).toBe('2');
  });

  it('gộp cả điểm bài thi vào điểm trung bình', async () => {
    const homNay = new Date();

    getAllLessonProgress.mockResolvedValue([
      { score: 10, maxScore: 10, updatedAt: homNay.toISOString() }
    ]);
    getExamAttemptsForStudent.mockResolvedValue([
      { score: 5, maxScore: 20, submittedAt: homNay.toISOString() }
    ]);

    renderDashboard();

    expect(await screen.findByText('Điểm trung bình')).toBeInTheDocument();
    // Tổng 15/30 = 50%. Nếu lấy trung bình cộng của hai tỉ lệ (100% và 25%) thì
    // ra 63% — số liệu chọn lệch nhau để test bắt được nếu ai đó đổi cách cộng.
    expect(getMetricValue('Điểm trung bình')).toBe('50%');
  });

  it('chưa có bài nào chấm điểm thì hiện gạch ngang, không hiện 0%', async () => {
    getAllLessonProgress.mockResolvedValue([]);
    getExamAttemptsForStudent.mockResolvedValue([]);

    renderDashboard();

    expect(await screen.findByText('Điểm trung bình')).toBeInTheDocument();
    expect(getMetricValue('Điểm trung bình')).toBe('—');
    expect(getMetricValue('Chuỗi học tập')).toBe('—');
  });
});
