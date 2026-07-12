export const PURCHASED_COURSES_STORAGE_KEY = 'learning-purchased-courses-v2';

function getPurchaseKey(userId = 'local') {
  return `${PURCHASED_COURSES_STORAGE_KEY}:${userId || 'local'}`;
}

function dedupeStrings(values) {
  return Array.from(new Set((values || []).filter(Boolean).map(String)));
}

function readStoredJson(key, fallback) {
  try {
    const rawValue = localStorage.getItem(key);
    if (!rawValue) return fallback;
    return JSON.parse(rawValue) ?? fallback;
  } catch {
    return fallback;
  }
}

function writePurchasedCourseIds(userId, courseIds) {
  const nextValue = dedupeStrings(courseIds);

  try {
    localStorage.setItem(getPurchaseKey(userId), JSON.stringify(nextValue));
    window.dispatchEvent(
      new CustomEvent('course-purchases-updated', {
        detail: {
          courseIds: nextValue,
          userId: userId || 'local'
        }
      })
    );
  } catch {
    // ignore storage failures in restricted browser contexts
  }

  return nextValue;
}

export function getPurchasedCourseIds(userId = 'local') {
  const stored = readStoredJson(getPurchaseKey(userId), []);
  return Array.isArray(stored) ? dedupeStrings(stored) : [];
}

export function setPurchasedCourseIds(userId = 'local', courseIds = []) {
  return writePurchasedCourseIds(userId, courseIds);
}

export function grantPurchasedCourseId(userId = 'local', courseId) {
  return setPurchasedCourseIds(userId, [...getPurchasedCourseIds(userId), courseId]);
}
