// Nhập bộ thẻ từ text dán vào, theo đúng cách Quizlet làm: chọn dấu phân cách
// giữa thuật ngữ và định nghĩa (Tab / phẩy / gạch ngang / tuỳ chỉnh) và dấu
// phân cách giữa các thẻ (xuống dòng / chấm phẩy / tuỳ chỉnh), rồi xem trước
// bản parse trước khi nhập thật.
//
// Mỗi dòng thành một thẻ. Chỉ tách ở lần xuất hiện ĐẦU TIÊN của dấu phân cách
// thuật ngữ, nên định nghĩa chứa dấu phẩy vẫn giữ nguyên khi tách bằng phẩy.

export const TERM_SEPARATORS = [
  { value: 'tab', label: 'Tab', char: '\t' },
  { value: 'comma', label: 'Dấu phẩy', char: ',' },
  { value: 'dash', label: 'Gạch ngang', char: '-' },
  { value: 'custom', label: 'Tuỳ chỉnh', char: '' }
];

export const ROW_SEPARATORS = [
  { value: 'newline', label: 'Xuống dòng', char: '\n' },
  { value: 'semicolon', label: 'Chấm phẩy', char: ';' },
  { value: 'custom', label: 'Tuỳ chỉnh', char: '' }
];

export const MAX_IMPORT_CARDS = 2000;

function resolveSeparator(list, value, custom) {
  if (value === 'custom') {
    return String(custom ?? '');
  }
  return list.find((item) => item.value === value)?.char ?? '';
}

export function getTermSeparatorChar(value, custom) {
  return resolveSeparator(TERM_SEPARATORS, value, custom);
}

export function getRowSeparatorChar(value, custom) {
  return resolveSeparator(ROW_SEPARATORS, value, custom);
}

// Tách theo dấu phân cách dòng. Với "xuống dòng" thì chấp nhận cả CRLF lẫn LF
// để text dán từ Word/Excel trên Windows không sinh ra ký tự thừa.
function splitRows(text, separator) {
  const value = String(text ?? '');

  if (!separator) {
    return value.split(/\r?\n/);
  }

  if (separator === '\n') {
    return value.split(/\r?\n/);
  }

  return value.split(separator);
}

/**
 * Phân tích text dán vào thành danh sách thẻ.
 * Trả về cả những dòng bị bỏ để hiện cảnh báo trong phần xem trước — người dùng
 * cần biết vì sao 50 dòng dán vào chỉ ra 48 thẻ.
 */
export function parseFlashcardImport(text, options = {}) {
  const {
    termSeparator = 'tab',
    termCustomSeparator = '',
    rowSeparator = 'newline',
    rowCustomSeparator = ''
  } = options;

  const termChar = getTermSeparatorChar(termSeparator, termCustomSeparator);
  const rowChar = getRowSeparatorChar(rowSeparator, rowCustomSeparator);

  const result = {
    cards: [],
    emptyRows: 0,
    rowsWithoutSeparator: 0,
    truncated: false,
    error: ''
  };

  if (!String(text ?? '').trim()) {
    return result;
  }

  if (termSeparator === 'custom' && !termChar) {
    result.error = 'Hãy nhập dấu phân cách tuỳ chỉnh giữa thuật ngữ và định nghĩa.';
    return result;
  }

  if (rowSeparator === 'custom' && !rowChar) {
    result.error = 'Hãy nhập dấu phân cách tuỳ chỉnh giữa các thẻ.';
    return result;
  }

  splitRows(text, rowChar).forEach((rawRow) => {
    const row = String(rawRow ?? '').trim();

    if (!row) {
      result.emptyRows += 1;
      return;
    }

    if (result.cards.length >= MAX_IMPORT_CARDS) {
      result.truncated = true;
      return;
    }

    const index = termChar ? row.indexOf(termChar) : -1;

    if (index < 0) {
      // Không tìm thấy dấu phân cách: vẫn tạo thẻ với định nghĩa trống để người
      // dùng thấy và sửa, thay vì im lặng bỏ dòng đó đi.
      result.rowsWithoutSeparator += 1;
      result.cards.push({ term: row, definition: '' });
      return;
    }

    const term = row.slice(0, index).trim();
    const definition = row.slice(index + termChar.length).trim();

    if (!term && !definition) {
      result.emptyRows += 1;
      return;
    }

    result.cards.push({ term, definition });
  });

  return result;
}

// Đoán dấu phân cách từ text dán vào để đỡ phải chọn tay: ưu tiên Tab (định
// dạng dán từ Excel/Sheets), sau đó mới đến các dấu khác.
export function detectTermSeparator(text) {
  const sample = String(text ?? '').split(/\r?\n/).slice(0, 20).join('\n');

  if (!sample.trim()) {
    return 'tab';
  }

  const candidates = [
    { value: 'tab', char: '\t' },
    { value: 'comma', char: ',' },
    { value: 'dash', char: '-' }
  ];

  const scored = candidates
    .map((candidate) => ({
      value: candidate.value,
      // Đếm số dòng CÓ dấu phân cách, không đếm tổng số lần xuất hiện — dấu phẩy
      // nằm rải rác trong một định nghĩa dài không nên thắng Tab.
      rows: sample.split(/\r?\n/).filter((row) => row.includes(candidate.char)).length
    }))
    .filter((candidate) => candidate.rows > 0)
    .sort((left, right) => right.rows - left.rows);

  return scored[0]?.value || 'tab';
}

export function normalizeFlashcard(card, index = 0) {
  return {
    id: String(card?.id || `card-${index + 1}`).trim(),
    term: String(card?.term ?? '').trim(),
    definition: String(card?.definition ?? '').trim(),
    position: Number.isFinite(Number(card?.position)) ? Number(card.position) : index
  };
}

export function normalizeFlashcards(cards = []) {
  return (Array.isArray(cards) ? cards : [])
    .map(normalizeFlashcard)
    .filter((card) => card.term || card.definition)
    .map((card, index) => ({ ...card, position: index }));
}
