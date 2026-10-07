import React from 'react';
import { AppLayout } from './layout/AppLayout';
import { AppRoutes } from './routes';
import { AuthModalProvider } from './providers/AuthModalProvider';

export default function App() {
  return (
    <AuthModalProvider>
      <AppLayout>
        <AppRoutes />
      </AppLayout>
    </AuthModalProvider>
  );
}
