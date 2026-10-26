import { useEffect } from 'react';

/**
 * Hỏi lại trước khi đóng tab / tải lại trang khi còn thay đổi chưa lưu.
 * Trình duyệt tự hiện câu hỏi của nó (không cho tùy chỉnh chữ).
 *
 * @param {boolean} hasUnsavedChanges
 */
export function useUnsavedChangesWarning(hasUnsavedChanges) {
  useEffect(() => {
    if (!hasUnsavedChanges) {
      return undefined;
    }

    function onBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChanges]);
}
