import React, { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

// Điều hướng theo mục cho các bảng điều khiển. Trước đây bảng quản trị đổ toàn
// bộ panel ra một trang cuộn dọc, không có cách nào nhảy thẳng tới phần cần làm
// và cũng không gửi link cho người khác được.

const SECTION_PARAM = 'muc';

/**
 * Mục đang mở được giữ trong query string (?muc=...) chứ không phải useState:
 * nhờ vậy nút back của trình duyệt hoạt động đúng, F5 không mất chỗ đang xem và
 * admin gửi được link thẳng tới đúng mục cho đồng nghiệp.
 */
export function useDashboardSection(sections, { param = SECTION_PARAM } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionIds = useMemo(() => sections.map((section) => section.id), [sections]);
  const requestedId = searchParams.get(param) || '';
  const activeId = sectionIds.includes(requestedId) ? requestedId : sectionIds[0] || '';

  const setActiveId = useCallback(
    (nextId) => {
      if (!sectionIds.includes(nextId)) {
        return;
      }

      const nextParams = new URLSearchParams(searchParams);
      nextParams.set(param, nextId);
      // replace: false để mỗi lần đổi mục là một mốc trong lịch sử, back quay về
      // đúng mục vừa xem thay vì rời hẳn bảng điều khiển.
      setSearchParams(nextParams);
    },
    [param, searchParams, sectionIds, setSearchParams]
  );

  return { activeId, setActiveId };
}

export function DashboardSectionNav({ sections, activeId, onSelect, label = 'Mục bảng điều khiển' }) {
  return (
    <nav className="dashboard-section-nav" aria-label={label}>
      {sections.map((section) => {
        const isActive = section.id === activeId;

        return (
          <button
            key={section.id}
            type="button"
            className={`dashboard-section-nav__item ${isActive ? 'is-active' : ''}`}
            onClick={() => onSelect(section.id)}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="dashboard-section-nav__label">{section.label}</span>
            {/* Chỉ gắn số cho việc đang chờ xử lý (duyệt thanh toán), không gắn
                cho mọi mục — dán số khắp nơi thì không còn chỗ nào nổi bật. */}
            {section.badge ? <span className="dashboard-section-nav__badge">{section.badge}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}
