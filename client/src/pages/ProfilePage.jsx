import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import { uploadAvatarImage, validateImageFile } from '../lib/storageService';
import { supabase } from '../lib/supabase';

// ─── Avatar helpers ───────────────────────────────────────────────────────────
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #f97316, #ef4444)',
  'linear-gradient(135deg, #8b5cf6, #6366f1)',
  'linear-gradient(135deg, #06b6d4, #3b82f6)',
  'linear-gradient(135deg, #10b981, #059669)',
  'linear-gradient(135deg, #f59e0b, #f97316)',
  'linear-gradient(135deg, #ec4899, #8b5cf6)',
  'linear-gradient(135deg, #14b8a6, #06b6d4)',
];

function getAvatarGradient(seed) {
  if (!seed) return AVATAR_GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function getInitials(name, email) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return '?';
}

// ─── ProfilePage ──────────────────────────────────────────────────────────────
export default function ProfilePage() {
  usePageTitle('Hồ sơ của tôi');
  const auth = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Redirect nếu chưa đăng nhập
  useEffect(() => {
    if (auth.ready && !auth.session) {
      navigate('/auth', { replace: true });
    }
  }, [auth.ready, auth.session, navigate]);

  const profile = auth.profile;
  const user = auth.user;
  const name = profile?.full_name || user?.user_metadata?.full_name || '';
  const email = user?.email || '';
  const phone = profile?.phone || '';
  const role = profile?.role || auth.role || 'student';
  const avatarUrl = profile?.avatar_url || '';
  const initials = getInitials(name, email);
  const gradient = getAvatarGradient(name || email);
  const roleLabel = role === 'teacher' ? 'Giáo viên' : role === 'admin' ? 'Quản trị viên' : 'Học sinh';
  const joinedAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';

  // Form state
  const [editName, setEditName] = useState(name);
  const [editPhone, setEditPhone] = useState(phone);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');

  // Avatar upload state
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [previewUrl, setPreviewUrl] = useState(avatarUrl);

  // Stats state
  const [stats, setStats] = useState({ courses: 0, completedLessons: 0, joinedDays: 0 });

  // Sync khi profile thay đổi
  useEffect(() => {
    setEditName(profile?.full_name || user?.user_metadata?.full_name || '');
    setEditPhone(profile?.phone || '');
    setPreviewUrl(profile?.avatar_url || '');
  }, [profile, user]);

  // Load stats
  useEffect(() => {
    async function loadStats() {
      if (!supabase || !user?.id) return;
      try {
        const { data: purchases } = await supabase
          .from('purchase_orders')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'approved');

        const { data: progress } = await supabase
          .from('lesson_progress')
          .select('id')
          .eq('user_id', user.id)
          .eq('completed', true);

        const joinedDays = user.created_at
          ? Math.floor((Date.now() - new Date(user.created_at)) / 86400000)
          : 0;

        setStats({
          courses: purchases?.length || 0,
          completedLessons: progress?.length || 0,
          joinedDays
        });
      } catch {
        // ignore
      }
    }
    loadStats();
  }, [user]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    setSaveError('');

    const updates = {
      full_name: editName.trim(),
      phone: editPhone.trim()
    };

    const { error } = await auth.updateProfile(updates);
    setSaving(false);

    if (error) {
      setSaveError('Lưu thất bại: ' + (error.message || 'Lỗi không xác định'));
    } else {
      setSaveMsg('Đã lưu thông tin thành công!');
      setTimeout(() => setSaveMsg(''), 3000);
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadMsg('');

    // Preview tức thì
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result);
    reader.readAsDataURL(file);

    try {
      const userId = user?.id || 'local';
      const result = await uploadAvatarImage(file, userId);
      if (!result) {
        setUploadError('Upload thất bại. Vui lòng thử lại.');
        setPreviewUrl(avatarUrl);
        return;
      }
      const { error } = await auth.updateProfile({ avatar_url: result.url });
      if (error) {
        setUploadError('Cập nhật ảnh thất bại.');
        setPreviewUrl(avatarUrl);
      } else {
        setUploadMsg('Ảnh đại diện đã được cập nhật!');
        setTimeout(() => setUploadMsg(''), 3000);
      }
    } catch (err) {
      console.error('[ProfilePage avatar upload]', err);
      setUploadError('Đã xảy ra lỗi.');
      setPreviewUrl(avatarUrl);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (!auth.ready) {
    return (
      <div className="page centered">
        <div className="profile-loading-spinner" />
        <p style={{ color: 'var(--muted)', marginTop: '1rem' }}>Đang tải hồ sơ...</p>
      </div>
    );
  }

  return (
    <div className="profile-page page">
      {/* ── Hero banner ── */}
      <div className="profile-hero">
        <div className="profile-hero__bg" aria-hidden="true" />
        <div className="profile-hero__content">
          {/* Avatar lớn */}
          <div className="profile-avatar-wrap">
            <div className="profile-avatar-ring">
              {previewUrl ? (
                <img className="profile-avatar-img" src={previewUrl} alt={name || 'Avatar'} />
              ) : (
                <span className="profile-avatar-initials" style={{ background: gradient }}>
                  {initials}
                </span>
              )}
            </div>

            {/* Nút upload overlay */}
            <label
              className={`profile-avatar-upload-btn${uploading ? ' is-uploading' : ''}`}
              htmlFor="profile-avatar-input"
              title="Thay đổi ảnh đại diện"
            >
              {uploading ? (
                <span className="profile-spinner" />
              ) : (
                <>
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>Tải ảnh lên</span>
                </>
              )}
            </label>
            <input
              ref={fileInputRef}
              id="profile-avatar-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="profile-avatar-input-hidden"
              onChange={handleAvatarChange}
              disabled={uploading}
            />

            {/* Upload feedback */}
            {uploadError && (
              <div className="profile-upload-feedback profile-upload-feedback--error">
                {uploadError}
              </div>
            )}
            {uploadMsg && (
              <div className="profile-upload-feedback profile-upload-feedback--success">
                {uploadMsg}
              </div>
            )}
          </div>

          {/* Tên và role */}
          <div className="profile-hero__info">
            <div className="profile-hero__name-row">
              <h1 className="profile-hero__name">{name || 'Người dùng'}</h1>
              <span className={`profile-role-badge profile-role-badge--${role}`}>{roleLabel}</span>
            </div>
            <div className="profile-hero__email">{email}</div>

            {/* ── Compact Stats ── */}
            <div className="profile-hero__stats">
              <div className="profile-hero-stat" title="Khoá học đã mua">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" stroke="var(--info)" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
                <span><strong>{stats.courses}</strong> khoá học</span>
              </div>
              <div className="profile-hero-stat" title="Bài học hoàn thành">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" stroke="var(--success)" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 11 12 14 22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                <span><strong>{stats.completedLessons}</strong> bài học</span>
              </div>
              <div className="profile-hero-stat" title="Ngày tham gia">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" stroke="var(--accent-2)" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>Tham gia <strong>{joinedAt}</strong></span>
              </div>
              <div className="profile-hero-stat" title="Hoạt động (ngày)">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" stroke="var(--warning)" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span><strong>{stats.joinedDays}</strong> ngày hoạt động</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Form chỉnh sửa thông tin ── */}
      <div className="profile-body site-frame">
        <section className="profile-card">
          <div className="profile-card__header">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <h2>Thông tin cá nhân</h2>
          </div>

          <form className="profile-form" onSubmit={handleSave}>
            {/* Họ tên */}
            <div className="profile-form__field">
              <label htmlFor="profile-name" className="profile-form__label">
                Họ và tên
              </label>
              <input
                id="profile-name"
                type="text"
                className="profile-form__input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nhập họ và tên..."
                maxLength={100}
              />
            </div>

            {/* Email (readonly) */}
            <div className="profile-form__field">
              <label className="profile-form__label">Email</label>
              <div className="profile-form__readonly">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <polyline points="22,4 12,13 2,4" />
                </svg>
                {email}
              </div>
            </div>

            {/* Số điện thoại */}
            <div className="profile-form__field">
              <label htmlFor="profile-phone" className="profile-form__label">
                Số điện thoại
              </label>
              <input
                id="profile-phone"
                type="tel"
                className="profile-form__input"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="Nhập số điện thoại..."
                maxLength={20}
              />
            </div>

            {/* Role (readonly) */}
            <div className="profile-form__field">
              <label className="profile-form__label">Vai trò</label>
              <div className="profile-form__readonly">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                {roleLabel}
              </div>
            </div>

            {/* Feedback */}
            {saveError && (
              <div className="profile-form__msg profile-form__msg--error">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2Zm1 15h-2v-2h2v2Zm0-4h-2V7h2v6Z" />
                </svg>
                {saveError}
              </div>
            )}
            {saveMsg && (
              <div className="profile-form__msg profile-form__msg--success">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path d="M9 12.4 6.5 9.9 5.1 11.3l3.9 3.9 8-8L15.6 5.8z" />
                </svg>
                {saveMsg}
              </div>
            )}

            <button
              type="submit"
              className="profile-form__submit"
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="profile-spinner profile-spinner--sm" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  Lưu thay đổi
                </>
              )}
            </button>
          </form>
        </section>

        {/* Card bảo mật */}
        <section className="profile-card profile-card--security">
          <div className="profile-card__header">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <h2>Bảo mật tài khoản</h2>
          </div>
          <div className="profile-security-info">
            <div className="profile-security-row">
              <div className="profile-security-row__label">Phương thức đăng nhập</div>
              <div className="profile-security-row__value">
                {user?.app_metadata?.provider === 'google' ? (
                  <span className="profile-badge profile-badge--google">Google</span>
                ) : user?.app_metadata?.provider === 'mock' ? (
                  <span className="profile-badge">Demo</span>
                ) : (
                  <span className="profile-badge">Email &amp; Mật khẩu</span>
                )}
              </div>
            </div>
            <div className="profile-security-row">
              <div className="profile-security-row__label">ID người dùng</div>
              <div className="profile-security-row__value profile-security-row__value--mono">
                {user?.id ? user.id.slice(0, 8) + '...' : '—'}
              </div>
            </div>
            <div className="profile-security-row">
              <div className="profile-security-row__label">Ngày tạo tài khoản</div>
              <div className="profile-security-row__value">{joinedAt}</div>
            </div>
          </div>

          <button
            className="profile-signout-btn"
            type="button"
            onClick={() => auth.signOut()}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Đăng xuất
          </button>
        </section>
      </div>
    </div>
  );
}
