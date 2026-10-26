// Đổi lỗi kỹ thuật (Supabase, mạng, trình duyệt — thường bằng tiếng Anh) thành
// câu tiếng Việt người dùng hiểu được. Lỗi do chính app ném ra đã viết bằng
// tiếng Việt thì giữ nguyên; lỗi lạ không nhận ra thì dùng câu dự phòng của
// từng chỗ gọi thay vì in nguyên văn kiểu "new row violates row-level security".

const VIETNAMESE_CHARS = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

const KNOWN_ERRORS = [
  {
    pattern: /failed to fetch|networkerror|network request failed|load failed|err_internet_disconnected|fetch failed/i,
    text: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'
  },
  {
    pattern: /timeout|timed out|aborterror/i,
    text: 'Máy chủ phản hồi quá lâu. Vui lòng thử lại.'
  },
  {
    pattern: /jwt|token.*expired|invalid.*token|refresh token|not authenticated|auth session missing/i,
    text: 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại rồi thử lại.'
  },
  {
    pattern: /row-level security|permission denied|not authorized|unauthorized|forbidden|insufficient privilege/i,
    text: 'Bạn không có quyền thực hiện thao tác này.'
  },
  {
    pattern: /duplicate key|already exists|unique constraint/i,
    text: 'Dữ liệu này đã tồn tại.'
  },
  {
    pattern: /payload too large|entity too large|exceeded the maximum|file size/i,
    text: 'Tệp quá lớn, hãy chọn tệp nhỏ hơn.'
  },
  {
    pattern: /rate limit|too many requests/i,
    text: 'Thao tác quá nhanh. Đợi một lát rồi thử lại.'
  }
];

export function toFriendlyError(error, fallback = 'Đã có lỗi xảy ra. Vui lòng thử lại.') {
  const message = String(error?.message ?? (typeof error === 'string' ? error : '')).trim();

  if (!message) {
    return fallback;
  }

  const known = KNOWN_ERRORS.find((item) => item.pattern.test(message));
  if (known) {
    return known.text;
  }

  return VIETNAMESE_CHARS.test(message) ? message : fallback;
}
