import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

// Trang Flashcard: tải hỏng phải báo lỗi (không báo "chưa có bộ nào"), thẻ bộ
// hiện số thẻ + tiến độ, mở bộ đi qua URL để nút Back quay về danh sách, và
// giảng viên sửa được bộ thẻ có sẵn.

const authState = { role: 'student' };

vi.mock('../providers/AuthProvider', () => ({
  useAuth: () => ({
    ready: true,
    session: { access_token: 'token' },
    profile: { role: authState.role },
    user: { id: 'u1', email: 'u1@ngoaingu3k.local' }
  })
}));

// Chạy bằng kho localStorage (chế độ không có Supabase), kể cả khi máy có .env.
vi.mock('../lib/supabase', async (importOriginal) => ({
  ...(await importOriginal()),
  supabase: null,
  isSupabaseReady: () => false
}));

const course = { id: 'khoa-1', databaseId: 'khoa-1', title: 'HSK 1' };

vi.mock('../lib/courseService', async (importOriginal) => ({
  ...(await importOriginal()),
  getCourseCatalog: vi.fn(async () => [course]),
  getOwnedCourseIds: vi.fn(async () => ['khoa-1']),
  getMyCourses: vi.fn(async () => [course])
}));

const setsFailure = { fail: false };

vi.mock('../lib/flashcardService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getFlashcardSets: async (...args) => {
      if (setsFailure.fail) throw new TypeError('Failed to fetch');
      return actual.getFlashcardSets(...args);
    }
  };
});

import FlashcardsPage from './FlashcardsPage';
import { MOCK_FLASHCARD_PROGRESS_STORAGE_KEY, MOCK_FLASHCARD_SETS_STORAGE_KEY } from '../lib/flashcardService';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="search">{location.search}</output>;
}

function renderPage(initial = '/flashcards') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="/flashcards"
          element={
            <>
              <FlashcardsPage />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  authState.role = 'student';
  setsFailure.fail = false;
  localStorage.clear();
  localStorage.setItem(
    MOCK_FLASHCARD_SETS_STORAGE_KEY,
    JSON.stringify([
      {
        id: 'set-1',
        course_id: 'khoa-1',
        title: 'Chủ đề 1',
        cards: [
          { id: 'c1', term: '你好', definition: 'xin chào' },
          { id: 'c2', term: '谢谢', definition: 'cảm ơn' }
        ]
      }
    ])
  );
  localStorage.setItem(
    MOCK_FLASHCARD_PROGRESS_STORAGE_KEY,
    JSON.stringify({ 'u1:set-1': { c1: { mastered: true, correctStreak: 2, wrongCount: 0 } } })
  );
});

describe('FlashcardsPage', () => {
  it('thẻ bộ hiện số thẻ và số thẻ đã thuộc', async () => {
    renderPage();
    expect(await screen.findByText('2 thẻ · đã thuộc 1/2')).toBeInTheDocument();
  });

  it('tải danh sách hỏng thì báo lỗi kèm nút Thử lại', async () => {
    setsFailure.fail = true;
    renderPage();
    expect(await screen.findByText('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.')).toBeInTheDocument();
    expect(screen.queryByText(/chưa có bộ thẻ nào/i)).not.toBeInTheDocument();

    setsFailure.fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Chủ đề 1')).toBeInTheDocument();
  });

  it('mở bộ thẻ ghi lên URL và nút quay về đưa về danh sách', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('Chủ đề 1'));

    expect(await screen.findByRole('button', { name: '← Về danh sách bộ thẻ' })).toBeInTheDocument();
    expect(screen.getByTestId('search')).toHaveTextContent('?set=set-1');

    fireEvent.click(screen.getByRole('button', { name: '← Về danh sách bộ thẻ' }));
    expect(await screen.findByText('2 thẻ · đã thuộc 1/2')).toBeInTheDocument();
    expect(screen.getByTestId('search')).toHaveTextContent('');
  });

  it('mở link thẳng tới bộ đã bị xóa thì báo lỗi và ở lại danh sách', async () => {
    renderPage('/flashcards?set=khong-co');
    expect(await screen.findByText(/Không mở được bộ thẻ này/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent(''));
  });

  it('giảng viên bấm Sửa thì nội dung bộ thẻ được đổ vào ô nhập', async () => {
    authState.role = 'teacher';
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Sửa' }));

    expect(await screen.findByRole('heading', { name: 'Sửa bộ thẻ "Chủ đề 1"' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Chủ đề 1')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Dán nội dung' })).toHaveValue('你好\txin chào\n谢谢\tcảm ơn');
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeEnabled();
  });
});
