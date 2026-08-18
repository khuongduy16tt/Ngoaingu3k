import { describe, expect, it, vi } from 'vitest';
import { createEvent, fireEvent, render } from '@testing-library/react';
import { CourseLessonList } from './CourseLessonList';

// Danh sách bài dùng chung giữa phòng học và trang khóa học công khai. Kéo thả
// phải là thứ phải BẬT mới có: mặc định tắt thì không được mọc thêm tay cầm nào.

const sections = [
  {
    id: 'chuong-1',
    title: 'Chương 1',
    lessons: [
      { id: 'bai-1', title: 'Bài 1', status: 'active' },
      { id: 'bai-2', title: 'Bài 2', status: 'active' }
    ]
  },
  {
    id: 'chuong-2',
    title: 'Chương 2',
    lessons: [{ id: 'bai-3', title: 'Bài 3', status: 'active' }]
  }
];

function renderList(props = {}) {
  return render(
    <CourseLessonList sections={sections} expandedSections={{ 0: true, 1: true }} {...props} />
  );
}

function handles() {
  return document.querySelectorAll('.lesson-list-item-drag__handle');
}

function rowOf(title) {
  return Array.from(document.querySelectorAll('.lesson-list-item-drag')).find((row) =>
    row.textContent.includes(title)
  );
}

// jsdom không có DragEvent nên fireEvent bỏ mất clientY trong init — gắn tay.
function fireDrag(type, element, clientY = 0) {
  const event = createEvent[type](element, {
    dataTransfer: { effectAllowed: '', dropEffect: '', setData: vi.fn(), getData: vi.fn(() => '') }
  });
  Object.defineProperty(event, 'clientY', { value: clientY });
  fireEvent(element, event);
}

function outline(nextSections) {
  return nextSections.map((section) => [section.title, section.lessons.map((l) => l.title)]);
}

describe('CourseLessonList — kéo thả chỉ khi được bật', () => {
  it('mặc định KHÔNG có tay cầm kéo (trang công khai giữ nguyên như cũ)', () => {
    renderList();
    expect(handles()).toHaveLength(0);
  });

  it('có onReorderLessons nhưng editable=false thì vẫn không kéo được', () => {
    renderList({ onReorderLessons: vi.fn() });
    expect(handles()).toHaveLength(0);
  });

  it('editable=true nhưng thiếu onReorderLessons thì cũng không bật kéo', () => {
    renderList({ editable: true });
    expect(handles()).toHaveLength(0);
  });

  it('bật đủ hai thứ mới hiện tay cầm cho từng bài', () => {
    renderList({ editable: true, onReorderLessons: vi.fn() });
    expect(handles()).toHaveLength(3);
  });
});

describe('CourseLessonList — kết quả kéo thả', () => {
  it('đổi thứ tự trong cùng một chương', () => {
    const onReorderLessons = vi.fn();
    renderList({ editable: true, onReorderLessons });

    fireDrag('dragStart', rowOf('Bài 1'));
    fireDrag('dragOver', rowOf('Bài 2'), 1);
    fireDrag('drop', rowOf('Bài 2'), 1);

    expect(onReorderLessons).toHaveBeenCalledTimes(1);
    expect(outline(onReorderLessons.mock.calls[0][0])).toEqual([
      ['Chương 1', ['Bài 2', 'Bài 1']],
      ['Chương 2', ['Bài 3']]
    ]);
  });

  it('kéo bài sang chương khác, thả trước một bài của chương đó', () => {
    const onReorderLessons = vi.fn();
    renderList({ editable: true, onReorderLessons });

    fireDrag('dragStart', rowOf('Bài 1'));
    fireDrag('dragOver', rowOf('Bài 3'), -1);
    fireDrag('drop', rowOf('Bài 3'), -1);

    expect(outline(onReorderLessons.mock.calls[0][0])).toEqual([
      ['Chương 1', ['Bài 2']],
      ['Chương 2', ['Bài 1', 'Bài 3']]
    ]);
  });

  it('thả vào vùng trống của chương thì bài rơi xuống cuối chương đó', () => {
    const onReorderLessons = vi.fn();
    const { container } = renderList({ editable: true, onReorderLessons });

    const vungChuong2 = container.querySelectorAll('.lesson-list-section__lessons')[1];
    fireDrag('dragStart', rowOf('Bài 1'));
    fireDrag('dragOver', vungChuong2);
    fireDrag('drop', vungChuong2);

    expect(outline(onReorderLessons.mock.calls[0][0])).toEqual([
      ['Chương 1', ['Bài 2']],
      ['Chương 2', ['Bài 3', 'Bài 1']]
    ]);
  });

  it('bấm vào hàng bài vẫn mở bài, kéo thả không nuốt mất cú bấm', () => {
    const onSelectLesson = vi.fn();
    renderList({ editable: true, onReorderLessons: vi.fn(), onSelectLesson });

    fireEvent.click(rowOf('Bài 2').querySelector('button.lesson-list-item'));
    expect(onSelectLesson).toHaveBeenCalledWith('bai-2');
  });
});

