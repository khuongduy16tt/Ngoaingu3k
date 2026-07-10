import { useEffect } from 'react';
import { buildPageTitle } from '../config/i18n';

/**
 * Sets document.title reactively.
 * @param {string} pageTitle — the page-specific title (e.g. "Trang chủ").
 */
export function usePageTitle(pageTitle) {
  useEffect(() => {
    document.title = buildPageTitle(pageTitle);
  }, [pageTitle]);
}
