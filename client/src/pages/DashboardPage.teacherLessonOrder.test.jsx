import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Trình soạn khóa của giảng viên phải cho sắp xếp cả ba chiều: đổi thứ tự chương,
// đổi thứ tự bài trong một chương, và kéo bài từ chương này sang chương khác.
// Test này khóa lại cả ba, vì trước đây thao tác thứ ba bị chặn cứng bằng điều
// kiện "chương nguồn phải trùng chương đích".

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

function makeLesson(id, title) {
  return {
    id,
    title,
    lessonNumber: '1',
    exerciseType: 'Nhập thủ công',
    status: 'active',
    questionCount: 0,
    questions: [],
    exercises: []
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
            lessons: [makeLesson('bai-a', 'Bài A'), makeLesson('bai-b', 'Bài B')]
          },
          {
            title: 'Chương 2',
            lessons: [makeLesson('bai-c', 'Bài C')]
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
    // ?muc=khoa-hoc: trình soạn khóa nằm trong mục "Khóa học" của bảng giảng viên.
    <MemoryRouter initialEntries={['/dashboard/teacher?muc=khoa-hoc']}>
      <TeacherDashboardPage />
    </MemoryRouter>
  );
}

// Ảnh chụp thứ tự hiện tại: [['Chương 1', ['Bài A', 'Bài B']], ...]
function readOutline() {
  return Array.from(document.querySelectorAll('.import-lesson-section')).map((section) => [
    section.querySelector('.import-lesson-section__title-input').value,
    Array.from(section.querySelectorAll('.import-lesson-pill strong')).map((node) => node.textContent)
  ]);
}

function getLessonPill(title) {
  return Array.from(document.querySelectorAll('.import-lesson-pill')).find(
    (pill) => pill.querySelector('strong')?.textContent === title
  );
}

function getSectionNode(index) {
  return document.querySelectorAll('.import-lesson-section')[index];
}

// jsdom trả getBoundingClientRect toàn số 0, nên clientY âm = nửa trên của bài
// đích (thả trước), clientY dương = nửa dưới (thả sau).
const DROP_BEFORE = -1;
const DROP_AFTER = 1;

function createDataTransfer() {
  return { effectAllowed: '', dropEffect: '', setData: vi.fn(), getData: vi.fn(() => '') };
}

// jsdom không có DragEvent nên fireEvent dựng sự kiện bằng Event thường và bỏ
// mất clientY trong init — phải gắn tay vào sự kiện trước khi bắn.
function fireDragEvent(type, element, { dataTransfer, clientY = 0 }) {
  const event = createEvent[type](element, { dataTransfer });
  Object.defineProperty(event, 'clientY', { value: clientY });
  fireEvent(element, event);
}

function dragLessonOntoLesson(fromTitle, toTitle, clientY) {
  const dataTransfer = createDataTransfer();
  fireDragEvent('dragStart', getLessonPill(fromTitle), { dataTransfer });
  fireDragEvent('dragOver', getLessonPill(toTitle), { dataTransfer, clientY });
  fireDragEvent('drop', getLessonPill(toTitle), { dataTransfer, clientY });
}

