import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Tab bài tập trong panel "Sửa bài học" của trình soạn khóa. Bọc StrictMode y
// như main.jsx: React gọi updater của useState hai lần trong dev, nên bug nào
// sinh ra từ việc đặt side effect bên trong updater chỉ lộ ra ở đây.

vi.mock('../providers/AuthProvider', () => ({
  useAuth: () => ({
    session: null,
    profile: { role: 'teacher' },
    user: { id: 'gv-1', email: 'giangvien@ngoaingu3k.local' }
  })
}));

vi.mock('../lib/courseService', async (importOriginal) => ({
  ...(await importOriginal()),
  getMyCourses: vi.fn(async () => [])
}));

import { TeacherDashboardPage } from './DashboardPage';

const TEACHER_ID = 'gv-1';

function makeQuestion(id, prompt) {
  return {
    id,
    number: '1',
    prompt,
    options: [
      { label: 'A', text: 'A' },
      { label: 'B', text: 'B' }
    ],
    answer: 'A',
    correctAnswer: 'A',
    note: ''
  };
}

function seedDraft() {
  localStorage.setItem(
    `teacher-course-draft-v1:${TEACHER_ID}`,
    JSON.stringify({
      courseDraft: {
        title: 'Khóa thử',
        sections: [
          {
            title: 'Chương 1',
            lessons: [
              {
                id: 'bai-a',
                title: 'Bài A',
                lessonNumber: '1',
                exerciseType: 'Nhập thủ công',
                status: 'active',
                tabs: [
                  { id: 'tab-video', kind: 'video', title: 'Video bài học' },
                  {
                    id: 'tab-ex-1',
                    kind: 'exercise',
                    title: 'Bài tập 1',
                    exercises: [makeQuestion('q1', 'Câu của tab 1')]
                  },
                  {
                    id: 'tab-ex-2',
                    kind: 'exercise',
                    title: 'Bài tập 2',
                    exercises: [makeQuestion('q2', 'Câu của tab 2')]
                  }
                ]
              }
            ]
          }
        ]
      },
      selectedDraftLessonId: 'bai-a',
      studentPreviewLessonId: 'bai-a'
    })
  );
  localStorage.setItem(
    `teacher-dashboard-ui-v1:${TEACHER_ID}`,
    JSON.stringify({ coursePublisherOpen: true })
  );
}

function renderTeacherDashboard() {
  return render(
    <React.StrictMode>
      <MemoryRouter initialEntries={['/dashboard/teacher?muc=khoa-hoc']}>
        <TeacherDashboardPage />
      </MemoryRouter>
    </React.StrictMode>
  );
}

// Tiêu đề thanh công cụ soạn câu hỏi: "Câu hỏi · <tên tab đang mở>".
function readActiveTabTitle() {
  return document.querySelector('.lesson-question-editor__toolbar .eyebrow').textContent;
}

// Ô "Nội dung câu" là ô đầu tiên của mỗi thẻ câu hỏi (thẻ còn có ô ghi chú
// dùng chung class auth-field--full nên phải lấy theo từng thẻ).
function readActiveTabPrompts() {
  return Array.from(document.querySelectorAll('.lesson-question-editor__item')).map(
    (item) => item.querySelector('.auth-field--full input').value
  );
}

function readChipTitles() {
  return Array.from(document.querySelectorAll('.draft-tab-chip__title')).map((input) => input.value);
}

function getActiveChipTitle() {
  return document.querySelector('.draft-tab-chip.is-active .draft-tab-chip__title')?.value || '';
}

function clickTab(index) {
  fireEvent.click(document.querySelectorAll('.draft-tab-chip__select')[index]);
}

// Bấm vào tên tab — chỗ to nhất của chip và là chỗ giảng viên bấm theo phản xạ.
function clickTabTitle(index) {
  fireEvent.click(document.querySelectorAll('.draft-tab-chip__title')[index]);
}

