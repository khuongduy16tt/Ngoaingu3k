/**
 * Cuộn có tôn trọng prefers-reduced-motion.
 *
 * Khối @media (prefers-reduced-motion: reduce) trong enterprise.css đặt
 * scroll-behavior: auto cho mọi phần tử, nhưng nó KHÔNG chặn được
 * scrollIntoView({ behavior: 'smooth' }): tham số truyền thẳng trong JS thắng
 * giá trị CSS, nên người bật giảm chuyển động vẫn bị cuộn trôi.
 */
export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function scrollIntoViewRespectingMotion(element, options = {}) {
  if (!element || typeof element.scrollIntoView !== 'function') {
    return;
  }

  element.scrollIntoView({
    ...options,
    behavior: prefersReducedMotion() ? 'auto' : options.behavior || 'smooth'
  });
}
