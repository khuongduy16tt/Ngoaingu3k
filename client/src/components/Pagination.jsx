import React, { useEffect, useMemo, useState } from 'react';

export function usePagination(items = [], { pageSize = 8, resetKey = '' } = {}) {
  const safeItems = Array.isArray(items) ? items : [];
  const totalItems = safeItems.length;
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [pageSize, resetKey]);

  useEffect(() => {
    setPage((currentPage) => Math.min(Math.max(currentPage, 1), pageCount));
  }, [pageCount]);

  const pageItems = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return safeItems.slice(startIndex, startIndex + pageSize);
  }, [page, pageSize, safeItems]);

  const startItem = totalItems ? (page - 1) * pageSize + 1 : 0;
  const endItem = Math.min(page * pageSize, totalItems);

  return {
    endItem,
    page,
    pageCount,
    pageItems,
    pageSize,
    setPage,
    startItem,
    totalItems
  };
}

export function PaginationControls({
  endItem,
  label = 'mục',
  page,
  pageCount,
  pageSize,
  setPage,
  startItem,
  totalItems
}) {
  if (!totalItems || totalItems <= pageSize) {
    return null;
  }

  return (
    <nav className="pagination-controls" aria-label={`Phân trang ${label}`}>
      <span className="pagination-controls__summary">
        {startItem}-{endItem} / {totalItems} {label}
      </span>
      <div className="pagination-controls__actions">
        <button
          type="button"
          className="button-ghost"
          onClick={() => setPage((currentPage) => Math.max(currentPage - 1, 1))}
          disabled={page <= 1}
        >
          Trước
        </button>
        <span className="pagination-controls__page">
          Trang {page} / {pageCount}
        </span>
        <button
          type="button"
          className="button-ghost"
          onClick={() => setPage((currentPage) => Math.min(currentPage + 1, pageCount))}
          disabled={page >= pageCount}
        >
          Sau
        </button>
      </div>
    </nav>
  );
}