describe('TeacherDashboardPage — tab bài tập của một bài học', () => {
  beforeEach(() => {
    localStorage.clear();
    seedDraft();
  });

  it('bấm sang tab khác thì mở đúng câu hỏi của tab đó', async () => {
    renderTeacherDashboard();
    expect(await screen.findByDisplayValue('Bài tập 1')).toBeInTheDocument();

    expect(readActiveTabTitle()).toBe('Câu hỏi · Bài tập 1');
    expect(readActiveTabPrompts()).toEqual(['Câu của tab 1']);

    clickTab(1);

    expect(getActiveChipTitle()).toBe('Bài tập 2');
    expect(readActiveTabTitle()).toBe('Câu hỏi · Bài tập 2');
    expect(readActiveTabPrompts()).toEqual(['Câu của tab 2']);
  });

  // Bug thật: chip tab chỉ đổi được bằng nút số tròn 28px, còn tên tab là ô
  // input đổi tên — bấm vào tên thì tab không đổi, mọi thao tác sửa sau đó rơi
  // vào tab cũ mà giảng viên tưởng đang ở tab mới bấm.
  it('bấm vào tên tab cũng mở tab đó', async () => {
    renderTeacherDashboard();
    expect(await screen.findByDisplayValue('Bài tập 1')).toBeInTheDocument();

    clickTabTitle(1);

    expect(getActiveChipTitle()).toBe('Bài tập 2');
    expect(readActiveTabTitle()).toBe('Câu hỏi · Bài tập 2');
    expect(readActiveTabPrompts()).toEqual(['Câu của tab 2']);
  });

  it('đặt con trỏ vào ô đổi tên của tab khác thì mở luôn tab đó', async () => {
    renderTeacherDashboard();
    expect(await screen.findByDisplayValue('Bài tập 1')).toBeInTheDocument();

    fireEvent.focus(document.querySelectorAll('.draft-tab-chip__title')[1]);

    expect(getActiveChipTitle()).toBe('Bài tập 2');
    expect(readActiveTabPrompts()).toEqual(['Câu của tab 2']);
  });

  it('sửa câu hỏi ở tab đang mở thì không đụng vào tab kia và không nhảy tab', async () => {
    renderTeacherDashboard();
    expect(await screen.findByDisplayValue('Bài tập 1')).toBeInTheDocument();

    clickTab(1);
    fireEvent.change(document.querySelector('.lesson-question-editor__item .auth-field--full input'), {
      target: { value: 'Câu của tab 2 (đã sửa)' }
    });

    expect(readActiveTabTitle()).toBe('Câu hỏi · Bài tập 2');
    expect(readActiveTabPrompts()).toEqual(['Câu của tab 2 (đã sửa)']);

    clickTab(0);
    expect(readActiveTabPrompts()).toEqual(['Câu của tab 1']);
  });

  it('đổi tên tab đang mở thì vẫn đứng ở tab đó', async () => {
    renderTeacherDashboard();
    expect(await screen.findByDisplayValue('Bài tập 1')).toBeInTheDocument();

    clickTab(1);
    fireEvent.change(document.querySelectorAll('.draft-tab-chip__title')[1], {
      target: { value: 'Bài tập nghe' }
    });

    expect(readChipTitles()).toEqual(['Bài tập 1', 'Bài tập nghe']);
    expect(getActiveChipTitle()).toBe('Bài tập nghe');
    expect(readActiveTabPrompts()).toEqual(['Câu của tab 2']);
  });

  it('thêm tab mới thì mở luôn tab vừa thêm', async () => {
    renderTeacherDashboard();
    expect(await screen.findByDisplayValue('Bài tập 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '+ Thêm tab' }));

    expect(readChipTitles()).toEqual(['Bài tập 1', 'Bài tập 2', 'Bài tập 3']);
    expect(getActiveChipTitle()).toBe('Bài tập 3');
    expect(readActiveTabPrompts()).toEqual([]);
  });

  it('thêm câu hỏi thủ công thì câu rơi vào tab đang mở', async () => {
    renderTeacherDashboard();
    expect(await screen.findByDisplayValue('Bài tập 1')).toBeInTheDocument();

    clickTab(1);
    fireEvent.click(screen.getByRole('button', { name: 'Thêm thủ công' }));

    expect(getActiveChipTitle()).toBe('Bài tập 2');
    expect(readActiveTabPrompts()).toEqual(['Câu của tab 2', '']);

    clickTab(0);
    expect(readActiveTabPrompts()).toEqual(['Câu của tab 1']);
  });

  it('xóa tab đang mở thì rơi về tab còn lại, không mất tab kia', async () => {
    renderTeacherDashboard();
    expect(await screen.findByDisplayValue('Bài tập 1')).toBeInTheDocument();

    clickTab(1);
    fireEvent.click(document.querySelectorAll('.draft-tab-chip')[1].querySelector('button:last-child'));

    expect(readChipTitles()).toEqual(['Bài tập 1']);
    expect(readActiveTabPrompts()).toEqual(['Câu của tab 1']);
  });

  it('bài nhập từ Excel (chưa có tabs) thêm tab thứ hai rồi đổi qua lại', async () => {
    // Bài nhập Excel chỉ có `questions` phẳng, chưa có `tabs` — buildLessonTabs
    // dựng tab bài tập giả với id cố định 'lesson-tab-exercise-1'.
    localStorage.setItem(
      `teacher-course-draft-v1:${TEACHER_ID}`,
      JSON.stringify({
        courseDraft: {
          title: 'Khóa thử',
          sections: [
            {
              title: 'Chương 1',
              lessons: [
                {
                  id: 'bai-a',
                  title: 'Bài A',
                  lessonNumber: '1',
                  exerciseType: 'Luyện nghe',
                  questions: [makeQuestion('q1', 'Câu Excel')],
                  exercises: [makeQuestion('q1', 'Câu Excel')]
                }
              ]
            }
          ]
        },
        selectedDraftLessonId: 'bai-a'
      })
    );

    renderTeacherDashboard();
    // Tab bài tập giả lấy tên từ `exerciseType` của bài.
    await screen.findByRole('button', { name: '+ Thêm tab' });
    expect(readChipTitles()).toEqual(['Luyện nghe']);
    expect(readActiveTabPrompts()).toEqual(['Câu Excel']);

    fireEvent.click(screen.getByRole('button', { name: '+ Thêm tab' }));
    expect(getActiveChipTitle()).toBe('Bài tập 2');
    expect(readActiveTabPrompts()).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Thêm thủ công' }));
    expect(getActiveChipTitle()).toBe('Bài tập 2');
    expect(readActiveTabPrompts()).toEqual(['']);

    clickTab(0);
    expect(readActiveTabPrompts()).toEqual(['Câu Excel']);

    clickTab(1);
    expect(readActiveTabPrompts()).toEqual(['']);
  });

  it('đổi bài học rồi quay lại thì tab của từng bài không lẫn sang nhau', async () => {
    localStorage.setItem(
      `teacher-course-draft-v1:${TEACHER_ID}`,
      JSON.stringify({
        courseDraft: {
          title: 'Khóa thử',
          sections: [
            {
              title: 'Chương 1',
              lessons: [
                {
                  id: 'bai-a',
                  title: 'Bài A',
                  exerciseType: 'Nhập thủ công',
                  tabs: [
                    { id: 'tab-video', kind: 'video', title: 'Video bài học' },
                    { id: 'a-1', kind: 'exercise', title: 'A1', exercises: [makeQuestion('qa1', 'Câu A1')] },
                    { id: 'a-2', kind: 'exercise', title: 'A2', exercises: [makeQuestion('qa2', 'Câu A2')] }
                  ]
                },
                {
                  id: 'bai-b',
                  title: 'Bài B',
                  exerciseType: 'Nhập thủ công',
                  tabs: [
                    { id: 'tab-video', kind: 'video', title: 'Video bài học' },
                    { id: 'b-1', kind: 'exercise', title: 'B1', exercises: [makeQuestion('qb1', 'Câu B1')] }
                  ]
                }
              ]
            }
          ]
        },
        selectedDraftLessonId: 'bai-a'
      })
    );

    renderTeacherDashboard();
    expect(await screen.findByDisplayValue('A1')).toBeInTheDocument();

    clickTab(1);
    expect(readActiveTabPrompts()).toEqual(['Câu A2']);

    // Sang bài B: bài này chỉ có một tab, phải mở đúng tab đó.
    fireEvent.click(screen.getByText('Bài B').closest('.import-lesson-pill'));
    expect(readChipTitles()).toEqual(['B1']);
    expect(readActiveTabPrompts()).toEqual(['Câu B1']);

    // Quay lại bài A: danh sách tab của A phải trở lại đầy đủ.
    fireEvent.click(screen.getByText('Bài A').closest('.import-lesson-pill'));
    expect(readChipTitles()).toEqual(['A1', 'A2']);
    expect(readActiveTabPrompts()).toEqual([readActiveTabPrompts()[0]]);
    expect(['Câu A1', 'Câu A2']).toContain(readActiveTabPrompts()[0]);
  });

  it('đổi thứ tự tab bằng ↑/↓ vẫn giữ đúng tab đang mở', async () => {
    renderTeacherDashboard();
    expect(await screen.findByDisplayValue('Bài tập 1')).toBeInTheDocument();

    clickTab(1);
    // Nút ↑ của chip thứ hai.
    fireEvent.click(screen.getAllByRole('button', { name: '↑' })[1]);

    expect(readChipTitles()).toEqual(['Bài tập 2', 'Bài tập 1']);
    expect(getActiveChipTitle()).toBe('Bài tập 2');
    expect(readActiveTabPrompts()).toEqual(['Câu của tab 2']);
  });
});
