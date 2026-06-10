'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../components/layout/AuthContext';
import styles from './Usage.module.css';

export default function UsagePage() {
  const { user } = useAuth();
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className={styles.container}>
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
          onClick={() => alert('Upgrades are currently managed by workspace owners. Contact admin@leadfetcher.com for customizations.')}
        >
          Upgrade Quota Plan
        </button>
      </div>

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
