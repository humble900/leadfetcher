'use client';

import React from 'react';
import { AuthProvider } from '../components/layout/AuthContext';
import AuthGuard from '../components/layout/AuthGuard';
import DashboardLayout from '../components/layout/DashboardLayout';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuard>
        <DashboardLayout>
          {children}
        </DashboardLayout>
      </AuthGuard>
    </AuthProvider>
  );
}
