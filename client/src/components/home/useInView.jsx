import React, { useEffect, useRef, useState } from 'react';

// Báo true đúng một lần khi phần tử lọt vào màn hình (threshold 0.15) rồi ngắt
// observer. Không có IntersectionObserver thì coi như đã thấy ngay — nội dung
// không bao giờ bị kẹt ở trạng thái ẩn.
export function useInView({ threshold = 0.15, rootMargin = '0px 0px -6% 0px' } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || inView) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, rootMargin, inView]);

  return [ref, inView];
}

// Theo dõi liên tục (không ngắt): dùng để tạm dừng hoạt ảnh lặp khi khối đã
// cuộn khỏi màn hình — đỡ tốn CPU/pin trên điện thoại.
export function useIsVisible(ref, { threshold = 0 } = {}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => setVisible(entries[0].isIntersecting), { threshold });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, threshold]);

  return visible;
}

// Khối hiện dần (fade-up 24px → 0). CSS quyết định trạng thái ẩn, nên khi JS
// chưa chạy hoặc lỗi thì nội dung vẫn hiện đầy đủ.
export function Reveal({ as: Tag = 'div', className = '', children, delay = 0, ...rest }) {
  const [ref, inView] = useInView();
  return (
    <Tag
      ref={ref}
      className={`hv-reveal ${inView ? 'is-in' : ''} ${className}`}
      style={delay ? { '--hv-delay': `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
