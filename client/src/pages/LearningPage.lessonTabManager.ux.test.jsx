import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LessonTabManager } from './LearningPage';

// Bảng sửa bài tập của giảng viên trong phòng học. Trước đây bảng này bày hết
// mọi tab kèm ô đổi tên và 4 nút cho từng tab, không phân trang, và bấm lưu câu
// hỏi xong là bị đá về tab đầu.

function makeTab(id, title, soCau = 0) {
  return {
    id,
    kind: 'exercise',
    title,
    exercises: Array.from({ length: soCau }, (_, index) => ({
      id: `${id}-q${index + 1}`,
      type: 'multiple_choice',
      prompt: `Câu ${index + 1} của ${title}`,
      options: [
        { label: 'A', text: 'A' },
        { label: 'B', text: 'B' }
      ],
      correctAnswer: 'A'
    }))
  };
}

function makeLesson(exerciseTabs) {
  return {
    id: 'bai-1',
    databaseId: 'bai-1',
    title: 'Chủ đề 1',
    tabs: [{ id: 'video', kind: 'video', title: 'Video', videoUrl: '' }, ...exerciseTabs]
  };
}

function renderManager(lesson, props = {}) {
  return render(
    <MemoryRouter>
      <LessonTabManager lesson={lesson} saving={false} status={null} onSave={vi.fn()} {...props} />
    </MemoryRouter>
  );
}

const rowOf = (title) =>
  Array.from(document.querySelectorAll('.lesson-tab-manager__row')).find((row) =>
    row.querySelector('.lesson-tab-manager__name')?.textContent === title
  );

const tabNames = () =>
  Array.from(document.querySelectorAll('.lesson-tab-manager__name')).map((el) => el.textContent);

describe('LessonTabManager — nút Sửa tab', () => {
  it('mặc định không bày ô đổi tên của tab nào', () => {
    renderManager(makeLesson([makeTab('t1', 'Ngữ pháp'), makeTab('t2', 'Từ vựng')]));

    expect(document.querySelectorAll('.lesson-tab-manager__rename')).toHaveLength(0);
    expect(screen.queryByPlaceholderText('VD: Bài tập ngữ pháp 1')).not.toBeInTheDocument();
  });

  it('bấm "Sửa tab" mới mở ô đổi tên, và chỉ của đúng tab đó', () => {
    renderManager(makeLesson([makeTab('t1', 'Ngữ pháp'), makeTab('t2', 'Từ vựng')]));

    fireEvent.click(within(rowOf('Từ vựng')).getByRole('button', { name: 'Sửa tab' }));

    const renameRows = document.querySelectorAll('.lesson-tab-manager__rename');
    expect(renameRows).toHaveLength(1);
    expect(renameRows[0].querySelector('input').value).toBe('Từ vựng');
  });

  it('đổi tên xong thì tên trên hàng đổi theo', () => {
    renderManager(makeLesson([makeTab('t1', 'Ngữ pháp')]));

    fireEvent.click(screen.getByRole('button', { name: 'Sửa tab' }));
    fireEvent.change(document.querySelector('.lesson-tab-manager__rename input'), {
      target: { value: 'Ngữ pháp nâng cao' }
    });

    expect(tabNames()).toEqual(['Ngữ pháp nâng cao']);
  });

  it('bấm Enter là đóng ô đổi tên', () => {
    renderManager(makeLesson([makeTab('t1', 'Ngữ pháp')]));

    fireEvent.click(screen.getByRole('button', { name: 'Sửa tab' }));
    fireEvent.keyDown(document.querySelector('.lesson-tab-manager__rename input'), { key: 'Enter' });

    expect(document.querySelectorAll('.lesson-tab-manager__rename')).toHaveLength(0);
  });
});

