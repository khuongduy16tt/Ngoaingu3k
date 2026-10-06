// Bản sao của server/src/lib/comboPricing.js — chỉ để HIỂN THỊ giá (giá gốc,
// % tiết kiệm, số tiền khi đã có sẵn vài khóa). Số tiền thật vẫn do server tính
// lúc tạo đơn. Sửa công thức chia giá thì sửa cả hai bên.

function toVnd(value) {
  const amount = Math.round(Number(value) || 0);
  return amount > 0 ? amount : 0;
}

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

export function quoteCombo(comboPrice, courses, ownedCourseIds = []) {
  const owned = new Set((ownedCourseIds || []).map(String));
  const shares = allocateComboPrice(comboPrice, courses);
  const missing = (courses || []).filter((course) => !owned.has(String(course.id)));
  const amount = missing.reduce((sum, course) => sum + (shares.get(course.id) || 0), 0);

  return { amount, missing, shares };
}

export function sumListPrice(courses) {
  return (courses || []).reduce((sum, course) => sum + toVnd(course.price), 0);
}

export function savingsPercent(comboPrice, listTotal) {
  const total = toVnd(listTotal);
  const price = toVnd(comboPrice);
  if (!total || price >= total) return 0;
  return Math.floor(((total - price) / total) * 100);
}

export function priceAfterDiscount(listTotal, percent) {
  const total = toVnd(listTotal);
  const ratio = Math.min(Math.max(Number(percent) || 0, 0), 100) / 100;
  return Math.floor((total * (1 - ratio)) / 1000) * 1000;
}
