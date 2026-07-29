// Mô hình "chủ đề" (một lesson) gồm nhiều tab độc lập thay vì một khối dọc duy
// nhất: 1 tab Video và N tab bài tập được đặt tên riêng ("Bài tập ngữ pháp 1",
// "Bài tập nghe 2"...). Học viên bấm vào chủ đề → chọn phần Video hoặc phần Bài
// tập → trong phần Bài tập mới trải ra từng tab con, nên không bị rối mắt khi
// một chủ đề có 7-8 bài tập.
//
// Dữ liệu cũ (khóa HSK đã nhập) chỉ có `videoUrl` + `exercises` phẳng, không có
// `tabs`. buildLessonTabs() tự dựng tab tương đương nên không cần migrate DB.

const OPTIONAL_TEXT = (value) => String(value ?? '').trim();

export const DEFAULT_VIDEO_TAB_TITLE = 'Video bài học';
export const DEFAULT_EXERCISE_TAB_TITLE = 'Bài tập';

export function isVideoTab(tab) {
  return tab?.kind === 'video';
}

export function isExerciseTab(tab) {
  return tab?.kind === 'exercise';
}

export function normalizeLessonTab(tab, index = 0) {
  // Mặc định là tab bài tập: chỉ tab nào khai báo rõ kind === 'video' mới là video.
  const kind = tab?.kind === 'video' ? 'video' : 'exercise';
  const fallbackTitle = kind === 'video' ? DEFAULT_VIDEO_TAB_TITLE : `${DEFAULT_EXERCISE_TAB_TITLE} ${index + 1}`;

  const base = {
    id: OPTIONAL_TEXT(tab?.id) || `lesson-tab-${index + 1}`,
    kind,
    title: OPTIONAL_TEXT(tab?.title) || fallbackTitle,
    note: OPTIONAL_TEXT(tab?.note)
  };

  if (kind === 'video') {
    return {
      ...base,
      videoUrl: OPTIONAL_TEXT(tab?.videoUrl) || OPTIONAL_TEXT(tab?.videoEmbedUrl),
      videoTitle: OPTIONAL_TEXT(tab?.videoTitle),
      // Bài luyện đọc / bảng phiên âm (import HSK) thuộc phần nội dung, không phải bài tập.
      readingItems: Array.isArray(tab?.readingItems) ? tab.readingItems : [],
      pinyinTable: OPTIONAL_TEXT(tab?.pinyinTable),
      exercises: []
    };
  }

  return {
    ...base,
    videoUrl: '',
    videoTitle: '',
    readingItems: [],
    pinyinTable: '',
    exercises: Array.isArray(tab?.exercises)
      ? tab.exercises
      : Array.isArray(tab?.questions)
        ? tab.questions
        : [],
    // Tài nguyên đính kèm riêng cho từng tab bài tập (file nghe, ảnh đề).
    audioUrl: OPTIONAL_TEXT(tab?.audioUrl),
    audioName: OPTIONAL_TEXT(tab?.audioName),
    imageUrl: OPTIONAL_TEXT(tab?.imageUrl),
    imageName: OPTIONAL_TEXT(tab?.imageName)
  };
}

// Tab video dựng từ dữ liệu cũ nằm thẳng trên lesson.
function buildLegacyVideoTab(lesson) {
  return normalizeLessonTab(
    {
      id: 'lesson-tab-video',
      kind: 'video',
      title: DEFAULT_VIDEO_TAB_TITLE,
      note: lesson?.note,
      videoUrl: lesson?.videoUrl || lesson?.videoEmbedUrl,
      videoTitle: lesson?.videoTitle,
      readingItems: lesson?.readingItems,
      pinyinTable: lesson?.pinyinTable
    },
    0
  );
}

/**
 * Trả về danh sách tab của một chủ đề.
 * - Có `lesson.tabs` → dùng nguyên (model mới).
 * - Không có → dựng 1 tab video + 1 tab bài tập từ `exercises` phẳng (model cũ),
 *   nên khóa học đã nhập vẫn hiển thị đúng mà không phải sửa dữ liệu.
 * Tab video luôn tồn tại để phần Video và phần Bài tập là hai mục độc lập.
 */
