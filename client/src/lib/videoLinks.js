export function getGoogleDriveFileId(url) {
  const value = String(url || '').trim();
  if (!value) return '';

  const patterns = [
    /drive\.google\.com\/file\/d\/([^/?#]+)/i,
    /drive\.google\.com\/open\?[^#]*\bid=([^&#]+)/i,
    /drive\.google\.com\/uc\?[^#]*\bid=([^&#]+)/i,
    /drive\.usercontent\.google\.com\/download\?[^#]*\bid=([^&#]+)/i,
    /docs\.google\.com\/[^/]+\/d\/([^/?#]+)/i
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    const isGoogleHost =
      host === 'drive.google.com' ||
      host === 'drive.usercontent.google.com' ||
      host.endsWith('.googleusercontent.com') ||
      host === 'docs.google.com';

    return isGoogleHost ? parsed.searchParams.get('id') || '' : '';
  } catch {
    return '';
  }
}

export function getGoogleDriveResourceKey(url) {
  try {
    const parsed = new URL(String(url || '').trim());
    return parsed.searchParams.get('resourcekey') || '';
  } catch {
    return '';
  }
}

export function isGoogleDriveUrl(url) {
  const value = String(url || '').toLowerCase();
  return (
    value.includes('drive.google.com') ||
    value.includes('drive.usercontent.google.com') ||
    value.includes('googleusercontent.com') ||
    value.includes('docs.google.com')
  );
}

function isGoogleDriveFolderUrl(url) {
  return /drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\//i.test(String(url || ''));
}

export function getEmbeddableVideoUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';

  const driveFileId = getGoogleDriveFileId(value);
  if (driveFileId) {
    const params = new URLSearchParams();
    const resourceKey = getGoogleDriveResourceKey(value);

    if (resourceKey) {
      params.set('resourcekey', resourceKey);
    }

    const query = params.toString();
    return `https://drive.google.com/file/d/${encodeURIComponent(driveFileId)}/preview${query ? `?${query}` : ''}`;
  }

  if (isGoogleDriveUrl(value)) {
    return '';
  }

  return value;
}

export function getVideoSourceLabel(url) {
  const value = String(url || '').toLowerCase();
  if (isGoogleDriveUrl(value)) {
    return 'Google Drive';
  }

  return value ? 'Video URL' : 'Chưa có video';
}

export function getVideoEmbedIssue(url) {
  const value = String(url || '').trim();
  if (!value) return '';

  if (isGoogleDriveFolderUrl(value)) {
    return 'Bạn đang dán link thư mục Google Drive. Hãy mở đúng file video rồi copy link Share của file.';
  }

  if (isGoogleDriveUrl(value) && !getGoogleDriveFileId(value)) {
    return 'Link Google Drive cần là link file video dạng /file/d/.../view, /open?id=... hoặc /uc?id=..., không dùng link thư mục.';
  }

  return '';
}

export function getVideoAccessHint(url) {
  if (!isGoogleDriveUrl(url)) return '';

  return 'Nếu khung video báo 403, hãy mở quyền file trong Google Drive: Share -> General access -> Anyone with the link -> Viewer.';
}
