// Các hàm dùng chung của form đăng nhập/đăng ký — chuyển nguyên từ AuthPage.jsx
// sang đây khi đăng nhập chuyển thành modal (LoginModal.jsx).

export function getAuthModeFromSearch(search) {
  return new URLSearchParams(search).get('mode') === 'sign-up' ? 'sign-up' : 'sign-in';
}

export function normalizePhone(value) {
  return String(value || '').replace(/[^\d+]/g, '');
}

export function isValidPhone(value) {
  const normalizedPhone = normalizePhone(value);
  const digitCount = normalizedPhone.replace(/\D/g, '').length;
  return digitCount >= 9 && digitCount <= 15;
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

// Supabase trả lỗi bằng tiếng Anh ("Invalid login credentials"), trước đây hiện
// thẳng ra cho học viên. Dịch sang tiếng Việt kèm cách xử lý; chuỗi lạ chưa có
// trong bảng thì rơi về câu mặc định thay vì lộ nguyên văn tiếng Anh.
const authErrorMessages = [
  [/invalid login credentials/i, 'Email hoặc mật khẩu không chính xác. Kiểm tra lại, hoặc bấm "Quên mật khẩu?" để đặt lại.'],
  [/email not confirmed/i, 'Email chưa được xác nhận. Mở hộp thư và bấm liên kết xác nhận rồi đăng nhập lại.'],
  [/user already registered|already been registered/i, 'Email này đã có tài khoản. Hãy đăng nhập, hoặc dùng "Quên mật khẩu?" nếu bạn không nhớ mật khẩu.'],
  [/should be different from the old password|same.*password/i, 'Mật khẩu mới phải khác mật khẩu cũ.'],
  [/password should be at least (\d+)/i, 'Mật khẩu quá ngắn — cần ít nhất $1 ký tự.'],
  [
    /unable to validate email address|invalid format|email address .* is invalid|email_address_invalid/i,
    'Địa chỉ email không hợp lệ. Kiểm tra lại phần trước và sau dấu @.'
  ],
  [/only request this after (\d+) seconds/i, 'Bạn vừa gửi một yêu cầu. Vui lòng đợi $1 giây rồi thử lại.'],
  [/rate limit|too many requests/i, 'Bạn đã thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.'],
  [/signups? (is |are )?disabled/i, 'Hệ thống đang tạm ngưng đăng ký tài khoản mới. Vui lòng liên hệ trung tâm để được hỗ trợ.'],
  [/token has expired|invalid token/i, 'Liên kết đã hết hạn. Hãy yêu cầu gửi lại email đặt lại mật khẩu.'],
  [/failed to fetch|network ?request ?failed|networkerror/i, 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.']
];

export function toVietnameseAuthError(error, fallback) {
  const raw = typeof error === 'string' ? error : error?.message || '';

  for (const [pattern, translated] of authErrorMessages) {
    const match = raw.match(pattern);
    if (match) {
      return translated.replace(/\$(\d)/g, (_, group) => match[Number(group)] ?? '');
    }
  }

  return fallback;
}

// Tài khoản Supabase thật nhưng hồ sơ thiếu họ tên/SĐT (thường là đăng nhập
// Google lần đầu) phải bổ sung trước khi vào khu học tập.
export function needsProfileCompletion(auth) {
  return Boolean(
    auth.session && !auth.isMockMode && auth.ready && (!auth.profile?.full_name || !auth.profile?.phone)
  );
}
