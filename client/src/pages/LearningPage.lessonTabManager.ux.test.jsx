import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LessonTabManager } from './LearningPage';

// Bảng sửa bài tập của giảng viên trong phòng học. Đây là TAB thật: thanh chip ở
// trên, bấm chip nào thì bên dưới hiện đúng nội dung tab đó. Trước đây mọi tab
// đều bung ra thành hàng riêng kèm trình soạn câu hỏi, nên màn hình dài ra theo
// số tab và không có cách nào xem gọn một tab.

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

const chips = () => Array.from(document.querySelectorAll('.lesson-tab-manager__chip'));
const chipNames = () => chips().map((chip) => chip.querySelector('.lesson-tab-manager__name').textContent);
const chipOf = (title) =>
  chips().find((chip) => chip.querySelector('.lesson-tab-manager__name').textContent === title);
const panel = () => document.querySelector('.lesson-tab-manager__panel');
const panelTitle = () => panel()?.querySelector('.lesson-tab-manager__name')?.textContent || '';
const selectedChipName = () =>
  document.querySelector('.lesson-tab-manager__chip.is-selected .lesson-tab-manager__name')?.textContent || '';

describe('LessonTabManager — bấm tab nào hiện đúng tab đó', () => {
  const baTab = [makeTab('t1', 'Ngữ pháp', 1), makeTab('t2', 'Từ vựng', 1), makeTab('t3', 'Luyện nghe', 1)];

  it('thanh tab liệt kê mọi tab, nhưng chỉ MỘT khung nội dung hiện ra', () => {
    renderManager(makeLesson(baTab));

    expect(chipNames()).toEqual(['Ngữ pháp', 'Từ vựng', 'Luyện nghe']);
    expect(document.querySelectorAll('.lesson-tab-manager__panel')).toHaveLength(1);
    expect(document.querySelectorAll('.lesson-tab-manager__editor')).toHaveLength(1);
  });

  it('mở sẵn tab đầu tiên', () => {
    renderManager(makeLesson(baTab));

    expect(selectedChipName()).toBe('Ngữ pháp');
    expect(panelTitle()).toBe('Ngữ pháp');
    expect(screen.getByRole('heading', { name: /Ngữ pháp/ })).toBeInTheDocument();
  });

  it('bấm chip nào thì khung dưới đổi sang đúng tab đó', () => {
    renderManager(makeLesson(baTab));

    fireEvent.click(chipOf('Luyện nghe'));

    expect(selectedChipName()).toBe('Luyện nghe');
    expect(panelTitle()).toBe('Luyện nghe');
    expect(screen.getByRole('heading', { name: /Luyện nghe/ })).toBeInTheDocument();
    // Câu hỏi của tab khác không được lẫn vào.
    expect(screen.getByDisplayValue('Câu 1 của Luyện nghe')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Câu 1 của Ngữ pháp')).not.toBeInTheDocument();
  });

  it('chip mang đúng vai trò tab cho trình đọc màn hình', () => {
    renderManager(makeLesson(baTab));
    fireEvent.click(chipOf('Từ vựng'));

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
  });
});

describe('LessonTabManager — nút Sửa tab', () => {
  it('mặc định không bày ô đổi tên', () => {
    renderManager(makeLesson([makeTab('t1', 'Ngữ pháp')]));

    expect(document.querySelectorAll('.lesson-tab-manager__rename')).toHaveLength(0);
    expect(screen.queryByPlaceholderText('VD: Bài tập ngữ pháp 1')).not.toBeInTheDocument();
  });

  it('bấm "Sửa tab" mới mở ô đổi tên của tab đang mở', () => {
    renderManager(makeLesson([makeTab('t1', 'Ngữ pháp'), makeTab('t2', 'Từ vựng')]));
    fireEvent.click(chipOf('Từ vựng'));
    fireEvent.click(screen.getByRole('button', { name: 'Sửa tab' }));

    const renameRows = document.querySelectorAll('.lesson-tab-manager__rename');
    expect(renameRows).toHaveLength(1);
    expect(renameRows[0].querySelector('input').value).toBe('Từ vựng');
  });

  it('đổi tên thì cả chip lẫn khung nội dung đổi theo', () => {
    renderManager(makeLesson([makeTab('t1', 'Ngữ pháp')]));

    fireEvent.click(screen.getByRole('button', { name: 'Sửa tab' }));
    fireEvent.change(document.querySelector('.lesson-tab-manager__rename input'), {
      target: { value: 'Ngữ pháp nâng cao' }
    });

    expect(chipNames()).toEqual(['Ngữ pháp nâng cao']);
    expect(panelTitle()).toBe('Ngữ pháp nâng cao');
  });

  it('bấm Enter là đóng ô đổi tên', () => {
    renderManager(makeLesson([makeTab('t1', 'Ngữ pháp')]));

    fireEvent.click(screen.getByRole('button', { name: 'Sửa tab' }));
    fireEvent.keyDown(document.querySelector('.lesson-tab-manager__rename input'), { key: 'Enter' });

    expect(document.querySelectorAll('.lesson-tab-manager__rename')).toHaveLength(0);
  });
});

describe('LessonTabManager — ẩn bớt nút', () => {
  it('mặc định chỉ hiện Sửa tab và ⋯, không hiện Xóa', () => {
    renderManager(makeLesson([makeTab('t1', 'Ngữ pháp')]));

    expect(screen.getByRole('button', { name: 'Sửa tab' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Xóa tab/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đưa tab lên trên' })).not.toBeInTheDocument();
  });

  it('bấm ⋯ mới bung ↑ ↓ Xóa, chỉ cho tab đang mở', () => {
    renderManager(makeLesson([makeTab('t1', 'Ngữ pháp'), makeTab('t2', 'Từ vựng')]));

    fireEvent.click(screen.getByRole('button', { name: /Thêm thao tác/ }));

    expect(screen.getByRole('button', { name: 'Xóa tab Ngữ pháp' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đưa tab lên trên' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Đưa tab xuống dưới' })).toBeEnabled();
  });

  it('xóa tab đang có câu hỏi thì phải xác nhận', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderManager(makeLesson([makeTab('t1', 'Ngữ pháp', 3), makeTab('t2', 'Từ vựng')]));

    fireEvent.click(screen.getByRole('button', { name: /Thêm thao tác/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Xóa tab Ngữ pháp' }));

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('3 câu hỏi'));
    // Bấm Hủy thì tab còn nguyên.
    expect(chipNames()).toEqual(['Ngữ pháp', 'Từ vựng']);
    confirmSpy.mockRestore();
  });
});

describe('LessonTabManager — phân trang thanh tab', () => {
  const nhieuTab = Array.from({ length: 12 }, (_, index) => makeTab(`t${index + 1}`, `Bài tập ${index + 1}`));

  it('chỉ hiện 5 chip mỗi trang', () => {
    renderManager(makeLesson(nhieuTab));

    expect(chipNames()).toEqual(['Bài tập 1', 'Bài tập 2', 'Bài tập 3', 'Bài tập 4', 'Bài tập 5']);
  });

  it('sang trang sau thì hiện đúng nhóm chip tiếp theo', () => {
    renderManager(makeLesson(nhieuTab));
    fireEvent.click(screen.getByRole('button', { name: /Sau|Tiếp|›|Next/i }));

    expect(chipNames()).toEqual(['Bài tập 6', 'Bài tập 7', 'Bài tập 8', 'Bài tập 9', 'Bài tập 10']);
  });

  it('đổi trang KHÔNG đóng tab đang mở', () => {
    renderManager(makeLesson(nhieuTab));
    fireEvent.click(screen.getByRole('button', { name: /Sau|Tiếp|›|Next/i }));

    // Chip của tab 1 không còn trên trang, nhưng nội dung của nó vẫn đang mở.
    expect(chipOf('Bài tập 1')).toBeUndefined();
    expect(panelTitle()).toBe('Bài tập 1');
  });

  it('số thứ tự trên chip tính theo cả danh sách, không theo trang', () => {
    renderManager(makeLesson(nhieuTab));
    fireEvent.click(screen.getByRole('button', { name: /Sau|Tiếp|›|Next/i }));

    expect(chipOf('Bài tập 6').querySelector('.lesson-tab-manager__pick').textContent).toBe('6');
  });

  it('nút ↑ của tab thứ 6 vẫn bấm được, không tính theo vị trí trong trang', () => {
    renderManager(makeLesson(nhieuTab));
    fireEvent.click(screen.getByRole('button', { name: /Sau|Tiếp|›|Next/i }));
    fireEvent.click(chipOf('Bài tập 6'));
    fireEvent.click(screen.getByRole('button', { name: /Thêm thao tác/ }));

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

    fireEvent.click(chipOf('Luyện nghe'));
    expect(panelTitle()).toBe('Luyện nghe');

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

    expect(panelTitle()).toBe('Luyện nghe');
    expect(selectedChipName()).toBe('Luyện nghe');
  });

  it('chuyển sang BÀI khác thì mới bỏ chọn, quay về tab đầu của bài mới', () => {
    const { rerender } = renderManager(makeLesson([makeTab('t1', 'Ngữ pháp'), makeTab('t2', 'Từ vựng')]));

    fireEvent.click(chipOf('Từ vựng'));
    expect(selectedChipName()).toBe('Từ vựng');

    const baiKhac = {
      ...makeLesson([makeTab('x1', 'Đọc hiểu'), makeTab('x2', 'Viết')]),
      id: 'bai-2'
    };
    rerender(
      <MemoryRouter>
        <LessonTabManager lesson={baiKhac} saving={false} status={null} onSave={vi.fn()} />
      </MemoryRouter>
    );

    expect(selectedChipName()).toBe('Đọc hiểu');
  });
});
