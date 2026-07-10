import * as XLSX from 'xlsx';

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

// ─── Export Báo cáo Người dùng ────────────────────────────────────────────────

/**
 * Xuất danh sách users ra Excel.
 * @param {Array} users - Mảng profile objects
 * @param {Array} orders - Mảng order objects (để tính đã mua)
 */
export function exportUsersToExcel(users = [], orders = []) {
  // Build lookup: userId → [courseId, ...]
  const purchaseMap = new Map();
  orders.forEach((o) => {
    if (o.status === 'paid') {
      const list = purchaseMap.get(o.userId || o.user_id) || [];
      list.push(o.courseId || o.course_id || '');
      purchaseMap.set(o.userId || o.user_id, list);
    }
  });

  const headers = ['Họ tên', 'Email', 'Số điện thoại', 'Vai trò', 'Ngày đăng ký', 'Đã mua (số khóa)', 'Trạng thái'];
  const rows = users.map((u) => {
    const id = u.id;
    const purchased = purchaseMap.get(id) || [];
    return [
      u.fullName || u.full_name || '',
      u.email || '',
      u.phone || '',
      u.role || '',
      formatDate(u.createdAt || u.created_at),
      purchased.length,
      purchased.length > 0 ? 'Đã mua' : 'Chưa mua',
    ];
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, makeSheet(headers, rows), 'Người dùng');
  downloadWorkbook(wb, `bao-cao-nguoi-dung_${_today()}.xlsx`);
}

// ─── Export Báo cáo Đơn hàng ─────────────────────────────────────────────────

/**
 * @param {Array} orders
 * @param {Array} users  - để tra tên user
 * @param {Array} courses - để tra tên khóa học
 */
export function exportOrdersToExcel(orders = [], users = [], courses = []) {
  const userMap = new Map(users.map((u) => [u.id, u.fullName || u.full_name || u.email]));
  const courseMap = new Map(courses.map((c) => [c.id, c.title]));

  const headers = ['Mã đơn', 'Học viên', 'Email', 'Khóa học', 'Số tiền', 'Trạng thái', 'Ngày mua'];
  const rows = orders.map((o) => {
    const uid = o.userId || o.user_id || '';
    const cid = o.courseId || o.course_id || '';
    const user = users.find((u) => u.id === uid);
    return [
      o.id?.slice(0, 8) || '',
      userMap.get(uid) || uid,
      user?.email || '',
      courseMap.get(cid) || cid,
      typeof o.amount === 'number' ? o.amount.toLocaleString('vi-VN') + ' đ' : (o.amount || ''),
      _statusLabel(o.status),
      formatDate(o.createdAt || o.created_at),
    ];
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, makeSheet(headers, rows), 'Đơn hàng');
  downloadWorkbook(wb, `bao-cao-don-hang_${_today()}.xlsx`);
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

function _statusLabel(status) {
  const labels = { paid: 'Đã thanh toán', pending: 'Chờ thanh toán', failed: 'Thất bại', refunded: 'Hoàn tiền' };
  return labels[status] || status || '';
}
