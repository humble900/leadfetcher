'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';
import { useAuth } from '../components/layout/AuthContext';
import LandingPage from '../components/landing/LandingPage';
import overviewStyles from './Overview.module.css';

export default function DashboardHome() {
  const { user, loading: authLoading, logout } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    async function fetchData() {
      try {
        const [statsRes, jobsRes, usageRes] = await Promise.all([
          api.get<any>('/leads/stats'),
          api.get<any>('/jobs?limit=5'),
          api.get<any>('/usage'),
        ]);

        if (statsRes.success) setStats(statsRes.data);
        if (jobsRes.success) setRecentJobs(jobsRes.data || jobsRes.jobs || []);
        if (usageRes.success) setUsage(usageRes.data);
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user]);

  if (authLoading || (user && loading)) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <p style={{ color: 'hsl(var(--text-secondary))', fontFamily: 'var(--font-family)' }}>Loading LeadFetcher...</p>
      </div>
    );
  }

  // Render landing page for guest users
  if (!user) {
    return <LandingPage />;
  }

  // Calculate default values if database is empty
  const totalLeads = stats?.totalLeads ?? 0;
  const verifiedRate = stats?.verifiedPercentage ?? 0;
  const activeJobsCount = recentJobs.filter((job) => job.status === 'running').length;
  const totalJobsRun = usage?.jobsMonthly?.used ?? 0;

  return (
    <>
      {/* Metrics Row */}
      <div className={overviewStyles.grid}>
        <div className={`glass-panel ${overviewStyles.card}`}>
          <div className={overviewStyles.cardHeader}>
            <span className={overviewStyles.cardTitle}>Total Leads</span>
            <span className={overviewStyles.cardIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
          </div>
          <span className={overviewStyles.cardValue}>{totalLeads}</span>
          <span className={overviewStyles.cardSubtext}>Extracted all-time</span>
        </div>

        <div className={`glass-panel ${overviewStyles.card}`}>
          <div className={overviewStyles.cardHeader}>
            <span className={overviewStyles.cardTitle}>Verification Rate</span>
            <span className={overviewStyles.cardIcon} style={{ color: 'hsl(var(--status-success))' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </span>
          </div>
          <span className={overviewStyles.cardValue}>{verifiedRate.toFixed(1)}%</span>
          <span className={overviewStyles.cardSubtext}>Verified email/phone contact rate</span>
        </div>

        <div className={`glass-panel ${overviewStyles.card}`}>
          <div className={overviewStyles.cardHeader}>
            <span className={overviewStyles.cardTitle}>Active Crawls</span>
            <span className={overviewStyles.cardIcon} style={{ color: 'hsl(var(--status-warning))' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </span>
          </div>
          <span className={overviewStyles.cardValue}>{activeJobsCount}</span>
          <span className={overviewStyles.cardSubtext}>Currently running in background</span>
        </div>

        <div className={`glass-panel ${overviewStyles.card}`}>
          <div className={overviewStyles.cardHeader}>
            <span className={overviewStyles.cardTitle}>Total Crawls</span>
            <span className={overviewStyles.cardIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </span>
          </div>
          <span className={overviewStyles.cardValue}>{totalJobsRun}</span>
          <span className={overviewStyles.cardSubtext}>Crawl jobs run this month</span>
        </div>
      </div>

      {/* Two Column Content */}
      <div className={overviewStyles.twoColumnLayout}>
        {/* Recent Jobs */}
        <div className={`glass-panel ${overviewStyles.section}`}>
          <div className={overviewStyles.sectionHeader}>
            <h2>Recent Crawl Jobs</h2>
            <Link href="/jobs" style={{ fontSize: '13px', color: 'hsl(var(--accent-primary))' }}>
              View All Jobs &rarr;
            </Link>
          </div>

          <div className={overviewStyles.activityList}>
            {recentJobs.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '40px 0', color: 'hsl(var(--text-muted))' }}>
                No crawl jobs initiated yet. Click "Start Crawling" to begin.
              </p>
            ) : (
              recentJobs.map((job) => (
                <div key={job.id} className={overviewStyles.activityItem}>
                  <div className={overviewStyles.activityDetails}>
                    <Link href={`/jobs/${job.id}`} className={overviewStyles.activityText}>
                      {job.targetUrl}
                    </Link>
                    <span className={overviewStyles.activityMeta}>
                      Pages: {job.progress?.pagesCrawled ?? 0} | Leads Found: {job.progress?.leadsFound ?? 0}
                    </span>
                  </div>
                  <div className={overviewStyles.activityStatus}>
                    <span className={`badge badge-${job.status === 'completed' ? 'success' : job.status === 'running' ? 'warning' : job.status === 'failed' ? 'error' : 'info'}`}>
                      {job.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className={`glass-panel ${overviewStyles.section}`}>
          <h2>Quick Actions</h2>
          <div className={overviewStyles.quickActions}>
            <Link href="/jobs/new" style={{ textDecoration: 'none' }}>
              <button className={overviewStyles.actionBtn}>
                <span>Configure New Scrape</span>
                <span>+</span>
              </button>
            </Link>
            
            <Link href="/leads" style={{ textDecoration: 'none' }}>
              <button className={overviewStyles.actionBtn}>
                <span>Browse Leads Table</span>
                <span>&rarr;</span>
              </button>
            </Link>

            <Link href="/usage" style={{ textDecoration: 'none' }}>
              <button className={overviewStyles.actionBtn}>
                <span>Check Limits & Quotas</span>
                <span>&rarr;</span>
              </button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

