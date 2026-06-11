'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../../lib/api';
import { useRouter, usePathname } from 'next/navigation';

export interface User {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'super_admin';
  tenantId: string;
  planId: string;
  createdAt: string;
  planName?: string;
}

export interface Tenant {
  id: string;
  name: string;
  planId: string;
  status: string;
}

export interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  loading: boolean;
  login: (credentials: any) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refreshUser = async () => {
    try {
      const response = await api.get<any>('/auth/me');
      if (response.success && response.data) {
        setUser(response.data.user || response.data);
        setTenant(response.data.tenant || null);
        try {
          localStorage.setItem('leadfetcher_logged_in', 'true');
        } catch {}
      } else {
        setUser(null);
        setTenant(null);
        try {
          localStorage.removeItem('leadfetcher_logged_in');
        } catch {}
      }
    } catch (error) {
      setUser(null);
      setTenant(null);
      try {
        localStorage.removeItem('leadfetcher_logged_in');
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (credentials: any) => {
    setLoading(true);
    try {
      const response = await api.post<any>('/auth/login', credentials);
      if (response.success && response.data) {
        setUser(response.data.user);
        setTenant(response.data.tenant);
        try {
          localStorage.setItem('leadfetcher_logged_in', 'true');
        } catch {}
        router.push('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: any) => {
    setLoading(true);
    try {
      const response = await api.post<any>('/auth/register', data);
      if (response.success && response.data) {
        setUser(response.data.user);
        setTenant(response.data.tenant);
        try {
          localStorage.setItem('leadfetcher_logged_in', 'true');
        } catch {}
        router.push('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await api.post('/auth/logout');
      setUser(null);
      setTenant(null);
      try {
        localStorage.removeItem('leadfetcher_logged_in');
      } catch {}
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, tenant, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
