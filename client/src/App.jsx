import React from 'react';
import { AppLayout } from './layout/AppLayout';
import { AppRoutes } from './routes';

// ============================================================
// XÓA DÒNG NÀY KHI ĐƯỢC THANH TOÁN:
import { PaywallOverlay } from './components/PaywallOverlay';
// ============================================================

export default function App() {
  return (
    <AppLayout>
      <AppRoutes />
      {/* XÓA DÒNG NÀY KHI ĐƯỢC THANH TOÁN: */}
      <PaywallOverlay />
    </AppLayout>
  );
}
