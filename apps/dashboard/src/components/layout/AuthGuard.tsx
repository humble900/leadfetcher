'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { useRouter, usePathname } from 'next/navigation';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  const isPublicPath = pathname === '/' || pathname === '/login' || pathname === '/register';
  const isAuthPage = pathname === '/login' || pathname === '/register';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && !user && !isPublicPath) {
      router.replace('/login');
    } else if (!loading && user && isAuthPage) {
      router.replace('/');
    }
  }, [user, loading, isPublicPath, isAuthPage, router]);

  // On the server and during first client render, always render children for public paths
  // This prevents hydration mismatch
  if (!mounted) {
    if (isPublicPath) {
      return <>{children}</>;
    }
    // For private routes before mount, render nothing to avoid flash
    return null;
  }

  // After mount, we can safely check loading state
  if (loading && !isPublicPath) {
    return (
      <div style={styles.loadingContainer} suppressHydrationWarning>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Verifying session...</p>
      </div>
    );
  }

  // Prevent flash of private content if not logged in
  if (!user && !isPublicPath) {
    return null;
  }

  return <>{children}</>;
}

const styles = {
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    backgroundColor: '#0a0a0c',
    color: '#f4f4f5',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '4px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '50%',
    borderTopColor: '#f97316',
    animation: 'spin 1s linear infinite',
    marginBottom: '16px',
  },
  loadingText: {
    fontSize: '15px',
    fontWeight: 500,
    color: '#a1a1aa',
    letterSpacing: '0.025em',
  },
};

// Inject spinner keyframe animation
if (typeof document !== 'undefined') {
  const existing = document.getElementById('auth-guard-styles');
  if (!existing) {
    const styleEl = document.createElement('style');
    styleEl.id = 'auth-guard-styles';
    styleEl.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(styleEl);
  }
}
