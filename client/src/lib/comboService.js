import { supabase, isSupabaseReady } from './supabase';
import { apiFetch } from './api';
import { logActivity } from './activityService';
import { getHskLevel, isHskCourse } from './courseService';
import { findPaymentOrderForCombo, upsertPaymentOrder } from './paymentService';
import { getPurchasedCourseIds, setPurchasedCourseIds } from './purchaseStorage';
import { normalizeVndAmount } from './money';

// '*' để có tutoring_price mà không vỡ khi chưa chạy migration dạy kèm.
const COMBO_SELECT = '*, course_combo_items(course_id, position)';

function isMissingComboTable(error) {
  const code = error?.code || '';
  return ['42P01', 'PGRST205', 'PGRST200'].includes(code) || /course_combo/.test(error?.message || '');
}

export const COMBO_MIGRATION_HINT =
  'Chưa có bảng combo trên Supabase. Chạy supabase/course-combo-migration.sql trong SQL editor rồi tải lại trang.';

function courseKey(course) {
  return String(course?.databaseId || course?.id || '');
}

function normalizeCombo(row, courses) {
  const lookup = new Map();
  (courses || []).forEach((course) => {
    lookup.set(courseKey(course), course);
    lookup.set(String(course.id), course);
  });

  const items = [...(row.course_combo_items || [])].sort(
    (left, right) => Number(left.position || 0) - Number(right.position || 0)
  );
  const courseIds = items.map((item) => item.course_id);
  const comboCourses = courseIds.map((id) => lookup.get(String(id))).filter(Boolean);
  const isHsk = comboCourses.length ? comboCourses.every(isHskCourse) : false;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description || '',
    price: normalizeVndAmount(row.price),
    tutoringPrice: normalizeVndAmount(row.tutoring_price) || null,
    status: row.status || 'draft',
    position: Number(row.position || 0),
    courseIds,
    courses: comboCourses,
    program: isHsk ? 'hsk' : 'ielts'
  };
}

export function comboPricingCourses(combo) {
  return (combo?.courses || []).map((course) => ({
    id: courseKey(course),
    price: Number(course.priceValue ?? course.price ?? 0),
    tutoringPrice: Number(course.tutoringPriceValue ?? course.tutoringPrice ?? 0)
  }));
}

export async function getPublishedCombos(courses) {
  if (!isSupabaseReady()) {
    return [];
  }

  const { data, error } = await supabase
    .from('course_combos')
    .select(COMBO_SELECT)
    .eq('status', 'published')
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    if (!isMissingComboTable(error)) {
      console.warn('[getPublishedCombos]', error.message);
    }
    return [];
  }

  return (data || [])
    .map((row) => normalizeCombo(row, courses))
    .filter((combo) => combo.courses.length >= 2);
}

export async function getAdminCombos(courses) {
  if (!isSupabaseReady()) {
    return [];
  }

  const { data, error } = await supabase
    .from('course_combos')
    .select(COMBO_SELECT)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(isMissingComboTable(error) ? COMBO_MIGRATION_HINT : error.message);
  }

  return (data || []).map((row) => normalizeCombo(row, courses));
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `combo-${Date.now()}`;
}

export async function saveAdminCombo(combo) {
  if (!isSupabaseReady()) {
    throw new Error('Cần kết nối Supabase để lưu combo.');
  }

  const courseIds = Array.from(new Set((combo.courseIds || []).filter(Boolean)));
  if (!String(combo.title || '').trim()) {
    throw new Error('Nhập tên combo.');
  }
  if (courseIds.length < 2) {
    throw new Error('Combo cần ít nhất 2 khóa học.');
  }
  const price = normalizeVndAmount(combo.price);
  if (!price) {
    throw new Error('Nhập giá combo.');
  }

  const tutoringPrice = normalizeVndAmount(combo.tutoringPrice);
  const payload = {
    title: String(combo.title).trim(),
    slug: combo.slug || slugify(combo.title),
    description: combo.description || null,
    price,
    tutoring_price: tutoringPrice || null,
    status: combo.status || 'draft',
    position: Number(combo.position || 0),
    updated_at: new Date().toISOString()
  };

  const query = combo.id
    ? supabase.from('course_combos').update(payload).eq('id', combo.id)
    : supabase.from('course_combos').insert(payload);
  const { data: saved, error } = await query.select('id').single();

  if (error) {
    if (isMissingComboTable(error)) throw new Error(COMBO_MIGRATION_HINT);
    if (error.code === '23505') throw new Error('Đã có combo trùng tên (slug). Đổi tên combo khác.');
    throw new Error(error.message);
  }

  const { error: deleteError } = await supabase.from('course_combo_items').delete().eq('combo_id', saved.id);
  if (deleteError) throw new Error(deleteError.message);

  const { error: itemsError } = await supabase.from('course_combo_items').insert(
    courseIds.map((courseId, index) => ({ combo_id: saved.id, course_id: courseId, position: index }))
  );
  if (itemsError) throw new Error(itemsError.message);

  return saved.id;
}

