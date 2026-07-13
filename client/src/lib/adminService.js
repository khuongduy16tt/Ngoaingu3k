import { featuredCourses } from '../data/mock';
import { isSupabaseReady, supabase } from './supabase';
import { apiFetch } from './api';
import { normalizeVndAmount } from './money';
import {
  approveManualPaymentOrder,
  readPaymentOrders,
  upsertPaymentOrder
} from './paymentService';
import { grantPurchasedCourseId } from './purchaseStorage';

const adminStorageKey = 'admin-dashboard-state-v1';

export const defaultRolePermissions = [
  {
    role: 'student',
    label: 'Học viên',
    permissions: {
      viewLearning: true,
      manageOwnProgress: true,
      manageUsers: false,
      manageCourses: false,
      manageLessons: false,
      manageTeachers: false,
      manageSystem: false
    }
  },
  {
    role: 'teacher',
    label: 'Giảng viên',
    permissions: {
      viewLearning: true,
      manageOwnProgress: false,
      manageUsers: false,
      manageCourses: true,
      manageLessons: true,
      manageTeachers: false,
      manageSystem: false
    }
  },
  {
    role: 'admin',
    label: 'Quản trị',
    permissions: {
      viewLearning: true,
      manageOwnProgress: true,
      manageUsers: true,
      manageCourses: true,
      manageLessons: true,
      manageTeachers: true,
      manageSystem: true
    }
  }
];

const fallbackProfiles = [
  {
    id: 'local-student-1',
    fullName: 'Minh Anh',
    email: 'minh.anh@ngoaingu3k.com',
    phone: '0901000001',
    role: 'student',
    avatarUrl: '',
    createdAt: '2026-07-01T08:00:00.000Z',
    source: 'local'
  },
  {
    id: 'local-student-2',
    fullName: 'Gia Huy',
    email: 'gia.huy@ngoaingu3k.com',
    phone: '0901000002',
    role: 'student',
    avatarUrl: '',
    createdAt: '2026-07-02T08:00:00.000Z',
    source: 'local'
  },
  {
    id: 'local-teacher-1',
    fullName: 'Cô Linh',
    email: 'linh.teacher@ngoaingu3k.com',
    phone: '0901000101',
    role: 'teacher',
    avatarUrl: '',
    createdAt: '2026-07-01T07:00:00.000Z',
    source: 'local'
  },
  {
    id: 'local-admin-1',
    fullName: 'Admin Ngoaingu3k',
    email: 'admin@ngoaingu3k.com',
    phone: '0901000999',
    role: 'admin',
    avatarUrl: '',
    createdAt: '2026-07-01T06:00:00.000Z',
    source: 'local'
  }
];

const fallbackCourses = featuredCourses.slice(0, 4).map((course, index) => ({
  id: course.id,
  databaseId: course.id,
  slug: course.slug || course.id,
  title: course.title,
  description: course.summary,
  price: course.price,
  status: 'published',
  teacherId: index < 2 ? 'local-teacher-1' : '',
  bannerUrl: course.bannerUrl || '',
  createdAt: '2026-07-01T08:00:00.000Z',
  source: 'local'
}));

const fallbackLessons = [
  {
    id: 'local-lesson-1',
    databaseId: 'local-lesson-1',
    courseId: 'english-foundation',
    chapterId: 'local-chapter-1',
    title: 'Bài 1. Giới thiệu bản thân',
    content: 'Mẫu câu chào hỏi, giới thiệu tên và nghề nghiệp.',
    videoUrl: '',
    position: 1,
    isPreview: true,
    source: 'local'
  },
  {
    id: 'local-lesson-2',
    databaseId: 'local-lesson-2',
    courseId: 'english-foundation',
    chapterId: 'local-chapter-1',
    title: 'Bài 2. Phát âm trọng tâm',
    content: 'Luyện nghe, nhại âm và nhận diện trọng âm.',
    videoUrl: '',
    position: 2,
    isPreview: false,
    source: 'local'
  }
];

function createDefaultState() {
  return {
    profiles: fallbackProfiles,
    courses: fallbackCourses,
    lessons: fallbackLessons,
    orders: [
      {
        id: 'local-order-1',
        userId: 'local-student-1',
        courseId: 'english-foundation',
        status: 'paid',
        amount: 490000,
        createdAt: '2026-07-04T08:00:00.000Z'
      }
    ],
    progress: [
      {
        userId: 'local-student-1',
        lessonId: 'local-lesson-1',
        completed: true,
        updatedAt: '2026-07-05T08:00:00.000Z'
      }
    ],
    assignments: [],
    rolePermissions: defaultRolePermissions
  };
}

