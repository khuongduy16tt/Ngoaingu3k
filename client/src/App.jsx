import React from 'react';
import { Analytics } from '@vercel/analytics/react';
import { AppLayout } from './layout/AppLayout';
import { AppRoutes } from './routes';

export default function App() {
  return (
    <AppLayout>
      <AppRoutes />
      <Analytics />
    </AppLayout>
  );
}
