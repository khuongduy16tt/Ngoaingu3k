import React, { useState } from 'react';
import { validateImageFile } from '../lib/storageService';

/**
 * Ô chọn/upload ảnh minh họa dùng chung — có preview, thanh tiến trình %, ô dán
 * link ảnh thủ công và nút xóa. Song song với AudioUploadField để phần Nghe và
 * phần Ảnh của trình soạn đề thi có cùng cách dùng.
 *
 * @param {string} imageUrl
 * @param {string} imageName
 * @param {(next: { imageUrl: string, imageName: string }) => void} onUploaded
 * @param {() => void} onClear
 * @param {(file: File, onProgress: (percent: number) => void) => Promise<{ url: string } | null>} upload
 * @param {string} [label]
 * @param {string} [fileHint]
 */
export function ImageUploadField({
  imageUrl,
  imageName,
  onUploaded,
  onClear,
  upload,
  label = 'Ảnh minh họa (tùy chọn)',
  fileHint = 'JPG, PNG, WebP, GIF — tối đa 30MB'
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setUploading(true);
    setProgress(0);
    try {
      const uploaded = await upload(file, setProgress);
      if (uploaded?.url) {
        onUploaded({ imageUrl: uploaded.url, imageName: file.name });
      } else {
        setError('Không thể tải ảnh lên. Kiểm tra bucket "exam-images" trong Supabase Storage.');
      }
    } finally {
      setUploading(false);
    }
  }

  function handleUrlChange(event) {
    // Sửa link thủ công thì tên file đã upload trước đó không còn đúng nữa.
    onUploaded({ imageUrl: event.target.value, imageName: '' });
  }

  function handleClear() {
    setError('');
    setProgress(0);
    onClear();
  }

  return (
    <div className="image-upload-field">
      <span className="image-upload-field__label">{label}</span>

      {imageUrl ? (
        <div className="image-upload-field__preview">
          <img src={imageUrl} alt={imageName || 'Ảnh câu hỏi'} />
          <div className="image-upload-field__meta">
            <span>{imageName || 'Link ảnh đã dán'}</span>
          </div>
          <button type="button" className="button-ghost danger image-upload-field__clear" onClick={handleClear}>
            Xóa ảnh
          </button>
        </div>
      ) : (
        <div className="image-upload-field__empty">Chưa có ảnh cho câu hỏi này.</div>
      )}

      <div className="image-upload-field__actions">
        <label className="button-ghost image-upload-field__pick">
          {imageUrl ? 'Đổi ảnh khác' : 'Chọn ảnh'}
          <input type="file" accept="image/*" onChange={handleFile} disabled={uploading} hidden />
        </label>
        <span className="field-hint">{fileHint}</span>
      </div>

      {uploading ? (
        <div className="image-upload-field__progress">
          <div className="meter">
            <span style={{ width: `${progress}%` }} />
          </div>
          <small>Đang tải lên... {progress}%</small>
        </div>
      ) : null}

      <label className="auth-field">
        <span>Hoặc dán link ảnh</span>
        <input type="url" value={imageUrl} onChange={handleUrlChange} placeholder="https://..." disabled={uploading} />
      </label>

      {error ? <div className="auth-message auth-message--error">{error}</div> : null}
    </div>
  );
}
