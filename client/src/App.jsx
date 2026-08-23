import React from 'react';
import { AppLayout } from './layout/AppLayout';
import { AppRoutes } from './routes';

export default function App() {
  return (
    <AppLayout>
      <AppRoutes />
    </AppLayout>
  );
}
