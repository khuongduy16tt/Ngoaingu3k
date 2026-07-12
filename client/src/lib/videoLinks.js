export function getGoogleDriveFileId(url) {
  const value = String(url || '').trim();
  if (!value) return '';

  const patterns = [
    /drive\.google\.com\/file\/d\/([^/]+)/i,
    /drive\.google\.com\/open\?id=([^&]+)/i,
    /drive\.google\.com\/uc\?(?:export=[^&]+&)?id=([^&]+)/i,
    /docs\.google\.com\/[^/]+\/d\/([^/]+)/i
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  try {
    const parsed = new URL(value);
    return parsed.searchParams.get('id') || '';
  } catch {
    return '';
  }
}

export function isGoogleDriveUrl(url) {
  const value = String(url || '').toLowerCase();
  return value.includes('drive.google.com') || value.includes('docs.google.com');
}

export function getEmbeddableVideoUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';

  const driveFileId = getGoogleDriveFileId(value);
  if (driveFileId) {
    return `https://drive.google.com/file/d/${driveFileId}/preview`;
  }

  if (isGoogleDriveUrl(value)) {
    return '';
  }

  return value;
}

export function getVideoSourceLabel(url) {
  const value = String(url || '').toLowerCase();
  if (value.includes('drive.google.com') || value.includes('docs.google.com')) {
    return 'Google Drive';
  }

  return value ? 'Video URL' : 'Chưa có video';
}

export function getVideoEmbedIssue(url) {
  const value = String(url || '').trim();
  if (!value) return '';

  if (isGoogleDriveUrl(value) && !getGoogleDriveFileId(value)) {
    return 'Link Google Drive cần là link file video dạng /file/d/.../view, không dùng link thư mục hoặc trang Drive.';
  }

  return '';
}

export function getVideoAccessHint(url) {
  if (!isGoogleDriveUrl(url)) return '';

  return 'Nếu khung video báo 403, hãy mở quyền file trong Google Drive: Share -> General access -> Anyone with the link -> Viewer.';
}
