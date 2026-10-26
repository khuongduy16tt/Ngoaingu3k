import React, { useEffect, useId, useRef } from 'react';
import { createRoot } from 'react-dom/client';

// Hộp xác nhận dùng chung thay cho window.confirm: cùng giao diện với trang,
// đọc được trên điện thoại, nút rõ nghĩa ("Xóa" thay vì "OK").
//
//   if (!(await confirmDialog('Xóa bộ thẻ "HSK 1"?'))) return;
//
// Trả về Promise<boolean>. Esc / bấm nền / "Hủy" = false.

function ConfirmDialogView({ message, title, confirmLabel, cancelLabel, danger, onResult }) {
  const titleId = useId();
  const messageId = useId();
  const cardRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    // Con trỏ vào nút an toàn: lỡ bấm Enter cũng không xóa nhầm.
    cancelRef.current?.focus();

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onResult(false);
        return;
      }
      if (event.key !== 'Tab' || !cardRef.current) return;
      const buttons = [...cardRef.current.querySelectorAll('button')];
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!cardRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onResult]);

  return (
    <div
      className="exam-confirm app-confirm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onResult(false);
      }}
    >
      <div className="exam-confirm__card" ref={cardRef}>
        <h2 id={titleId}>{title}</h2>
        <p id={messageId} className="app-confirm__message">
          {message}
        </p>
        <div className="exam-confirm__actions">
          <button ref={cancelRef} type="button" className="button-ghost" onClick={() => onResult(false)}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'button button--danger' : 'button'}
            onClick={() => onResult(true)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function confirmDialog(message, options = {}) {
  const text = String(message ?? '');
  const isDelete = /\bxóa\b/i.test(text);
  const {
    title = isDelete ? 'Xác nhận xóa' : 'Xác nhận',
    confirmLabel = isDelete ? 'Xóa' : 'Đồng ý',
    cancelLabel = 'Hủy',
    danger = isDelete
  } = options;

  if (typeof document === 'undefined') {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const host = document.createElement('div');
    host.setAttribute('data-confirm-dialog', '');
    document.body.appendChild(host);
    const root = createRoot(host);
    const returnFocusTo = document.activeElement;
    let settled = false;

    function handleResult(value) {
      if (settled) return;
      settled = true;
      // Gỡ ở nhịp sau: không unmount ngay trong lúc React đang xử lý sự kiện.
      setTimeout(() => {
        root.unmount();
        host.remove();
        if (returnFocusTo && returnFocusTo.isConnected) {
          returnFocusTo.focus?.({ preventScroll: true });
        }
      }, 0);
      resolve(value);
    }

    root.render(
      <ConfirmDialogView
        message={text}
        title={title}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        danger={danger}
        onResult={handleResult}
      />
    );
  });
}
