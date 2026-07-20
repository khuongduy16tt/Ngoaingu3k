import React, { useState } from 'react';
import { validateAudioFile } from '../lib/storageService';

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Ô chọn/upload file audio dùng chung cho phần Nghe của đề thi và câu hỏi
 * Nghe trong bài giảng — có preview nghe thử ngay, thanh tiến trình %, phát
 * hiện thời lượng file để gợi ý điền thời gian, và nút xóa.
 *
 * @param {string} audioUrl
 * @param {string} audioName
 * @param {(next: { audioUrl: string, audioName: string }) => void} onUploaded
 * @param {() => void} onClear
 * @param {(file: File, onProgress: (percent: number) => void) => Promise<{ url: string } | null>} upload
 * @param {(seconds: number) => void} [onUseDuration] - nếu truyền vào, hiện nút
 *   "Dùng Xm Ys làm thời gian" sau khi phát hiện được thời lượng audio.
 * @param {string} [fileHint]
 */
export function AudioUploadField({
  audioUrl,
  audioName,
  onUploaded,
  onClear,
  upload,
  onUseDuration,
  fileHint = 'MP3, M4A, WAV, OGG — tối đa 100MB'
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [durationSeconds, setDurationSeconds] = useState(0);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const validationError = validateAudioFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setUploading(true);
    setProgress(0);
    setDurationSeconds(0);
    try {
      const uploaded = await upload(file, setProgress);
      if (uploaded?.url) {
        onUploaded({ audioUrl: uploaded.url, audioName: file.name });
      } else {
        setError('Không thể tải audio lên. Kiểm tra bucket "exam-audio" trong Supabase Storage.');
      }
    } finally {
      setUploading(false);
    }
  }

  function handleUrlChange(event) {
    // Sửa link thủ công thì tên file cũ (nếu có) không còn đúng nữa — bỏ đi
    // để không hiển thị nhầm tên file đã upload trước đó cho 1 link khác.
    setDurationSeconds(0);
    onUploaded({ audioUrl: event.target.value, audioName: '' });
  }

  function handleLoadedMetadata(event) {
    const seconds = event.currentTarget.duration;
    if (Number.isFinite(seconds) && seconds > 0) {
      setDurationSeconds(seconds);
    }
  }

  function handleClear() {
    setError('');
    setProgress(0);
    setDurationSeconds(0);
    onClear();
  }

  return (
    <div className="audio-upload-field">
      {audioUrl ? (
        <div className="audio-upload-field__preview">
          <audio controls src={audioUrl} preload="metadata" onLoadedMetadata={handleLoadedMetadata} />
          <div className="audio-upload-field__meta">
            <span>{audioName || 'Link audio đã dán'}</span>
            {durationSeconds ? (
              <div className="audio-upload-field__duration">
                <small>Thời lượng: {formatDuration(durationSeconds)}</small>
                {onUseDuration ? (
                  <button
                    type="button"
                    className="audio-upload-field__use-duration"
                    onClick={() => onUseDuration(durationSeconds)}
                  >
                    Dùng làm thời gian phần thi
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <button type="button" className="button-ghost danger audio-upload-field__clear" onClick={handleClear}>
            Xóa audio
          </button>
        </div>
      ) : (
        <div className="audio-upload-field__empty">Chưa có file nghe.</div>
      )}

      <div className="audio-upload-field__actions">
        <label className="button-ghost audio-upload-field__pick">
          {audioUrl ? 'Đổi file khác' : 'Chọn file âm thanh'}
          <input type="file" accept="audio/*" onChange={handleFile} disabled={uploading} hidden />
        </label>
        <span className="field-hint">{fileHint}</span>
      </div>

      {uploading ? (
        <div className="audio-upload-field__progress">
          <div className="meter">
            <span style={{ width: `${progress}%` }} />
          </div>
          <small>Đang tải lên... {progress}%</small>
        </div>
      ) : null}

      <label className="auth-field">
        <span>Hoặc dán link audio</span>
        <input type="url" value={audioUrl} onChange={handleUrlChange} placeholder="https://..." disabled={uploading} />
      </label>

      {error ? <div className="auth-message auth-message--error">{error}</div> : null}
    </div>
  );
}
