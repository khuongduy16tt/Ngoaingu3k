import { beforeEach, describe, expect, it, vi } from 'vitest';

// Nút "Cập nhật bài học" của admin từng xóa sạch tabs/exercises vì lúc lưu
// đọc lại content từ ô ghi chú. Mock ghi lại payload update để kiểm tra.
const { supabaseState } = vi.hoisted(() => ({
  supabaseState: { calls: [] }
}));

vi.mock('./supabase', () => ({
  isSupabaseReady: () => true,
  supabase: {
    from(table) {
      const call = { table, payload: null, filters: {} };
      const builder = {
        update(payload) {
          call.payload = payload;
          return builder;
        },
        eq(column, value) {
          call.filters[column] = value;
          supabaseState.calls.push(call);
          return Promise.resolve({ error: null });
        }
      };
      return builder;
    }
  }
}));

import { saveAdminLesson } from './adminService';

const LESSON_ID = '44444444-4444-4444-4444-444444444444';
const OLD_URL = 'https://drive.google.com/file/d/OLD_FILE/view';
const NEW_URL = 'https://drive.google.com/file/d/NEW_FILE/view';

function makeContentRaw() {
  return {
    version: 2,
    note: 'Chủ đề 2 · Video Google Drive',
    videoUrl: OLD_URL,
    videoEmbedUrl: 'https://drive.google.com/file/d/OLD_FILE/preview',
    tabs: [
      { id: 'tab-video', kind: 'video', title: 'Video', videoUrl: OLD_URL },
      { id: 'tab-ex-1', kind: 'exercise', title: 'Bài tập 1' }
    ],
    exercises: [{ id: 'q1' }, { id: 'q2' }]
  };
}

// Giống draft sau khi bấm "Sửa": content là chữ ghi chú, contentRaw là object gốc.
function makeDraft(overrides = {}) {
  return {
    id: LESSON_ID,
    databaseId: LESSON_ID,
    courseId: 'course-1',
    chapterId: 'chapter-1',
    title: 'TỪ VỰNG',
    content: 'Chủ đề 2 · Video Google Drive',
    contentRaw: makeContentRaw(),
    videoUrl: OLD_URL,
    position: 1,
    isPreview: false,
    source: 'supabase',
    ...overrides
  };
}

function savedContent() {
  return supabaseState.calls.find((call) => call.table === 'lessons').payload.content;
}

beforeEach(() => {
  localStorage.clear();
  supabaseState.calls = [];
});

describe('saveAdminLesson', () => {
  it('giữ nguyên tabs và bài tập khi chỉ sửa ghi chú', async () => {
    await saveAdminLesson(makeDraft({ content: 'Ghi chú mới' }));

    const content = savedContent();
    expect(content.note).toBe('Ghi chú mới');
    expect(content.tabs).toHaveLength(2);
    expect(content.exercises).toHaveLength(2);
    expect(content.videoUrl).toBe(OLD_URL);
  });

  it('đổi Video URL thì ghi link mới vào cả content và tab video', async () => {
    await saveAdminLesson(makeDraft({ videoUrl: NEW_URL }));

    const call = supabaseState.calls.find((item) => item.table === 'lessons');
    const content = call.payload.content;
    expect(call.payload.video_url).toBe(NEW_URL);
    expect(content.videoUrl).toBe(NEW_URL);
    expect(content.videoEmbedUrl).toBe('');
    expect(content.tabs.find((tab) => tab.kind === 'video').videoUrl).toBe(NEW_URL);
    expect(content.exercises).toHaveLength(2);
  });

  it('dán cả JSON vào ô nội dung thì dùng JSON đó', async () => {
    const pasted = { ...makeContentRaw(), note: 'Từ JSON' };
    await saveAdminLesson(makeDraft({ content: JSON.stringify(pasted) }));

    const content = savedContent();
    expect(content.note).toBe('Từ JSON');
    expect(content.tabs).toHaveLength(2);
  });
});
