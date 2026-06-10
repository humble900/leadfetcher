'use client';

import React from 'react';
import { useAuth } from './AuthContext';
import { usePathname } from 'next/navigation';
import styles from './Header.module.css';

export default function Header() {
  const { user, tenant } = useAuth();
  const pathname = usePathname();

  const getPageTitle = () => {
    if (pathname === '/') return 'Dashboard Overview';
    if (pathname.startsWith('/jobs')) {
      if (pathname.includes('/new')) return 'Create Crawl Job';
      return 'Crawl Jobs';
    }
    if (pathname.startsWith('/leads')) return 'Extracted Leads';
    if (pathname.startsWith('/usage')) return 'Quotas & Usage';
    if (pathname.startsWith('/admin')) return 'Admin Settings';
    return 'LeadFetcher';
  };

  const getInitials = (email: string) => {
    return email ? email.substring(0, 2).toUpperCase() : 'US';
  };

  return (
    <header className={styles.header}>
      <div className={styles.titleContainer}>
        <h1 className={styles.pageTitle}>{getPageTitle()}</h1>
        {tenant && <span className={styles.tenantInfo}>Workspace: {tenant.name}</span>}
      </div>

      <div className={styles.userPanel}>
        {user && <span className={styles.planBadge}>{user.planName || 'Free'} plan</span>}
        
        {user && (
          <>
            <div className={styles.userInfo}>
              <span className={styles.userEmail}>{user.email}</span>
              <span className={styles.userRole}>{user.role}</span>
            </div>
            <div className={styles.userAvatar}>
              {getInitials(user.email)}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
