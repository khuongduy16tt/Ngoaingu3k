import { supabase, isSupabaseReady } from './supabase';

// ─── Upload Video lên Supabase Storage ───────────────────────────────────────

/**
 * Upload video file cho bài học.
 * @param {File} file - File video (.mp4, .webm, .mov)
 * @param {string} lessonId
 * @param {function} onProgress - callback(percent: number)
 * @returns {{ path: string, url: string } | null}
 */
export async function uploadLessonVideo(file, lessonId, onProgress) {
  if (!isSupabaseReady()) {
    console.warn('[storageService] Supabase not ready, skip upload');
    return null;
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
  const path = `lessons/${lessonId}/${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from('lesson-videos')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      onUploadProgress: onProgress
        ? (evt) => onProgress(Math.round((evt.loaded / evt.total) * 100))
        : undefined,
    });

  if (error) {
    console.error('[uploadLessonVideo]', error.message);
    return null;
  }

  const url = getPublicUrl('lesson-videos', data.path);
  return { path: data.path, url };
}

// ─── Upload Avatar người dùng ────────────────────────────────────────────────

/**
 * Upload ảnh avatar cho người dùng.
 * @param {File} file - File ảnh (.jpg, .png, .webp)
 * @param {string} userId
 * @returns {{ path: string, url: string } | null}
 */
export async function uploadAvatarImage(file, userId) {
  if (!isSupabaseReady()) {
    const url = await readFileAsDataUrl(file);
    return { path: 'local', url };
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${userId}/avatar.${ext}`;

  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { cacheControl: '3600', upsert: true });

  if (error) {
    console.error('[uploadAvatarImage]', error.message);
    return null;
  }

  const url = getPublicUrl('avatars', data.path);
  return { path: data.path, url };
}

// ─── Upload Ảnh khóa học ──────────────────────────────────────────────────────

/**
 * Upload ảnh đại diện (banner) cho khóa học.
 * @param {File} file - File ảnh (.jpg, .png, .webp)
 * @param {string} courseId - ID của khóa học
 * @returns {{ path: string, url: string } | null}
 */
export async function uploadCourseImage(file, courseId) {
  if (!isSupabaseReady()) {
    const url = await readFileAsDataUrl(file);
    return { path: 'local', url };
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  // Dùng courseId hoặc Date.now nếu khóa học chưa có id chính thức
  const path = `${courseId || Date.now()}/banner_${Date.now()}.${ext}`;

  // Thử upload vào bucket course-images, nếu lỗi có thể do bucket chưa được tạo
  const { data, error } = await supabase.storage
    .from('course-images')
    .upload(path, file, { cacheControl: '3600', upsert: true });

  if (error) {
    console.error('[uploadCourseImage] Error uploading to course-images:', error.message);
    // Fallback sang bucket assignment-images hoặc báo lỗi
    // Để giữ thiết kế chuẩn, chúng ta vẫn báo lỗi và khuyên admin tạo bucket course-images
    return null;
  }

  const url = getPublicUrl('course-images', data.path);
  return { path: data.path, url };
}

// ─── Upload Ảnh câu hỏi ──────────────────────────────────────────────────────

/**
 * Upload ảnh đính kèm cho câu hỏi bài tập.
 * @param {File} file - File ảnh (.jpg, .png, .webp, .gif)
 * @param {string} assignmentId
 * @returns {{ path: string, url: string } | null}
 */
export async function uploadAssignmentImage(file, assignmentId) {
  if (!isSupabaseReady()) {
    const url = await readFileAsDataUrl(file);
    return { path: 'local', url };
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `assignments/${assignmentId || Date.now()}/${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from('assignment-images')
    .upload(path, file, { cacheControl: '3600', upsert: true });

  if (error) {
    console.error('[uploadAssignmentImage]', error.message);
    return null;
  }

  const url = getPublicUrl('assignment-images', data.path);
  return { path: data.path, url };
}

// ─── Upload Audio đề thi ──────────────────────────────────────────────────────

/**
 * Upload file audio cho phần Nghe của đề thi.
 * @param {File} file - File audio (.mp3, .m4a, .wav, .ogg)
 * @param {string} examId
 * @returns {{ path: string, url: string } | null}
 */
export async function uploadExamAudio(file, examId) {
  if (!isSupabaseReady()) {
    const url = await readFileAsDataUrl(file);
    return { path: 'local', url };
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp3';
  const path = `exams/${examId || Date.now()}/${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from('exam-audio')
    .upload(path, file, { cacheControl: '3600', upsert: true });

  if (error) {
    console.error('[uploadExamAudio]', error.message);
    return null;
  }

  const url = getPublicUrl('exam-audio', data.path);
  return { path: data.path, url };
}

/**
 * Upload file audio cho câu hỏi Nghe của bài giảng.
 * Dùng chung bucket "exam-audio" (đã có policy cho teacher) với prefix lessons/
 * để không phải tạo thêm bucket mới.
 * @param {File} file - File audio (.mp3, .m4a, .wav, .ogg)
 * @param {string} lessonId
 * @returns {{ path: string, url: string } | null}
 */
export async function uploadLessonAudio(file, lessonId) {
  if (!isSupabaseReady()) {
    const url = await readFileAsDataUrl(file);
    return { path: 'local', url };
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp3';
  const path = `lessons/${lessonId || Date.now()}/${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from('exam-audio')
    .upload(path, file, { cacheControl: '3600', upsert: true });

  if (error) {
    console.error('[uploadLessonAudio]', error.message);
    return null;
  }

  const url = getPublicUrl('exam-audio', data.path);
  return { path: data.path, url };
}

export async function readFileAsDataUrl(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Không thể đọc file ảnh.'));
    reader.readAsDataURL(file);
  });
}

// ─── Lấy public URL ──────────────────────────────────────────────────────────

/**
 * Lấy public URL từ Supabase Storage.
 * @param {string} bucket
 * @param {string} filePath
 * @returns {string}
 */
export function getPublicUrl(bucket, filePath) {
  if (!isSupabaseReady()) return '';
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data?.publicUrl || '';
}

// ─── Xóa file ────────────────────────────────────────────────────────────────

export async function deleteStorageFile(bucket, filePath) {
  if (!isSupabaseReady() || !filePath) return;
  const { error } = await supabase.storage.from(bucket).remove([filePath]);
  if (error) console.warn('[deleteStorageFile]', error.message);
}

// ─── Validate file ───────────────────────────────────────────────────────────

const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'];
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_VIDEO_MB = 500;
const MAX_IMAGE_MB = 30;

export function validateVideoFile(file) {
  if (!VIDEO_TYPES.includes(file.type)) {
    return 'Chỉ hỗ trợ định dạng MP4, WebM, MOV, MKV.';
  }
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
    return `Video không được vượt quá ${MAX_VIDEO_MB}MB.`;
  }
  return null;
}

export function validateImageFile(file) {
  if (!IMAGE_TYPES.includes(file.type)) {
    return 'Chỉ hỗ trợ định dạng JPG, PNG, WebP, GIF.';
  }
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
    return `Ảnh không được vượt quá ${MAX_IMAGE_MB}MB.`;
  }
  return null;
}

const AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/ogg'];
const MAX_AUDIO_MB = 100;

export function validateAudioFile(file) {
  if (!AUDIO_TYPES.includes(file.type)) {
    return 'Chỉ hỗ trợ định dạng MP3, M4A, WAV, OGG.';
  }
  if (file.size > MAX_AUDIO_MB * 1024 * 1024) {
    return `Audio không được vượt quá ${MAX_AUDIO_MB}MB.`;
  }
  return null;
}
