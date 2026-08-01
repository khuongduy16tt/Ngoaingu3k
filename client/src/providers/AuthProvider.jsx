import React from 'react';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityService';
import { checkDeviceSlot, claimDeviceSlot, releaseDeviceSlot } from '../lib/deviceSessionService';

const AuthContext = createContext(null);
const MOCK_AUTH_STORAGE_KEY = 'ngoaingu3k-mock-auth';
const MOCK_DEFAULT_ROLE = 'student';
const validRoles = ['student', 'teacher', 'admin'];

// ─── Giới hạn 1 thiết bị cho mỗi tài khoản học viên ──────────────────────────
// Chỉ siết với học viên: giáo viên và admin vẫn cần mở nhiều máy cùng lúc.
// Vai trò lấy từ `profiles.role` dưới DB (nguồn thật), không lấy từ state `role`
// vốn có thể bị đổi tại chỗ. Đọc không ra hồ sơ thì KHÔNG siết — thà một học
// viên lọt qua còn hơn đá nhầm giáo viên khi mạng chập chờn.
const DEVICE_LIMITED_ROLE = 'student';
const DEVICE_CHECK_INTERVAL_MS = 20000;
const PENDING_LOGIN_STORAGE_KEY = 'ngoaingu3k-pending-login';

// Đánh dấu "người dùng vừa chủ động bấm đăng nhập" để phân biệt với "mở lại app
// khi đã có phiên sẵn". Chỉ trường hợp đầu mới được giành chỗ thiết bị; nếu mở
// lại app cũng giành chỗ thì máy cũ chỉ cần F5 là cướp lại chỗ của máy mới.
// Dùng sessionStorage vì đăng nhập Google chuyển hẳn sang trang khác rồi quay
// lại — biến trong bộ nhớ không sống sót qua vòng chuyển trang đó.
function markPendingLogin() {
  try {
    sessionStorage.setItem(PENDING_LOGIN_STORAGE_KEY, '1');
  } catch {
    // Ignore storage errors in restricted browser contexts.
  }
}

function consumePendingLogin() {
  try {
    const pending = sessionStorage.getItem(PENDING_LOGIN_STORAGE_KEY) === '1';
    if (pending) {
      sessionStorage.removeItem(PENDING_LOGIN_STORAGE_KEY);
    }
    return pending;
  } catch {
    return false;
  }
}

function normalizeRole(role) {
  return validRoles.includes(role) ? role : 'student';
}

function writeStoredRole(role) {
  try {
    localStorage.setItem('role', role);
  } catch {
    // Ignore storage errors in restricted browser contexts.
  }
}

function readStoredMockAuth(fallbackRole) {
  try {
    const rawValue = localStorage.getItem(MOCK_AUTH_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue);
    if (!parsed?.session?.user?.email) {
      return null;
    }

    return createMockAuthState({
      email: parsed.session.user.email,
      fullName: parsed.profile?.full_name || parsed.session.user.user_metadata?.full_name,
      phone: parsed.profile?.phone || parsed.session.user.user_metadata?.phone,
      role: fallbackRole
    });
  } catch {
    return null;
  }
}

function writeStoredMockAuth(authState) {
  try {
    localStorage.setItem(MOCK_AUTH_STORAGE_KEY, JSON.stringify(authState));
  } catch {
    // Ignore storage errors in restricted browser contexts.
  }
}

function clearStoredMockAuth() {
  try {
    localStorage.removeItem(MOCK_AUTH_STORAGE_KEY);
  } catch {
    // Ignore storage errors in restricted browser contexts.
  }
}

