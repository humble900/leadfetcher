'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../components/layout/AuthContext';
import { api } from '../../../lib/api';
import { useRouter } from 'next/navigation';
import styles from './AdminSettings.module.css';

interface AdminSettings {
  paidVersionActive: boolean;
}

interface SystemStats {
  totalTenants: number;
  totalUsers: number;
  totalJobs: number;
  totalLeads: number;
  activeJobs: number;
  activeTenants: number;
}

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [settingsRes, statsRes] = await Promise.all([
        api.get<any>('/admin/settings'),
        api.get<any>('/admin/stats'),
      ]);

      if (settingsRes.success) {
        setSettings(settingsRes.data);
      }
      if (statsRes.success) {
        setStats(statsRes.data);
      }
    } catch (err: any) {
      if (err?.status === 403) {
        router.push('/');
        return;
      }
      setError(err?.message || 'Failed to load admin settings');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (user?.role !== 'super_admin') {
      router.push('/');
      return;
    }
    fetchData();
  }, [user, router, fetchData]);

  const handleTogglePaidVersion = async () => {
    if (!settings) return;

    const newValue = !settings.paidVersionActive;
    setSaving(true);
    setShowSaved(false);

    try {
      const res = await api.post<any>('/admin/settings', {
        paidVersionActive: newValue,
      });

      if (res.success) {
        setSettings({ paidVersionActive: newValue });
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 3000);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          {error}
        </div>
      </div>
    );
  }

  const isPaid = settings?.paidVersionActive ?? false;

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Admin Settings</h1>
        <p className={styles.pageSubtitle}>
          Global platform configuration — only visible to super admins
        </p>
      </div>

      {/* ─── Paid Version Toggle Card ─────────── */}
      <div className={styles.settingsCard}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>Paid Version Mode</h2>
            <p className={styles.cardDescription}>
              Toggle between Free mode (all features unlocked, no billing) and Paid mode
              (plan limits enforced, billing active). When paid mode is <strong>off</strong>,
              all users get unlimited access regardless of their subscription plan.
            </p>
          </div>
          <div className={styles.toggleContainer}>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={isPaid}
                onChange={handleTogglePaidVersion}
                disabled={saving}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>
        </div>

        {/* Status Badge */}
        <div className={styles.statusRow}>
          <div className={`${styles.statusDot} ${isPaid ? styles.statusDotPaid : styles.statusDotFree}`} />
          <span className={styles.statusLabel}>
            {isPaid ? 'Paid Mode Active' : 'Free Mode Active'}
          </span>
          <span className={styles.statusValue}>
            {isPaid
              ? 'Plan limits are enforced. Users must upgrade for more capacity.'
              : 'All features unlocked. No billing or plan restrictions.'}
          </span>
        </div>

        <div className={`${styles.saveStatus} ${showSaved ? styles.saveStatusVisible : ''}`}>
          ✓ Setting saved successfully
        </div>

        {/* Feature comparison */}
        <div className={styles.featureGrid}>
          <div className={styles.featureItem}>
            <svg className={isPaid ? styles.featureIconLocked : styles.featureIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isPaid ? <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></> : <polyline points="20 6 9 17 4 12"/>}
            </svg>
            Unlimited Crawl Jobs
          </div>
          <div className={styles.featureItem}>
            <svg className={isPaid ? styles.featureIconLocked : styles.featureIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isPaid ? <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></> : <polyline points="20 6 9 17 4 12"/>}
            </svg>
            Unlimited Lead Extraction
          </div>
          <div className={styles.featureItem}>
            <svg className={isPaid ? styles.featureIconLocked : styles.featureIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isPaid ? <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></> : <polyline points="20 6 9 17 4 12"/>}
            </svg>
            Unlimited CSV Exports
          </div>
          <div className={styles.featureItem}>
            <svg className={isPaid ? styles.featureIconLocked : styles.featureIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isPaid ? <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></> : <polyline points="20 6 9 17 4 12"/>}
            </svg>
            LLM-Powered Extraction
          </div>
        </div>

        <div className={styles.infoBox}>
          <svg className={styles.infoIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div className={styles.infoText}>
            <strong>How it works:</strong> When free mode is active, the plan-based rate limits
            and usage quotas are bypassed system-wide. All tenants can use the full feature set
            without restrictions. Toggle paid mode on when you&apos;re ready to enforce subscription
            tiers and enable billing.
          </div>
        </div>
      </div>

      {/* ─── System Stats Card ─────────────────── */}
      {stats && (
        <div className={styles.settingsCard}>
          <h2 className={styles.cardTitle}>System Overview</h2>
          <p className={styles.cardDescription} style={{ marginBottom: '20px' }}>
            Real-time statistics across the platform
          </p>
          <div className={styles.featureGrid}>
            <div className={styles.featureItem}>
              <svg className={styles.featureIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
              {stats.totalUsers} Users
            </div>
            <div className={styles.featureItem}>
              <svg className={styles.featureIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
              {stats.totalTenants} Tenants ({stats.activeTenants} active)
            </div>
            <div className={styles.featureItem}>
              <svg className={styles.featureIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              {stats.totalJobs} Jobs ({stats.activeJobs} running)
            </div>
            <div className={styles.featureItem}>
              <svg className={styles.featureIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {stats.totalLeads} Leads Extracted
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
