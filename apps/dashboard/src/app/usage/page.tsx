'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../components/layout/AuthContext';
import { useRouter } from 'next/navigation';
import UpgradePrompt from '../../components/shared/UpgradePrompt';
import styles from './Usage.module.css';

export default function UsagePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [upgradePrompt, setUpgradePrompt] = useState<{ name: string; used: number; limit: number } | null>(null);

  useEffect(() => {
    async function loadUsage() {
      try {
        const res = await api.get<any>('/usage');
        if (res.success) {
          setUsage(res.data);
        }
      } catch (err) {
        console.error('Failed to load usage limits', err);
      } finally {
        setLoading(false);
      }
    }
    loadUsage();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <p style={{ color: 'hsl(var(--text-secondary))' }}>Loading plan quotas and usage data...</p>
      </div>
    );
  }

  // Fallback defaults
  const limits = usage || {
    leadsMonthly: { used: 0, limit: 1000, percentage: 0 },
    jobsMonthly: { used: 0, limit: 50, percentage: 0 },
    exportsMonthly: { used: 0, limit: 20, percentage: 0 },
    concurrentJobs: { used: 0, limit: 3, percentage: 0 },
    llmTokensMonthly: { used: 0, limit: 50000, percentage: 0 },
  };

  const getFillColorClass = (percentage: number) => {
    if (percentage >= 90) return styles['barFill-danger'];
    if (percentage >= 75) return styles['barFill-warning'];
    return styles['barFill-normal'];
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  // Check if any metric is at 100%
  const maxedMetrics = [
    { name: 'Leads Extracted', ...limits.leadsMonthly },
    { name: 'Crawl Jobs', ...limits.jobsMonthly },
    { name: 'CSV Exports', ...limits.exportsMonthly },
    { name: 'LLM Tokens', ...limits.llmTokensMonthly },
  ].filter(m => m.percentage >= 100);

  return (
    <div className={styles.container}>
      {upgradePrompt && (
        <UpgradePrompt
          limitName={upgradePrompt.name}
          used={upgradePrompt.used}
          limit={upgradePrompt.limit}
          onClose={() => setUpgradePrompt(null)}
          userEmail={user?.email}
        />
      )}

      {/* Current plan card */}
      <div className={styles.planCard}>
        <div className={styles.planDetails}>
          <span className={styles.planSubtitle}>Current Workspace Plan</span>
          <h2 className={styles.planTitle}>
            {user?.role === 'super_admin' ? 'Enterprise Super Admin' : `${user?.planId?.toUpperCase() || 'FREE'} Plan`}
          </h2>
          <span className={styles.planSubtitle}>
            Your quota cycles reset at the beginning of each calendar month.
          </span>
        </div>
        <button
          className={styles.upgradeBtn}
          onClick={() => router.push('/settings')}
        >
          Upgrade Quota Plan
        </button>
      </div>

      {/* Maxed metrics warning */}
      {maxedMetrics.length > 0 && (
        <div
          style={{
            background: 'hsla(0 80% 60% / 0.08)',
            border: '1px solid hsla(0 80% 60% / 0.2)',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}
          onClick={() => setUpgradePrompt({ name: maxedMetrics[0].name, used: maxedMetrics[0].used, limit: maxedMetrics[0].limit })}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="hsl(0 80% 60%)" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span style={{ color: 'hsl(0 80% 60%)', fontWeight: 600, fontSize: '14px' }}>
              {maxedMetrics.length} quota{maxedMetrics.length > 1 ? 's' : ''} reached 100% — click to upgrade
            </span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="hsl(0 80% 60%)" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      )}

      <h3 style={{ fontSize: '20px', fontWeight: 600 }}>Month-to-Date Usage Metrics</h3>

      <div className={styles.grid}>
        {/* Leads limits */}
        <div className={`glass-panel ${styles.metricCard}`}>
          <div className={styles.metricHeader}>
            <span className={styles.metricTitle}>Leads Extracted</span>
            <span className={styles.metricValue}>
              {formatNumber(limits.leadsMonthly.used)} / {formatNumber(limits.leadsMonthly.limit)}
            </span>
          </div>
          <div className={styles.barContainer}>
            <div className={styles.barTrack}>
              <div
                className={`${styles.barFill} ${getFillColorClass(limits.leadsMonthly.percentage)}`}
                style={{ width: `${Math.min(limits.leadsMonthly.percentage, 100)}%` }}
              ></div>
            </div>
            <span className={styles.metricPercentage}>
              {limits.leadsMonthly.percentage.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Crawl jobs limits */}
        <div className={`glass-panel ${styles.metricCard}`}>
          <div className={styles.metricHeader}>
            <span className={styles.metricTitle}>Crawl Jobs Run</span>
            <span className={styles.metricValue}>
              {limits.jobsMonthly.used} / {limits.jobsMonthly.limit}
            </span>
          </div>
          <div className={styles.barContainer}>
            <div className={styles.barTrack}>
              <div
                className={`${styles.barFill} ${getFillColorClass(limits.jobsMonthly.percentage)}`}
                style={{ width: `${Math.min(limits.jobsMonthly.percentage, 100)}%` }}
              ></div>
            </div>
            <span className={styles.metricPercentage}>
              {limits.jobsMonthly.percentage.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* LLM Tokens usage */}
        <div className={`glass-panel ${styles.metricCard}`}>
          <div className={styles.metricHeader}>
            <span className={styles.metricTitle}>Gemini LLM Tokens Consumed</span>
            <span className={styles.metricValue}>
              {formatNumber(limits.llmTokensMonthly.used)} / {formatNumber(limits.llmTokensMonthly.limit)}
            </span>
          </div>
          <div className={styles.barContainer}>
            <div className={styles.barTrack}>
              <div
                className={`${styles.barFill} ${getFillColorClass(limits.llmTokensMonthly.percentage)}`}
                style={{ width: `${Math.min(limits.llmTokensMonthly.percentage, 100)}%` }}
              ></div>
            </div>
            <span className={styles.metricPercentage}>
              {limits.llmTokensMonthly.percentage.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Concurrent jobs running */}
        <div className={`glass-panel ${styles.metricCard}`}>
          <div className={styles.metricHeader}>
            <span className={styles.metricTitle}>Concurrent Crawl Jobs</span>
            <span className={styles.metricValue}>
              {limits.concurrentJobs.used} / {limits.concurrentJobs.limit} active
            </span>
          </div>
          <div className={styles.barContainer}>
            <div className={styles.barTrack}>
              <div
                className={`${styles.barFill} ${getFillColorClass(limits.concurrentJobs.percentage)}`}
                style={{ width: `${Math.min(limits.concurrentJobs.percentage, 100)}%` }}
              ></div>
            </div>
            <span className={styles.metricPercentage}>
              {limits.concurrentJobs.percentage.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* CSV Exports limits */}
        <div className={`glass-panel ${styles.metricCard}`}>
          <div className={styles.metricHeader}>
            <span className={styles.metricTitle}>CSV Data Exports</span>
            <span className={styles.metricValue}>
              {limits.exportsMonthly.used} / {limits.exportsMonthly.limit}
            </span>
          </div>
          <div className={styles.barContainer}>
            <div className={styles.barTrack}>
              <div
                className={`${styles.barFill} ${getFillColorClass(limits.exportsMonthly.percentage)}`}
                style={{ width: `${Math.min(limits.exportsMonthly.percentage, 100)}%` }}
              ></div>
            </div>
            <span className={styles.metricPercentage}>
              {limits.exportsMonthly.percentage.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
