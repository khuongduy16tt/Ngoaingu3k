import React from 'react';

/**
 * ⚠️  PAYWALL OVERLAY ⚠️
 * 
 * Lớp này phủ kín toàn bộ trang web cho đến khi được thanh toán.
 * 
 * Cách xóa khi được thanh toán (2 bước):
 *   1. Xóa file này: src/components/PaywallOverlay.jsx
 *   2. Trong App.jsx, xóa dòng import và dòng <PaywallOverlay />
 */
export function PaywallOverlay() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000000',
        zIndex: 2147483647, // max z-index
        pointerEvents: 'all',
      }}
    />
  );
}