function readStoredState() {
  try {
    const rawValue = localStorage.getItem(adminStorageKey);
    return rawValue ? { ...createDefaultState(), ...JSON.parse(rawValue) } : createDefaultState();
  } catch {
    return createDefaultState();
  }
}

function writeStoredState(nextState) {
  try {
    localStorage.setItem(adminStorageKey, JSON.stringify(nextState));
  } catch {
    // ignore storage failures
  }

  return nextState;
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 10000)}`;
}

function createSlug(title, fallback = 'khoa-hoc') {
  return String(title || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
}

function normalizeProfile(profile) {
  return {
    id: profile.id,
    fullName: profile.full_name || profile.fullName || profile.email || 'Chưa đặt tên',
    email: profile.email || '',
    phone: profile.phone || '',
    role: profile.role || 'student',
    avatarUrl: profile.avatar_url || profile.avatarUrl || '',
    createdAt: profile.created_at || profile.createdAt || '',
    updatedAt: profile.updated_at || profile.updatedAt || '',
    source: profile.source || 'supabase'
  };
}

function normalizeCourse(course) {
  return {
    id: course.slug || course.id,
    databaseId: course.databaseId || course.id,
    slug: course.slug || course.id,
    title: course.title || 'Khóa học chưa đặt tên',
    description: course.description || course.summary || '',
    price: normalizeVndAmount(course.price),
    status: course.status || 'draft',
    teacherId: course.teacher_id || course.teacherId || '',
    bannerUrl: course.banner_url || course.bannerUrl || '',
    createdAt: course.created_at || course.createdAt || '',
    updatedAt: course.updated_at || course.updatedAt || '',
    source: course.source || 'supabase'
  };
}

function formatLessonContentForAdmin(content) {
  if (!content) {
    return '';
  }

  if (typeof content === 'string') {
    return content;
  }

  if (typeof content === 'object') {
    if (typeof content.note === 'string' && content.note.trim()) {
      return content.note;
    }

    if (typeof content.content === 'string') {
      return content.content;
    }

    return JSON.stringify(content, null, 2);
  }

  return String(content);
}

function buildLessonContentPayload(content) {
  const value = String(content || '').trim();
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : { content: value };
  } catch {
    return { content: value };
  }
}

function normalizeLesson(lesson, chapterLookup = new Map()) {
  const chapter = chapterLookup.get(lesson.chapter_id || lesson.chapterId) || {};

  return {
    id: lesson.id,
    databaseId: lesson.databaseId || lesson.id,
    courseId: lesson.course_id || lesson.courseId || chapter.courseId || '',
    chapterId: lesson.chapter_id || lesson.chapterId || '',
    chapterTitle: chapter.title || lesson.chapterTitle || '',
    title: lesson.title || 'Bài học chưa đặt tên',
    content: formatLessonContentForAdmin(lesson.content),
    videoUrl: lesson.video_url || lesson.videoUrl || '',
    position: Number(lesson.position || 0),
    isPreview: Boolean(lesson.is_preview ?? lesson.isPreview),
    createdAt: lesson.created_at || lesson.createdAt || '',
    source: lesson.source || 'supabase'
  };
}

function normalizeOrder(order) {
  return {
    id: order.id,
    userId: order.user_id || order.userId,
    courseId: order.course_id || order.courseId,
    localCourseId: order.localCourseId || order.local_course_id || '',
    courseTitle: order.courseTitle || order.course_title || '',
    studentEmail: order.studentEmail || order.student_email || '',
    studentName: order.studentName || order.student_name || '',
    transferCode: order.transferCode || order.transfer_code || '',
    provider: order.provider || 'manual-bank-transfer',
    status: order.status || 'pending',
    amount: normalizeVndAmount(order.amount),
    createdAt: order.created_at || order.createdAt || '',
    confirmedAt: order.confirmed_at || order.confirmedAt || '',
    approvedAt: order.approved_at || order.approvedAt || '',
    adminEmailSent: Boolean(order.adminEmailSent || order.admin_email_sent)
  };
}

function normalizeProgress(progress) {
  return {
    userId: progress.user_id || progress.userId,
    lessonId: progress.lesson_id || progress.lessonId,
    completed: Boolean(progress.completed),
    updatedAt: progress.updated_at || progress.updatedAt || ''
  };
}

function normalizeRolePermission(row) {
  const fallback = defaultRolePermissions.find((item) => item.role === row.role);

  return {
    role: row.role,
    label: row.label || fallback?.label || row.role,
    permissions: {
      ...(fallback?.permissions || {}),
      ...(row.permissions || {})
    }
  };
}

function mergeOrders(primaryOrders = [], extraOrders = []) {
  const orderLookup = new Map();
  [...primaryOrders, ...extraOrders].forEach((order) => {
    if (order?.id) {
      orderLookup.set(order.id, normalizeOrder(order));
    }
  });
  return Array.from(orderLookup.values()).sort(
    (left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0)
  );
}

async function maybeSelect(table, query) {
  const { data, error } = await query(supabase.from(table));
  if (error) {
    return null;
  }
  return data || [];
}

export async function getAdminDashboardData() {
  const localState = readStoredState();
  const localPaymentOrders = readPaymentOrders();

  if (!isSupabaseReady()) {
    return {
      ...localState,
      orders: mergeOrders(localState.orders, localPaymentOrders),
      mode: 'local'
    };
  }

  const [profiles, courses, chapters, lessons, orders, progress, assignments, rolePermissions] = await Promise.all([
    maybeSelect('profiles', (query) =>
      query.select('id, full_name, email, phone, role, avatar_url, created_at, updated_at').order('created_at', { ascending: false })
    ),
    maybeSelect('courses', (query) =>
      query.select('id, slug, title, description, price, status, teacher_id, banner_url, created_at, updated_at').order('updated_at', { ascending: false })
    ),
    maybeSelect('chapters', (query) =>
      query.select('id, course_id, title, position').order('position', { ascending: true })
    ),
    maybeSelect('lessons', (query) =>
      query.select('id, chapter_id, title, video_url, content, position, is_preview, created_at').order('position', { ascending: true })
    ),
    maybeSelect('orders', (query) =>
      query.select('id, user_id, course_id, status, amount, provider, created_at').order('created_at', { ascending: false })
    ),
    maybeSelect('progress', (query) =>
      query.select('user_id, lesson_id, completed, updated_at')
    ),
    maybeSelect('lesson_assignments', (query) =>
      query.select('id, teacher_id, course_key, course_title, lesson_title, title, assignment_scope, created_at').order('created_at', { ascending: false })
    ),
    maybeSelect('role_permissions', (query) =>
      query.select('role, label, permissions, updated_at')
    )
  ]);

  const chapterLookup = new Map(
    (chapters || []).map((chapter) => [
      chapter.id,
      {
        id: chapter.id,
        courseId: chapter.course_id,
        title: chapter.title,
        position: chapter.position
      }
    ])
  );
  const hasRemoteError = [
    profiles,
    courses,
    chapters,
    lessons,
    orders,
    progress,
    assignments,
    rolePermissions
  ].some((result) => result === null);

  return {
    profiles: profiles ? profiles.map(normalizeProfile) : [],
    courses: courses ? courses.map(normalizeCourse) : [],
    lessons: lessons ? lessons.map((lesson) => normalizeLesson(lesson, chapterLookup)) : [],
    orders: mergeOrders(orders || [], localPaymentOrders),
    progress: progress ? progress.map(normalizeProgress) : [],
    assignments: assignments || [],
    rolePermissions: rolePermissions?.length
      ? rolePermissions.map(normalizeRolePermission)
      : localState.rolePermissions,
    mode: hasRemoteError ? 'supabase-partial' : 'supabase'
  };
}

export async function saveAdminProfile(profile) {
  const state = readStoredState();
  const nextProfile = normalizeProfile({
    ...profile,
    id: profile.id || makeId(`local-${profile.role || 'user'}`),
    source: profile.source || (profile.id ? 'supabase' : 'local')
  });

  const isLocalOnly = !isSupabaseReady() || !profile.id || String(profile.id).startsWith('local-');

  if (!isLocalOnly) {
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: nextProfile.fullName,
        email: nextProfile.email,
        phone: nextProfile.phone,
        role: nextProfile.role,
        avatar_url: nextProfile.avatarUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', nextProfile.id);

    if (error) {
      throw error;
    }
  }

  const nextState = {
    ...state,
    profiles: [
      nextProfile,
      ...state.profiles.filter((item) => item.id !== nextProfile.id)
    ]
  };
  writeStoredState(nextState);

  return nextProfile;
}

export async function deleteAdminProfile(profileId) {
  const state = readStoredState();

  if (isSupabaseReady() && !String(profileId).startsWith('local-')) {
    const { error } = await supabase.from('profiles').delete().eq('id', profileId);
    if (error) {
      throw error;
    }
  }

  writeStoredState({
    ...state,
    profiles: state.profiles.filter((profile) => profile.id !== profileId)
  });
}

export async function saveAdminCourse(course) {
  const state = readStoredState();
  const slug = course.slug || createSlug(course.title);
  const nextCourse = normalizeCourse({
    ...course,
    id: course.id || slug,
    databaseId: course.databaseId || course.id || slug,
    slug,
    source: course.source || (isSupabaseReady() ? 'supabase' : 'local')
  });

  if (isSupabaseReady() && nextCourse.source !== 'local' && /^[0-9a-f-]{36}$/i.test(nextCourse.databaseId || '')) {
    const { error } = await supabase
      .from('courses')
      .update({
        slug: nextCourse.slug,
        title: nextCourse.title,
        description: nextCourse.description,
        price: nextCourse.price,
        status: nextCourse.status,
        teacher_id: nextCourse.teacherId || null,
        banner_url: nextCourse.bannerUrl || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', nextCourse.databaseId);

    if (error) {
      throw error;
    }
  } else if (isSupabaseReady() && nextCourse.source !== 'local') {
    const { data, error } = await supabase
      .from('courses')
      .insert({
        slug: nextCourse.slug,
        title: nextCourse.title,
        description: nextCourse.description,
        price: nextCourse.price,
        status: nextCourse.status,
        teacher_id: nextCourse.teacherId || null,
        banner_url: nextCourse.bannerUrl || null
      })
      .select('id, slug, title, description, price, status, teacher_id, banner_url, created_at, updated_at')
      .single();

    if (error) {
      throw error;
    }

    Object.assign(nextCourse, normalizeCourse(data));
  }

  writeStoredState({
    ...state,
    courses: [
      nextCourse,
      ...state.courses.filter((item) => item.id !== nextCourse.id && item.databaseId !== nextCourse.databaseId)
    ]
  });

  return nextCourse;
}

export async function deleteAdminCourse(course) {
  const state = readStoredState();
  const courseId = course.databaseId || course.id;

  if (isSupabaseReady() && /^[0-9a-f-]{36}$/i.test(courseId || '')) {
    const { error } = await supabase.from('courses').delete().eq('id', courseId);
    if (error) {
      throw error;
    }
  }

  writeStoredState({
    ...state,
    courses: state.courses.filter((item) => item.id !== course.id && item.databaseId !== course.databaseId),
    lessons: state.lessons.filter((lesson) => lesson.courseId !== course.id && lesson.courseId !== course.databaseId)
  });
}

async function ensureChapter(courseId) {
  const { data: existingChapters, error: existingError } = await supabase
    .from('chapters')
    .select('id')
    .eq('course_id', courseId)
    .order('position', { ascending: true })
    .limit(1);

  if (existingError) {
    throw existingError;
  }

  if (existingChapters?.length) {
    return existingChapters[0].id;
  }

  const { data, error } = await supabase
    .from('chapters')
    .insert({ course_id: courseId, title: 'Nội dung chính', position: 1 })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return data.id;
}

export async function saveAdminLesson(lesson) {
  const state = readStoredState();
  const nextLesson = normalizeLesson({
    ...lesson,
    id: lesson.id || makeId('local-lesson'),
    databaseId: lesson.databaseId || lesson.id || makeId('local-lesson'),
    source: lesson.source || (isSupabaseReady() ? 'supabase' : 'local')
  });

  if (isSupabaseReady() && nextLesson.source !== 'local' && /^[0-9a-f-]{36}$/i.test(nextLesson.databaseId || '')) {
    const { error } = await supabase
      .from('lessons')
      .update({
        title: nextLesson.title,
        video_url: nextLesson.videoUrl || null,
        content: buildLessonContentPayload(nextLesson.content),
        position: nextLesson.position,
        is_preview: nextLesson.isPreview
      })
      .eq('id', nextLesson.databaseId);

    if (error) {
      throw error;
    }
  } else if (isSupabaseReady() && nextLesson.source !== 'local' && /^[0-9a-f-]{36}$/i.test(nextLesson.courseId || '')) {
    const chapterId = nextLesson.chapterId || await ensureChapter(nextLesson.courseId);
    const { data, error } = await supabase
      .from('lessons')
      .insert({
        chapter_id: chapterId,
        title: nextLesson.title,
        video_url: nextLesson.videoUrl || null,
        content: buildLessonContentPayload(nextLesson.content),
        position: nextLesson.position,
        is_preview: nextLesson.isPreview
      })
      .select('id, chapter_id, title, video_url, content, position, is_preview, created_at')
      .single();

    if (error) {
      throw error;
    }

    Object.assign(nextLesson, normalizeLesson({ ...data, courseId: nextLesson.courseId }));
  }

  writeStoredState({
    ...state,
    lessons: [
      nextLesson,
      ...state.lessons.filter((item) => item.id !== nextLesson.id && item.databaseId !== nextLesson.databaseId)
    ]
  });

  return nextLesson;
}

export async function deleteAdminLesson(lesson) {
  const state = readStoredState();
  const lessonId = lesson.databaseId || lesson.id;

  if (isSupabaseReady() && /^[0-9a-f-]{36}$/i.test(lessonId || '')) {
    const { error } = await supabase.from('lessons').delete().eq('id', lessonId);
    if (error) {
      throw error;
    }
  }

  writeStoredState({
    ...state,
    lessons: state.lessons.filter((item) => item.id !== lesson.id && item.databaseId !== lesson.databaseId)
  });
}

export async function saveRolePermissions(rolePermissions) {
  const state = readStoredState();
  const normalizedPermissions = rolePermissions.map(normalizeRolePermission);

  if (isSupabaseReady()) {
    const { error } = await supabase
      .from('role_permissions')
      .upsert(
        normalizedPermissions.map((item) => ({
          role: item.role,
          label: item.label,
          permissions: item.permissions,
          updated_at: new Date().toISOString()
        })),
        { onConflict: 'role' }
      );

    if (error) {
      throw error;
    }
  }

  writeStoredState({
    ...state,
    rolePermissions: normalizedPermissions
  });

  return normalizedPermissions;
}

// ─── Thông tin người dùng với trạng thái mua hàng ────────────────────────────

const fallbackOrders = [];

/**
 * Lấy danh sách users kèm thông tin mua hàng (đã mua / chưa mua).
 * @returns {{ profiles: Array, orders: Array }}
 */
export async function getUsersWithPurchaseInfo() {
  const state = readStoredState();
  const localPaymentOrders = readPaymentOrders();

  if (!isSupabaseReady()) {
    return { profiles: state.profiles || fallbackProfiles, orders: mergeOrders(state.orders || fallbackOrders, localPaymentOrders) };
  }

  try {
    const [profilesRes, ordersRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, email, phone, role, avatar_url, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('orders')
        .select('id, user_id, course_id, status, amount, provider, created_at'),
    ]);

    const profiles = (profilesRes.data || []).map((p) => ({
      id: p.id,
      fullName: p.full_name || '',
      email: p.email || '',
      phone: p.phone || '',
      role: p.role || 'student',
      avatarUrl: p.avatar_url || '',
      createdAt: p.created_at,
      source: 'supabase',
    }));

    const orders = mergeOrders(ordersRes.data || [], localPaymentOrders);

    return { profiles, orders };
  } catch (err) {
    console.warn('[getUsersWithPurchaseInfo]', err.message);
    return { profiles: state.profiles || fallbackProfiles, orders: mergeOrders(state.orders || fallbackOrders, localPaymentOrders) };
  }
}

export async function approvePaymentOrder(order, accessToken) {
  if (!order?.id) {
    throw new Error('Thiếu thông tin đơn hàng.');
  }

  let approvedOrder = null;

  if (isSupabaseReady() && accessToken && !String(order.id).startsWith('local-payment-')) {
    const response = await apiFetch(`/api/payments/${order.id}/approve`, {
      method: 'POST',
      token: accessToken,
      body: {}
    });

    approvedOrder = upsertPaymentOrder({
      ...order,
      status: response.status || 'paid',
      approvedAt: response.approvedAt || new Date().toISOString()
    });
  } else {
    approvedOrder = approveManualPaymentOrder(order.id);
  }

  const nextOrder = approvedOrder || upsertPaymentOrder({
    ...order,
    status: 'paid',
    approvedAt: new Date().toISOString()
  });

  grantPurchasedCourseId(nextOrder.userId, nextOrder.localCourseId || nextOrder.courseId);
  return nextOrder;
}