export async function deleteAdminCombo(comboId) {
  const { error } = await supabase.from('course_combos').delete().eq('id', comboId);
  if (error) throw new Error(error.message);
}

// Bậc IELTS: khóa trên web đặt tên theo trình độ thay vì band, nên ghép tên với
// band theo bảng giá của trung tâm. Tên có số band thì đọc thẳng số.
const IELTS_TIERS = [
  { pattern: /nền tảng/i, start: 0, end: '3.5' },
  { pattern: /cơ bản/i, start: 4, end: '4.5' },
  { pattern: /trung cấp/i, start: 5, end: '5.5' },
  { pattern: /nâng cao/i, start: 6, end: '6.5' }
];

function getIeltsTier(course) {
  const title = String(course?.title || '');
  const named = IELTS_TIERS.find((tier) => tier.pattern.test(title));
  if (named) return named;
  const numbers = title.match(/\d+(?:[.,]\d+)?/g);
  if (!numbers) return null;
  return { start: Number(numbers[0].replace(',', '.')), end: numbers[numbers.length - 1].replace(',', '.') };
}

export function getIeltsBand(course) {
  return getIeltsTier(course)?.start ?? Infinity;
}

export function buildComboSuggestions(courses) {
  function ladder(keyPrefix, list, getLevel, label) {
    const byLevel = new Map();
    list.forEach((course) => {
      const level = getLevel(course);
      if (!Number.isFinite(level)) return;
      byLevel.set(level, [...(byLevel.get(level) || []), course]);
    });
    const levels = [...byLevel.entries()].sort(([a], [b]) => a - b);

    const suggestions = [];
    for (let size = 2; size <= levels.length; size += 1) {
      const pickedLevels = levels.slice(0, size);
      suggestions.push({
        key: `${keyPrefix}-${size}`,
        title: label(pickedLevels.map(([level]) => level), pickedLevels.map(([, group]) => group[0])),
        courses: pickedLevels.flatMap(([, group]) => group)
      });
    }
    return suggestions;
  }

  const hsk = (courses || []).filter(isHskCourse);
  const ielts = (courses || []).filter((course) => !isHskCourse(course) && getIeltsTier(course));

  return [
    ...ladder('hsk', hsk, getHskLevel, (levels) => `Combo HSK ${levels.join('-')}`),
    ...ladder('ielts', ielts, getIeltsBand, (levels, firsts) =>
      `Combo IELTS ${levels[0]}-${getIeltsTier(firsts[firsts.length - 1]).end}`
    )
  ];
}

export async function purchaseCombo({ combo, userId, accessToken, user, withTutoring = false }) {
  if (!combo?.id) {
    throw new Error('Thiếu dữ liệu combo.');
  }

  const existingOrder = findPaymentOrderForCombo(userId || 'local', combo.id, withTutoring);
  if (existingOrder) {
    return { order: existingOrder, requiresPayment: true };
  }

  if (!isSupabaseReady() || !userId) {
    throw new Error('Cần đăng nhập để mua combo.');
  }
  if (!accessToken) {
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại trước khi mua.');
  }

  const response = await apiFetch('/api/payments/checkout-combo', {
    method: 'POST',
    token: accessToken,
    body: { comboId: combo.id, withTutoring }
  });

  // Khóa trong danh mục có 2 id (slug + uuid); lưu cả hai để mọi trang nhận ra.
  const unlockIds = (response.courseIds || combo.courseIds || []).flatMap((databaseId) => {
    const course = combo.courses.find((item) => courseKey(item) === String(databaseId));
    return course ? [databaseId, course.id] : [databaseId];
  });

  if (response.status === 'paid') {
    const ownedIds = Array.from(new Set([...getPurchasedCourseIds(userId), ...unlockIds]));
    setPurchasedCourseIds(userId, ownedIds);
    return { order: null, requiresPayment: false, ownedCourseIds: ownedIds };
  }

  const order = upsertPaymentOrder({
    id: response.orderId,
    userId,
    studentEmail: user?.email || '',
    studentName: user?.user_metadata?.full_name || user?.email || 'Học viên',
    comboId: combo.id,
    courseId: response.courseIds?.[0] || '',
    courseIds: unlockIds,
    courseTitle: withTutoring ? `${combo.title} + dạy kèm` : combo.title,
    withTutoring,
    amount: response.amount ?? (withTutoring ? combo.tutoringPrice : combo.price),
    status: response.status || 'pending',
    provider: 'sepay',
    transferCode: response.transferCode,
    qrImageUrl: response.qrImageUrl || '',
    bankCode: response.bankCode,
    accountNumber: response.accountNumber,
    accountName: response.accountName,
    createdAt: new Date().toISOString()
  });

  void logActivity(userId, 'purchase', combo.id, combo.title, {
    orderId: response.orderId,
    mode: response.mode,
    combo: true,
    status: order?.status
  });

  return { order, requiresPayment: true };
}