describe('TeacherDashboardPage — sắp xếp chương và bài bằng kéo thả', () => {
  beforeEach(() => {
    localStorage.clear();
    seedDraft();
    // jsdom không có Element.scrollBy; cuộn mép danh sách khi kéo chỉ có ý nghĩa
    // trên trình duyệt thật nên chỉ cần cho nó tồn tại.
    Element.prototype.scrollBy = vi.fn();
  });

  it('kéo bài sang chương khác, thả trước một bài của chương đó', async () => {
    renderTeacherDashboard();
    expect(await screen.findByDisplayValue('Chương 1')).toBeInTheDocument();

    dragLessonOntoLesson('Bài A', 'Bài C', DROP_BEFORE);

    expect(readOutline()).toEqual([
      ['Chương 1', ['Bài B']],
      ['Chương 2', ['Bài A', 'Bài C']]
    ]);
  });

  it('kéo bài sang chương khác, thả sau một bài của chương đó', async () => {
    renderTeacherDashboard();
    expect(await screen.findByDisplayValue('Chương 1')).toBeInTheDocument();

    dragLessonOntoLesson('Bài A', 'Bài C', DROP_AFTER);

    expect(readOutline()).toEqual([
      ['Chương 1', ['Bài B']],
      ['Chương 2', ['Bài C', 'Bài A']]
    ]);
  });

  it('thả vào vùng trống của chương khác thì bài rơi xuống cuối chương đó', async () => {
    renderTeacherDashboard();
    expect(await screen.findByDisplayValue('Chương 1')).toBeInTheDocument();

    const dataTransfer = createDataTransfer();
    fireDragEvent('dragStart', getLessonPill('Bài A'), { dataTransfer });
    fireDragEvent('dragOver', getSectionNode(1), { dataTransfer });
    fireDragEvent('drop', getSectionNode(1), { dataTransfer });

    expect(readOutline()).toEqual([
      ['Chương 1', ['Bài B']],
      ['Chương 2', ['Bài C', 'Bài A']]
    ]);
  });

  it('bài chuyển chương thì đánh số lại và mang tên chương mới', async () => {
    renderTeacherDashboard();
    expect(await screen.findByDisplayValue('Chương 1')).toBeInTheDocument();

    dragLessonOntoLesson('Bài A', 'Bài C', DROP_BEFORE);

    const chuong2 = getSectionNode(1);
    expect(Array.from(chuong2.querySelectorAll('.import-lesson-pill__main > span')).map((n) => n.textContent)).toEqual([
      'Bài 1',
      'Bài 2'
    ]);
    // Panel soạn bài bám theo bài vừa kéo và hiện tên chương mới của nó.
    expect(screen.getByText('Sửa bài học').closest('.section-head').textContent).toContain('Bài A');
    expect(chuong2.textContent).toContain('2 bài');
  });

  it('Alt + →/← chuyển bài sang chương sau/chương trước bằng bàn phím', async () => {
    renderTeacherDashboard();
    expect(await screen.findByDisplayValue('Chương 1')).toBeInTheDocument();

    fireEvent.keyDown(getLessonPill('Bài B'), { key: 'ArrowRight', altKey: true });
    expect(readOutline()).toEqual([
      ['Chương 1', ['Bài A']],
      ['Chương 2', ['Bài B', 'Bài C']]
    ]);

    fireEvent.keyDown(getLessonPill('Bài B'), { key: 'ArrowLeft', altKey: true });
    expect(readOutline()).toEqual([
      ['Chương 1', ['Bài A', 'Bài B']],
      ['Chương 2', ['Bài C']]
    ]);
  });

  it('vẫn đổi được thứ tự bài trong cùng một chương', async () => {
    renderTeacherDashboard();
    expect(await screen.findByDisplayValue('Chương 1')).toBeInTheDocument();

    dragLessonOntoLesson('Bài B', 'Bài A', DROP_BEFORE);

    expect(readOutline()).toEqual([
      ['Chương 1', ['Bài B', 'Bài A']],
      ['Chương 2', ['Bài C']]
    ]);
  });

  it('vẫn đổi được thứ tự chương, kể cả khi thả trúng một bài của chương đích', async () => {
    renderTeacherDashboard();
    expect(await screen.findByDisplayValue('Chương 1')).toBeInTheDocument();

    const dataTransfer = createDataTransfer();
    const handle = getSectionNode(1).querySelector('.import-lesson-section__drag');
    fireDragEvent('dragStart', handle, { dataTransfer });
    // Con trỏ dừng trên một bài của chương 1: sự kiện phải nổi bọt lên chương,
    // không bị pill nuốt mất.
    fireDragEvent('dragOver', getLessonPill('Bài A'), { dataTransfer, clientY: DROP_BEFORE });
    fireDragEvent('drop', getLessonPill('Bài A'), { dataTransfer, clientY: DROP_BEFORE });

    expect(readOutline()).toEqual([
      ['Chương 2', ['Bài C']],
      ['Chương 1', ['Bài A', 'Bài B']]
    ]);
  });
});
