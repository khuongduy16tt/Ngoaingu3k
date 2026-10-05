import React, { Fragment } from 'react';

// Văn bản bài tập có định dạng tối giản: <b>đậm</b>, <u>gạch chân</u>, xuống dòng và
// link http(s). Đề IELTS cần gạch chân/in đậm để hỏi phát âm, trọng âm, chunk...
// Tự tách thành phần tử React (không dùng innerHTML) nên nội dung lưu trong DB
// không thể chèn HTML tuỳ ý — thẻ lạ hiện nguyên văn như chữ thường.
const TOKEN = /(<\/?[bu]>|https?:\/\/[^\s<>()]*[^\s<>().,;:!?'"”’])/g;

export function RichText({ text, as: Tag = 'span', className = '' }) {
  const value = String(text ?? '');
  if (!value) {
    return null;
  }

  // Chữ thường (không thẻ, không link, không xuống dòng) trả về nguyên văn: giữ
  // đúng cấu trúc DOM cũ cho các khóa đã có (HSK) và không bọc thừa thẻ span.
  TOKEN.lastIndex = 0;
  if (Tag === 'span' && !className && !value.includes('\n') && !TOKEN.test(value)) {
    return value;
  }
  TOKEN.lastIndex = 0;

  let bold = false;
  let underline = false;
  const nodes = [];

  value.split(TOKEN).forEach((part, index) => {
    if (!part) return;
    if (part === '<b>') { bold = true; return; }
    if (part === '</b>') { bold = false; return; }
    if (part === '<u>') { underline = true; return; }
    if (part === '</u>') { underline = false; return; }

    let node = /^https?:\/\//.test(part) ? (
      <a href={part} target="_blank" rel="noreferrer">{part}</a>
    ) : (
      part
    );
    if (underline) node = <u>{node}</u>;
    if (bold) node = <strong>{node}</strong>;
    nodes.push(<Fragment key={index}>{node}</Fragment>);
  });

  return <Tag className={['rich-text', className].filter(Boolean).join(' ')}>{nodes}</Tag>;
}
