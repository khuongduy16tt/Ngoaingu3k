import * as XLSX from 'xlsx';
import { getPackageStatus, getPackageStatusLabel } from './studentProgressService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function downloadWorkbook(wb, filename) {
  XLSX.writeFile(wb, filename);
}

function makeSheet(headers, rows) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  // Auto column width
  const colWidths = headers.map((h, i) => ({
    wch: Math.max(h.length, ...rows.map((r) => String(r[i] ?? '').length), 10),
  }));
  ws['!cols'] = colWidths;
  return ws;
}

function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}

// ─── Export Báo cáo Người dùng & Đăng ký/Mua hàng (gộp 1 bảng) ────────────────

/**
 * Xuất 1 sheet duy nhất gộp người dùng + khóa học đã đăng ký/mua — thay cho
 * 2 file riêng (users/orders) trước đây, để không phải tách lẻ khi báo cáo.
 * Mỗi user không mua gì ra đúng 1 dòng ("Chưa mua"); mỗi khóa họ đã mua ra
 * 1 dòng riêng (đủ chi tiết từng gói, không chỉ gói gần nhất) — enrollments
 * lấy từ getStudentRoster() nên buổi học/hạn gói luôn tính theo lần mua gần
 * nhất của khóa đó.
 * @param {Array} users - Mảng profile objects
 * @param {Array} enrollments - Mảng row từ getStudentRoster() (1 dòng / học sinh-khóa)
 */
export function exportAdminRegistrationsToExcel(users = [], enrollments = []) {
  const enrollmentsByUserId = new Map();
  enrollments.forEach((row) => {
    const list = enrollmentsByUserId.get(row.studentId) || [];
    list.push(row);
    enrollmentsByUserId.set(row.studentId, list);
  });

  const headers = [
    'Họ tên',
    'Email',
    'Số điện thoại',
    'Vai trò',
    'Ngày đăng ký',
    'Khóa học',
    'Ngày vào học',
    'Buổi đã học',
    'Tổng số buổi',
    'Buổi còn lại',
    'Ngày hết hạn',
    'Trạng thái gói',
    'Trạng thái mua'
  ];

  const rows = [];
  users.forEach((user) => {
    const userEnrollments = enrollmentsByUserId.get(user.id) || [];

    if (!userEnrollments.length) {
      rows.push([
        user.fullName || user.full_name || '',
        user.email || '',
        user.phone || '',
        user.role || '',
        formatDate(user.createdAt || user.created_at),
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'Chưa mua'
      ]);
      return;
    }

    userEnrollments.forEach((enrollment) => {
      rows.push([
        user.fullName || user.full_name || '',
        user.email || '',
        user.phone || '',
        user.role || '',
        formatDate(user.createdAt || user.created_at),
        enrollment.courseTitle || '',
        formatDate(enrollment.enrolledAt),
        enrollment.sessionsUsed ?? 0,
        enrollment.sessionsTotal ?? 'Không giới hạn',
        enrollment.sessionsRemaining ?? 'Không giới hạn',
        enrollment.expiresAt ? formatDate(enrollment.expiresAt) : 'Không giới hạn',
        getPackageStatusLabel(getPackageStatus(enrollment)),
        'Đã mua'
      ]);
    });
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, makeSheet(headers, rows), 'Người dùng & Đăng ký');
  downloadWorkbook(wb, `bao-cao-dang-ky-mua-hang_${_today()}.xlsx`);
}

// ─── Export Báo cáo Tiến độ ──────────────────────────────────────────────────

/**
 * @param {Array} progressRows - Array { userName, email, courseTitle, lessonTitle, completed, updatedAt }
 */
export function exportProgressToExcel(progressRows = []) {
  const headers = ['Học viên', 'Email', 'Khóa học', 'Bài học', 'Hoàn thành', 'Cập nhật lần cuối'];
  const rows = progressRows.map((p) => [
    p.userName || '',
    p.email || '',
    p.courseTitle || '',
    p.lessonTitle || '',
    p.completed ? 'Đã hoàn thành' : 'Chưa hoàn thành',
    formatDate(p.updatedAt || p.updated_at),
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, makeSheet(headers, rows), 'Tiến độ');
  downloadWorkbook(wb, `bao-cao-tien-do_${_today()}.xlsx`);
}

// ─── Export Tiến độ học sinh (buổi học + hạn gói) ────────────────────────────

const PACKAGE_STATUS_EXPORT_LABELS = {
  unlimited: 'Không giới hạn',
  active: 'Còn hạn',
  expiring_soon: 'Sắp hết hạn',
  expired: 'Đã hết hạn'
};

/**
 * Xuất danh sách học sinh (roster) ra Excel — dùng cho trang Tiến độ học
 * sinh. Nhận roster rows kèm packageStatus đã tính sẵn (getPackageStatus)
 * để không phải import lại logic tính hạn gói vào file report thuần này.
 * @param {Array} rows - { fullName, email, phone, courseTitle, enrolledAt, sessionsUsed, sessionsTotal, sessionsRemaining, expiresAt, packageStatus }
 */
export function exportStudentRosterToExcel(rows = []) {
  const headers = [
    'Học sinh',
    'Số điện thoại',
    'Email',
    'Khóa học',
    'Ngày vào học',
    'Buổi đã học',
    'Tổng số buổi',
    'Buổi còn lại',
    'Ngày hết hạn',
    'Trạng thái gói'
  ];

  const sheetRows = rows.map((row) => [
    row.fullName || '',
    row.phone || '',
    row.email || '',
    row.courseTitle || '',
    formatDate(row.enrolledAt),
    row.sessionsUsed ?? 0,
    row.sessionsTotal ?? 'Không giới hạn',
    row.sessionsRemaining ?? 'Không giới hạn',
    row.expiresAt ? formatDate(row.expiresAt) : 'Không giới hạn',
    PACKAGE_STATUS_EXPORT_LABELS[row.packageStatus] || ''
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, makeSheet(headers, sheetRows), 'Tiến độ học sinh');
  downloadWorkbook(wb, `tien-do-hoc-sinh_${_today()}.xlsx`);
}

// ─── Export Lịch sử hoạt động ─────────────────────────────────────────────────

/**
 * @param {Array} logs - user_activity_logs rows
 * @param {Array} users - profiles để tra tên
 */
export function exportActivityToExcel(logs = [], users = []) {
  const userMap = new Map(users.map((u) => [u.id, `${u.fullName || u.full_name || ''} (${u.email})`]));

  const actionLabels = {
    login: 'Đăng nhập',
    logout: 'Đăng xuất',
    signup: 'Đăng ký',
    view_lesson: 'Xem bài học',
    complete_lesson: 'Hoàn thành bài học',
    complete_exercise: 'Làm bài tập',
    purchase: 'Mua khóa học',
    view_course: 'Xem khóa học',
  };

  const headers = ['Người dùng', 'Hành động', 'Mục tiêu', 'Thời gian'];
  const rows = logs.map((l) => [
    userMap.get(l.user_id) || l.user_id,
    actionLabels[l.action] || l.action,
    l.target_title || l.target_id || '',
    formatDate(l.created_at),
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, makeSheet(headers, rows), 'Lịch sử');
  downloadWorkbook(wb, `lich-su-hoat-dong_${_today()}.xlsx`);
}

// ─── Helpers nội bộ ──────────────────────────────────────────────────────────

function _today() {
  return new Date().toISOString().slice(0, 10);
}
