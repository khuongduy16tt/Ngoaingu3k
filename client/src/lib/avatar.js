const AVATAR_GRADIENTS = [
  // Biến thể đậm của 3 màu brand (tokens.css) — chữ cái trắng trên avatar
  // luôn đạt ≥ 5:1, không dùng thẳng #59B3E1/#52BD87 vì chỉ 2.34:1.
  'linear-gradient(135deg, var(--brand-primary), var(--brand-primary-700))',
  'linear-gradient(135deg, var(--brand-primary), var(--avatar-blue-deep))',
  'linear-gradient(135deg, var(--avatar-blue-deep), var(--brand-primary-600))',
  'linear-gradient(135deg, var(--avatar-green-deep), var(--avatar-blue-deep))',
  'linear-gradient(135deg, var(--brand-primary-600), var(--avatar-green-deep))',
  'linear-gradient(135deg, var(--brand-primary-700), var(--avatar-blue-deep))',
  'linear-gradient(135deg, var(--avatar-green-deep), var(--brand-primary))',
];

export function getAvatarGradient(seed) {
  if (!seed) return AVATAR_GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

export function getInitials(name, email) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return '?';
}
