// Giá combo chia ngược về từng khóa trong combo. Mua combo sinh ra một đơn cho
// mỗi khóa, nên phải biết mỗi đơn mang bao nhiêu tiền: chia theo tỉ lệ giá lẻ để
// doanh thu từng khóa vẫn đúng, và để học viên đã có sẵn vài khóa chỉ trả phần
// của những khóa còn thiếu.
//
// Bản sao phía client: client/src/lib/comboPricing.js — sửa một bên thì sửa cả hai.

function toVnd(value) {
  const amount = Math.round(Number(value) || 0);
  return amount > 0 ? amount : 0;
}

/**
 * @param {number} comboPrice
 * @param {Array<{ id: string, price: number }>} courses — theo thứ tự trong combo
 * @returns {Map<string, number>} phần tiền (VND, số nguyên) của từng khóa; tổng
 *   luôn đúng bằng comboPrice — phần lẻ do làm tròn dồn vào khóa đầu tiên.
 */
export function allocateComboPrice(comboPrice, courses) {
  const total = toVnd(comboPrice);
  const list = Array.isArray(courses) ? courses : [];
  const shares = new Map();

  if (!list.length) {
    return shares;
  }

  const listTotal = list.reduce((sum, course) => sum + toVnd(course.price), 0);

  let allocated = 0;
  list.forEach((course) => {
    const share = listTotal > 0
      ? Math.floor((total * toVnd(course.price)) / listTotal)
      : Math.floor(total / list.length);
    shares.set(course.id, share);
    allocated += share;
  });

  const firstId = list[0].id;
  shares.set(firstId, shares.get(firstId) + (total - allocated));

  return shares;
}

/**
 * Báo giá mua combo, có hoặc không kèm dạy kèm.
 *
 * `owned`: Map courseId → 'tutoring' (đã có cả dạy kèm) | 'course' (chỉ có khóa).
 * - Mua chỉ khóa học: khóa đã có (bất kể gói nào) thì bỏ, chỉ trả phần của khóa thiếu.
 * - Mua kèm dạy kèm: khóa đã có dạy kèm thì bỏ; khóa đã có nhưng chưa có dạy
 *   kèm thì chỉ trả phần chênh (phần dạy kèm − phần khóa học) — không bắt trả
 *   lại tiền khóa đã mua.
 *
 * @returns {{ amount: number, lines: Array<{ id: string, amount: number }> }}
 *   lines = các khóa cần tạo đơn (kể cả nâng cấp với amount có thể bằng 0).
 */
export function quoteComboPurchase({ comboPrice, comboTutoringPrice, courses, owned = new Map(), withTutoring = false }) {
  const list = courses || [];
  const courseShares = allocateComboPrice(comboPrice, list);

  if (!withTutoring) {
    const lines = list
      .filter((course) => !owned.has(course.id))
      .map((course) => ({ id: course.id, amount: courseShares.get(course.id) || 0 }));
    return { amount: lines.reduce((sum, line) => sum + line.amount, 0), lines };
  }

  const tutoringShares = allocateComboPrice(
    comboTutoringPrice,
    list.map((course) => ({ id: course.id, price: course.tutoringPrice || course.price }))
  );
  const lines = list
    .filter((course) => owned.get(course.id) !== 'tutoring')
    .map((course) => {
      const full = tutoringShares.get(course.id) || 0;
      const credit = owned.get(course.id) === 'course' ? courseShares.get(course.id) || 0 : 0;
      return { id: course.id, amount: Math.max(full - credit, 0) };
    });

  return { amount: lines.reduce((sum, line) => sum + line.amount, 0), lines };
}

export function quoteCoursePurchase({ price, tutoringPrice, owned, withTutoring = false }) {
  const coursePrice = toVnd(price);
  if (!withTutoring) {
    return { alreadyOwned: Boolean(owned), amount: coursePrice };
  }
  if (owned === 'tutoring') {
    return { alreadyOwned: true, amount: 0 };
  }
  const full = toVnd(tutoringPrice);
  return { alreadyOwned: false, amount: owned === 'course' ? Math.max(full - coursePrice, 0) : full };
}
