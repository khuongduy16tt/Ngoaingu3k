/**
 * UI string constants — Vietnamese-first.
 * Keeps every user-facing label in one place for consistency.
 */
export const ui = {
  // Auth
  signIn: 'Đăng nhập',
  signUp: 'Đăng ký',
  signOut: 'Đăng xuất',
  loadingSession: 'Đang tải phiên...',

  // Navigation
  home: 'Trang chủ',
  courses: 'Khóa học',
  learningRoom: 'Phòng học',
  dashboard: 'Bảng điều khiển',
  contact: 'Liên hệ',
  test: 'Bài test',

  // Footer
  quickLinks: 'Liên kết nhanh',
  platform: 'Nền tảng',
  support: 'Hỗ trợ',
  accountLogin: 'Đăng nhập tài khoản',
  onlinePayment: 'Thanh toán trực tuyến',
  digitalMaterials: 'Học liệu số',
  progressTracking: 'Theo dõi tiến độ',
  exercisesAndQuizzes: 'Bài tập và kiểm tra',
  dashboardWorkspace: 'Không gian làm việc',
  courseManagement: 'Quản lý khóa học',
  onlinePlatform: 'Nền tảng học trực tuyến',

  // Misc
  pageNotFound: 'Không tìm thấy trang',
  goHome: 'Về trang chủ',
  testPageTitle: 'Bài test',
  testPageMessage: 'Trang bài test đang được chuẩn bị.',

  // Theme
  darkMode: 'Chế độ tối',
  lightMode: 'Chế độ sáng',
  switchToDark: 'Chuyển sang chế độ tối',
  switchToLight: 'Chuyển sang chế độ sáng',

  // Contact floating
  zaloLabel: 'Zalo',
  zaloDesc: 'Nhắn tin tư vấn',
  messengerLabel: 'Messenger',
  messengerDesc: 'Chat qua Facebook',
  phoneLabel: 'Gọi điện',
  phoneDesc: 'Liên hệ tư vấn ngay',
  openContactChannels: 'Mở kênh liên hệ nhanh',
  closeContactChannels: 'Ẩn kênh liên hệ nhanh',
  contactChannelsAria: 'Kênh liên hệ nhanh',
  testButtonAria: 'Vào trang làm bài test',

  // Error
  errorTitle: 'Đã xảy ra lỗi',
  errorMessage: 'Trang gặp sự cố không mong muốn. Vui lòng thử tải lại.',
  reload: 'Tải lại trang',
};

/**
 * Page title helper — appends site suffix.
 */
export function buildPageTitle(pageTitle) {
  const suffix = 'Ngoaingu3k Academy';
  if (!pageTitle) return suffix;
  return `${pageTitle} | ${suffix}`;
}