function createMockAuthState({ email, fullName, phone, role }) {
  const normalizedRole = normalizeRole(role);
  const normalizedEmail = email || `${normalizedRole}.demo@ngoaingu3k.local`;
  const normalizedName = fullName || normalizedEmail;
  const normalizedPhone = phone || '';
  const user = {
    id: `local-${normalizedRole}`,
    email: normalizedEmail,
    app_metadata: { provider: 'mock' },
    user_metadata: {
      full_name: normalizedName,
      phone: normalizedPhone,
      role: normalizedRole
    }
  };
  const profile = {
    id: user.id,
    full_name: normalizedName,
    phone: normalizedPhone,
    role: normalizedRole,
    avatar_url: '',
    source: 'local'
  };

  return {
    session: {
      access_token: 'dev-token',
      token_type: 'bearer',
      user
    },
    profile
  };
}

export function AuthProvider({ children }) {
  const initialRole = supabase ? 'student' : MOCK_DEFAULT_ROLE;
  const initialMockAuth = supabase ? null : readStoredMockAuth(initialRole);
  const [session, setSession] = useState(initialMockAuth?.session ?? null);
  const [profile, setProfile] = useState(initialMockAuth?.profile ?? null);
  const [role, setRoleState] = useState(() =>
    normalizeRole(initialMockAuth?.profile?.role || initialRole)
  );
  const [ready, setReady] = useState(!supabase);
  const [loading, setLoading] = useState(Boolean(supabase));
  // Bật khi tài khoản này vừa được đăng nhập ở máy khác nên máy này bị đăng
  // xuất — trang đăng nhập đọc cờ này để giải thích cho người dùng.
  const [deviceKickedOut, setDeviceKickedOut] = useState(false);
  const skipNextLoginLogRef = useRef(false);
  const deviceGuardQueueRef = useRef(Promise.resolve());
  // Id của user đang thực sự đăng nhập — dùng để phân biệt "đổi user thật"
  // (login / logout / đổi tài khoản) với các sự kiện Supabase phát lại cho
  // CÙNG một user (SIGNED_IN khi focus lại tab, TOKEN_REFRESHED định kỳ).
  const loadedProfileUserIdRef = useRef(initialMockAuth?.session?.user?.id ?? null);

  useEffect(() => {
    if (!supabase) {
      writeStoredRole(role);
    }
  }, [role]);

  async function loadProfile(userId) {
    if (!supabase || !userId) {
      setProfile(null);
      setRoleState('student');
      return null;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone, role, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data) {
      setProfile(data);
      if (data.role) {
        setRoleState(normalizeRole(data.role));
      }
      return data;
    } else {
      setProfile(null);
      setRoleState('student');
      return null;
    }
  }

  // Máy này mất quyền dùng tài khoản. `scope: 'local'` là bắt buộc: mặc định
  // của supabase-js là 'global', sẽ thu hồi refresh token của MỌI phiên và đá
  // luôn cả máy vừa đăng nhập.
  async function signOutKickedDevice() {
    setDeviceKickedOut(true);
    await supabase.auth.signOut({ scope: 'local' });
  }

  // Vừa đăng nhập thì giành chỗ thiết bị; mọi lần khác chỉ kiểm tra xem chỗ có
  // còn là máy này không.
  async function applyDeviceGuard(userId, nextProfile) {
    if (!supabase || !userId || nextProfile?.role !== DEVICE_LIMITED_ROLE) {
      return;
    }

    if (consumePendingLogin()) {
      setDeviceKickedOut(false);
      await claimDeviceSlot(userId);
      return;
    }

    if ((await checkDeviceSlot(userId)) === 'kick') {
      await signOutKickedDevice();
    }
  }

  // Mỗi lần mở app, cả nhánh getSession lẫn nhánh onAuthStateChange đều chạy
  // guard. Xếp chúng nối đuôi nhau để một lượt kiểm tra không bao giờ chen được
  // vào giữa lượt giành chỗ — nếu chen vào, người vừa đăng nhập sẽ đọc trúng
  // thiết bị cũ và tự đá chính mình ra.
  function queueDeviceGuard(userId, nextProfile) {
    deviceGuardQueueRef.current = deviceGuardQueueRef.current
      .then(() => applyDeviceGuard(userId, nextProfile))
      .catch(() => {});
    return deviceGuardQueueRef.current;
  }

  function setRole(nextRole) {
    const normalizedRole = normalizeRole(nextRole);
    setRoleState(normalizedRole);

    if (!supabase) {
      setProfile((previousProfile) =>
        previousProfile ? { ...previousProfile, role: normalizedRole } : previousProfile
      );
      setSession((previousSession) => {
        if (!previousSession?.user) {
          return previousSession;
        }

        const nextAuthState = createMockAuthState({
          email: previousSession.user.email,
          fullName: previousSession.user.user_metadata?.full_name,
          phone: previousSession.user.user_metadata?.phone,
          role: normalizedRole
        });
        writeStoredMockAuth(nextAuthState);
        return nextAuthState.session;
      });
    }
  }

  async function signInMock(email, options = {}) {
    const nextAuthState = createMockAuthState({
      email,
      fullName: options.full_name || options.fullName,
      phone: options.phone,
      role: options.role || role
    });

    setSession(nextAuthState.session);
    setProfile(nextAuthState.profile);
    setRoleState(nextAuthState.profile.role);
    writeStoredRole(nextAuthState.profile.role);
    writeStoredMockAuth(nextAuthState);
    void logActivity(nextAuthState.session.user.id, 'login');

    return {
      data: {
        session: nextAuthState.session,
        user: nextAuthState.session.user
      },
      error: null
    };
  }

  async function updateProfile(updates) {
    if (!supabase) {
      // Mock mode: update local state only
      setProfile((prev) => prev ? { ...prev, ...updates } : prev);
      return { error: null };
    }

    const userId = session?.user?.id;
    if (!userId) return { error: new Error('Không có user') };

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (!error) {
      setProfile((prev) => prev ? { ...prev, ...updates } : prev);
    }
    return { error };
  }

  async function signOut() {
    const userId = session?.user?.id;
    if (userId) {
      void logActivity(userId, 'logout');
      // Nhả chỗ để lần sau đăng nhập ở máy nào cũng vào thẳng, không phải chờ
      // một vòng kiểm tra.
      if (supabase && profile?.role === DEVICE_LIMITED_ROLE) {
        await releaseDeviceSlot(userId);
      }
    }

    if (!supabase) {
      clearStoredMockAuth();
      setSession(null);
      setProfile(null);
      return { error: null };
    }

    return supabase.auth.signOut();
  }

  async function signInWithEmail(email, password) {
    if (!supabase) {
      return signInMock(email);
    }

    markPendingLogin();
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result?.error) {
      // Sai mật khẩu mà vẫn để cờ lại thì lần mở app sau bị hiểu nhầm là vừa
      // đăng nhập, và máy này cướp mất chỗ của máy đang dùng thật.
      consumePendingLogin();
    }
    return result;
  }

  async function signUpWithEmail(email, password, options = {}) {
    if (!supabase) {
      const result = await signInMock(email, options);
      if (result?.data?.user?.id) {
        void logActivity(result.data.user.id, 'signup');
      }
      return result;
    }

    skipNextLoginLogRef.current = true;
    markPendingLogin();
    const result = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: options
      }
    });
    if (result?.error) {
      consumePendingLogin();
    }
    if (result?.data?.user?.id) {
      void logActivity(result.data.user.id, 'signup');
      await loadProfile(result.data.user.id);
    }
    return result;
  }

  function signInWithGoogle() {
    if (!supabase) {
      return signInMock('google.demo@ngoaingu3k.local', {
        full_name: 'Google Demo User',
        phone: ''
      });
    }

    markPendingLogin();
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth`
      }
    });
  }

  function sendPasswordReset(email) {
    if (!supabase) {
      return Promise.resolve({ data: { email }, error: null });
    }

    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`
    });
  }

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let active = true;
    setLoading(true);

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!active) {
          return;
        }

        const nextSession = data.session ?? null;
        setSession(nextSession);
        loadedProfileUserIdRef.current = nextSession?.user?.id ?? null;
        if (nextSession?.user?.id) {
          const nextProfile = await loadProfile(nextSession.user.id);
          await queueDeviceGuard(nextSession.user.id, nextProfile);
        } else {
          setProfile(null);
          setRoleState('student');
        }

        if (active) {
          setReady(true);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setSession(null);
          setProfile(null);
          setReady(true);
          setLoading(false);
        }
      });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!active) {
        return;
      }

      const nextUserId = nextSession?.user?.id ?? null;
      // Chỉ coi là "đổi user thật" khi identity thay đổi. Supabase phát lại
      // SIGNED_IN mỗi lần focus lại tab và TOKEN_REFRESHED định kỳ cho CÙNG
      // một user — đó không phải chuyển phiên thật.
      const isUserTransition = nextUserId !== loadedProfileUserIdRef.current;

      if (event === 'SIGNED_IN' && nextUserId && isUserTransition) {
        if (skipNextLoginLogRef.current) {
          skipNextLoginLogRef.current = false;
        } else {
          void logActivity(nextUserId, 'login');
        }
      }

      // Sự kiện phát lại cho cùng user (SIGNED_IN khi focus, TOKEN_REFRESHED):
      // chỉ cập nhật session tại chỗ, KHÔNG đụng `ready`/`loading`. Nếu để
      // `ready` về false, ProtectedRoute sẽ thay toàn màn bằng "Đang tải
      // phiên..." rồi remount dashboard, chạy lại các lệnh tải dữ liệu chậm
      // → lặp lỗi "quá thời gian chờ" và nháy cả màn (bug bảng điều khiển
      // giảng viên). Chỉ chạy vòng loading khi user thật sự đổi.
      if (!isUserTransition) {
        setSession(nextSession);
        return;
      }

      setLoading(true);
      setReady(false);
      setSession(nextSession);
      loadedProfileUserIdRef.current = nextUserId;
      if (nextUserId) {
        const nextProfile = await loadProfile(nextUserId);
        await queueDeviceGuard(nextUserId, nextProfile);
      } else {
        setProfile(null);
        setRoleState('student');
      }
      if (!active) {
        return;
      }
      setReady(true);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Kiểm tra định kỳ chỗ thiết bị khi tab đang hiển thị, và ngay lúc người dùng
  // quay lại tab — máy cũ vì thế văng ra trong khoảng 20s, hoặc lập tức khi họ
  // bấm vào lại cửa sổ. Cùng khuôn với StudentProgressPage (dự án chưa dùng
  // Supabase Realtime).
  const guardedUserId = supabase && profile?.role === DEVICE_LIMITED_ROLE ? session?.user?.id ?? null : null;

  useEffect(() => {
    if (!guardedUserId) {
      return undefined;
    }

    let active = true;

    function verifyDeviceSlot() {
      if (document.visibilityState !== 'visible') {
        return;
      }

      deviceGuardQueueRef.current = deviceGuardQueueRef.current
        .then(async () => {
          if (!active) {
            return;
          }
          if ((await checkDeviceSlot(guardedUserId)) === 'kick') {
            await signOutKickedDevice();
          }
        })
        .catch(() => {});
    }

    const intervalId = setInterval(verifyDeviceSlot, DEVICE_CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', verifyDeviceSlot);

    return () => {
      active = false;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', verifyDeviceSlot);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardedUserId]);

  const value = useMemo(
    () => ({
      ready,
      loading,
      session,
      profile,
      role,
      setRole,
      supabase,
      isMockMode: !supabase,
      user: session?.user ?? null,
      isAuthenticated: Boolean(session),
      deviceKickedOut,
      signOut,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      sendPasswordReset,
      updateProfile
    }),
    [deviceKickedOut, loading, profile, ready, role, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('AuthProvider is missing');
  }
  return context;
}