describe('LessonTabManager — ẩn bớt nút', () => {
  it('mặc định chỉ hiện Sửa câu hỏi / Sửa tab / ⋯, không hiện Xóa', () => {
    renderManager(makeLesson([makeTab('t1', 'Ngữ pháp')]));

    expect(screen.getByRole('button', { name: 'Sửa câu hỏi' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sửa tab' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Xóa tab/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đưa tab lên trên' })).not.toBeInTheDocument();
  });

  it('bấm ⋯ mới bung ↑ ↓ Xóa', () => {
    renderManager(makeLesson([makeTab('t1', 'Ngữ pháp'), makeTab('t2', 'Từ vựng')]));

    fireEvent.click(within(rowOf('Ngữ pháp')).getByRole('button', { name: /Thêm thao tác/ }));

    expect(screen.getByRole('button', { name: 'Xóa tab Ngữ pháp' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đưa tab lên trên' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Đưa tab xuống dưới' })).toBeEnabled();
  });

  it('xóa tab đang có câu hỏi thì phải xác nhận', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderManager(makeLesson([makeTab('t1', 'Ngữ pháp', 3)]));

    fireEvent.click(screen.getByRole('button', { name: /Thêm thao tác/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Xóa tab Ngữ pháp' }));

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('3 câu hỏi'));
    // Bấm Hủy thì tab còn nguyên.
    expect(tabNames()).toEqual(['Ngữ pháp']);
    confirmSpy.mockRestore();
  });
});

describe('LessonTabManager — phân trang', () => {
  const nhieuTab = Array.from({ length: 12 }, (_, index) => makeTab(`t${index + 1}`, `Bài tập ${index + 1}`));

  it('chỉ hiện 5 tab mỗi trang thay vì đổ hết ra', () => {
    renderManager(makeLesson(nhieuTab));

    expect(tabNames()).toEqual(['Bài tập 1', 'Bài tập 2', 'Bài tập 3', 'Bài tập 4', 'Bài tập 5']);
  });

  it('sang trang sau thì hiện đúng nhóm tiếp theo', () => {
    renderManager(makeLesson(nhieuTab));
    fireEvent.click(screen.getByRole('button', { name: /Sau|Tiếp|›|Next/i }));

    expect(tabNames()).toEqual(['Bài tập 6', 'Bài tập 7', 'Bài tập 8', 'Bài tập 9', 'Bài tập 10']);
  });

  it('số thứ tự và nút ↑ tính theo cả danh sách, không theo trang', () => {
    renderManager(makeLesson(nhieuTab));
    fireEvent.click(screen.getByRole('button', { name: /Sau|Tiếp|›|Next/i }));

    // Tab đầu trang 2 là tab thứ 6 — nút "lên trên" phải còn bấm được.
    expect(rowOf('Bài tập 6').querySelector('.lesson-tab-manager__pick').textContent).toBe('6');
    fireEvent.click(within(rowOf('Bài tập 6')).getByRole('button', { name: /Thêm thao tác/ }));
    expect(screen.getByRole('button', { name: 'Đưa tab lên trên' })).toBeEnabled();
  });

  it('ít tab thì không hiện thanh phân trang', () => {
    renderManager(makeLesson([makeTab('t1', 'Ngữ pháp'), makeTab('t2', 'Từ vựng')]));
    expect(document.querySelector('.pagination-controls')).toBeNull();
  });
});

describe('LessonTabManager — báo chưa lưu', () => {
  it('chưa đụng gì thì không báo, và nút lưu bị khóa', () => {
    renderManager(makeLesson([makeTab('t1', 'Ngữ pháp')]));

    expect(screen.queryByText('Chưa lưu thay đổi tab')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu cấu trúc tab' })).toBeDisabled();
  });

  it('đổi tên tab thì báo chưa lưu và mở khóa nút lưu', () => {
    renderManager(makeLesson([makeTab('t1', 'Ngữ pháp')]));

    fireEvent.click(screen.getByRole('button', { name: 'Sửa tab' }));
    fireEvent.change(document.querySelector('.lesson-tab-manager__rename input'), {
      target: { value: 'Tên mới' }
    });

    expect(screen.getByText('Chưa lưu thay đổi tab')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu cấu trúc tab' })).toBeEnabled();
  });

  it('bấm lưu thì gửi đúng cấu trúc tab đã sửa', () => {
    const onSave = vi.fn();
    renderManager(makeLesson([makeTab('t1', 'Ngữ pháp')]), { onSave });

    fireEvent.click(screen.getByRole('button', { name: 'Sửa tab' }));
    fireEvent.change(document.querySelector('.lesson-tab-manager__rename input'), {
      target: { value: 'Tên mới' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cấu trúc tab' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].find((tab) => tab.kind === 'exercise').title).toBe('Tên mới');
  });
});

describe('LessonTabManager — giữ đúng tab đang mở', () => {
  it('lưu câu hỏi xong vẫn đứng ở tab đang sửa, không bị đá về tab đầu', () => {
    const lesson = makeLesson([
      makeTab('t1', 'Ngữ pháp', 1),
      makeTab('t2', 'Từ vựng', 1),
      makeTab('t3', 'Luyện nghe', 1)
    ]);
    const { rerender } = renderManager(lesson);

    fireEvent.click(within(rowOf('Luyện nghe')).getByRole('button', { name: 'Sửa câu hỏi' }));
    expect(screen.getByRole('heading', { name: /Luyện nghe/ })).toBeInTheDocument();

    // Lưu xong, cha đẩy xuống lesson mới (tabs đổi vì câu hỏi vừa được ghi).
    const lessonSauKhiLuu = makeLesson([
      makeTab('t1', 'Ngữ pháp', 1),
      makeTab('t2', 'Từ vựng', 1),
      makeTab('t3', 'Luyện nghe', 2)
    ]);
    rerender(
      <MemoryRouter>
        <LessonTabManager lesson={lessonSauKhiLuu} saving={false} status={null} onSave={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /Luyện nghe/ })).toBeInTheDocument();
    expect(rowOf('Luyện nghe')).toHaveClass('is-selected');
  });

  it('chuyển sang BÀI khác thì mới bỏ chọn, quay về tab đầu của bài mới', () => {
    const { rerender } = renderManager(makeLesson([makeTab('t1', 'Ngữ pháp'), makeTab('t2', 'Từ vựng')]));

    fireEvent.click(within(rowOf('Từ vựng')).getByRole('button', { name: 'Sửa câu hỏi' }));
    expect(rowOf('Từ vựng')).toHaveClass('is-selected');

    const baiKhac = {
      ...makeLesson([makeTab('x1', 'Đọc hiểu'), makeTab('x2', 'Viết')]),
      id: 'bai-2'
    };
    rerender(
      <MemoryRouter>
        <LessonTabManager lesson={baiKhac} saving={false} status={null} onSave={vi.fn()} />
      </MemoryRouter>
    );

    expect(rowOf('Đọc hiểu')).toHaveClass('is-selected');
  });
});