export function buildLessonTabs(lesson) {
  const rawTabs = Array.isArray(lesson?.tabs) ? lesson.tabs : [];

  if (rawTabs.length) {
    const tabs = rawTabs.map(normalizeLessonTab);
    return tabs.some(isVideoTab) ? tabs : [buildLegacyVideoTab(lesson), ...tabs];
  }

  const legacyExercises = Array.isArray(lesson?.exercises)
    ? lesson.exercises
    : Array.isArray(lesson?.questions)
      ? lesson.questions
      : [];

  const tabs = [buildLegacyVideoTab(lesson)];

  if (legacyExercises.length) {
    tabs.push(
      normalizeLessonTab(
        {
          id: 'lesson-tab-exercise-1',
          kind: 'exercise',
          title: OPTIONAL_TEXT(lesson?.exerciseType) || `${DEFAULT_EXERCISE_TAB_TITLE} 1`,
          exercises: legacyExercises,
          audioUrl: lesson?.audioUrl,
          audioName: lesson?.audioName,
          imageUrl: lesson?.imageUrl,
          imageName: lesson?.imageName
        },
        0
      )
    );
  }

  return tabs;
}

export function getExerciseTabs(tabs = []) {
  return tabs.filter(isExerciseTab);
}

export function getVideoTab(tabs = []) {
  return tabs.find(isVideoTab) || null;
}

// Gộp câu hỏi của mọi tab bài tập — dùng để ghi lại `exercises` phẳng cho tương
// thích ngược (questionCount, bài tập giao, bản đọc cũ) khi lưu xuống Supabase.
export function flattenLessonTabExercises(tabs = []) {
  return getExerciseTabs(tabs).flatMap((tab) => (Array.isArray(tab.exercises) ? tab.exercises : []));
}

export function countLessonTabQuestions(tab) {
  return Array.isArray(tab?.exercises) ? tab.exercises.length : 0;
}

export function countLessonQuestions(tabs = []) {
  return flattenLessonTabExercises(tabs).length;
}

// Tên mặc định cho tab mới: "Bài tập N" với N là số tab bài tập kế tiếp, tránh
// trùng tên khi giáo viên xóa tab ở giữa rồi thêm lại.
export function getNextExerciseTabTitle(tabs = []) {
  const used = new Set(getExerciseTabs(tabs).map((tab) => tab.title.trim().toLowerCase()));
  let index = getExerciseTabs(tabs).length + 1;

  while (used.has(`${DEFAULT_EXERCISE_TAB_TITLE} ${index}`.toLowerCase())) {
    index += 1;
  }

  return `${DEFAULT_EXERCISE_TAB_TITLE} ${index}`;
}

export function createExerciseTab(tabs = []) {
  return normalizeLessonTab(
    {
      id: `lesson-tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: 'exercise',
      title: getNextExerciseTabTitle(tabs),
      exercises: []
    },
    tabs.length
  );
}

// Payload gọn để lưu: bỏ field rỗng cho khỏi phình `lessons.content`.
export function serializeLessonTabs(tabs = []) {
  return tabs.map((tab, index) => {
    const normalized = normalizeLessonTab(tab, index);

    if (isVideoTab(normalized)) {
      return {
        id: normalized.id,
        kind: 'video',
        title: normalized.title,
        ...(normalized.note ? { note: normalized.note } : {}),
        ...(normalized.videoUrl ? { videoUrl: normalized.videoUrl } : {}),
        ...(normalized.videoTitle ? { videoTitle: normalized.videoTitle } : {}),
        ...(normalized.readingItems.length ? { readingItems: normalized.readingItems } : {}),
        ...(normalized.pinyinTable ? { pinyinTable: normalized.pinyinTable } : {})
      };
    }

    return {
      id: normalized.id,
      kind: 'exercise',
      title: normalized.title,
      ...(normalized.note ? { note: normalized.note } : {}),
      ...(normalized.audioUrl ? { audioUrl: normalized.audioUrl, audioName: normalized.audioName } : {}),
      ...(normalized.imageUrl ? { imageUrl: normalized.imageUrl, imageName: normalized.imageName } : {}),
      exercises: normalized.exercises
    };
  });
}