function sectionDragRow(title) {
  return Array.from(document.querySelectorAll('.lesson-list-section')).find((el) =>
    el.querySelector('.lesson-list-section__copy strong')?.textContent === title
  );
}

function sectionHandle(title) {
  return sectionDragRow(title).querySelector('.lesson-list-section__drag-row');
}

describe('CourseLessonList — kéo đổi thứ tự chương', () => {
  it('mặc định không có tay cầm chương', () => {
    renderList({ editable: true, onReorderLessons: vi.fn() });
    expect(document.querySelectorAll('.lesson-list-section__drag-row')).toHaveLength(0);
  });

  it('phải có cả editable lẫn onReorderSections mới hiện tay cầm chương', () => {
    renderList({ onReorderSections: vi.fn() });
    expect(document.querySelectorAll('.lesson-list-section__drag-row')).toHaveLength(0);

    document.body.innerHTML = '';
    renderList({ editable: true, onReorderSections: vi.fn() });
    expect(document.querySelectorAll('.lesson-list-section__drag-row')).toHaveLength(2);
  });

  it('kéo chương 2 lên trước chương 1', () => {
    const onReorderSections = vi.fn();
    renderList({ editable: true, onReorderSections });

    fireDrag('dragStart', sectionHandle('Chương 2'));
    fireDrag('dragOver', sectionDragRow('Chương 1'), -1);
    fireDrag('drop', sectionDragRow('Chương 1'), -1);

    expect(onReorderSections).toHaveBeenCalledTimes(1);
    expect(onReorderSections.mock.calls[0][0].map((s) => s.title)).toEqual(['Chương 2', 'Chương 1']);
  });

  it('kéo chương 1 xuống sau chương 2', () => {
    const onReorderSections = vi.fn();
    renderList({ editable: true, onReorderSections });

    fireDrag('dragStart', sectionHandle('Chương 1'));
    fireDrag('dragOver', sectionDragRow('Chương 2'), 1);
    fireDrag('drop', sectionDragRow('Chương 2'), 1);

    expect(onReorderSections.mock.calls[0][0].map((s) => s.title)).toEqual(['Chương 2', 'Chương 1']);
  });

  it('thả về đúng chỗ cũ thì không gọi lưu', () => {
    const onReorderSections = vi.fn();
    renderList({ editable: true, onReorderSections });

    fireDrag('dragStart', sectionHandle('Chương 1'));
    fireDrag('dragOver', sectionDragRow('Chương 1'), -1);
    fireDrag('drop', sectionDragRow('Chương 1'), -1);

    expect(onReorderSections).not.toHaveBeenCalled();
  });

  it('kéo chương không đụng tới thứ tự bài bên trong', () => {
    const onReorderSections = vi.fn();
    renderList({ editable: true, onReorderSections });

    fireDrag('dragStart', sectionHandle('Chương 2'));
    fireDrag('dragOver', sectionDragRow('Chương 1'), -1);
    fireDrag('drop', sectionDragRow('Chương 1'), -1);

    const next = onReorderSections.mock.calls[0][0];
    expect(next.map((s) => s.lessons.map((l) => l.title))).toEqual([['Bài 3'], ['Bài 1', 'Bài 2']]);
  });

  it('kéo bài không kích hoạt nhánh đổi chương', () => {
    const onReorderSections = vi.fn();
    const onReorderLessons = vi.fn();
    renderList({ editable: true, onReorderLessons, onReorderSections });

    fireDrag('dragStart', rowOf('Bài 1'));
    fireDrag('dragOver', rowOf('Bài 2'), 1);
    fireDrag('drop', rowOf('Bài 2'), 1);

    expect(onReorderLessons).toHaveBeenCalledTimes(1);
    expect(onReorderSections).not.toHaveBeenCalled();
  });
});
