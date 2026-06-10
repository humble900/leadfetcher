'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import styles from './Jobs.module.css';

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async (pageNumber = 1) => {
    setLoading(true);
    try {
      const res = await api.get<any>('/jobs', {
        params: { page: pageNumber, limit: pagination.limit },
      });

      if (res.success) {
        setJobs(res.data || res.jobs || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      }
    } catch (err) {
      console.error('Failed to load crawl jobs', err);
    } finally {
      setLoading(false);
    }
  }, [pagination.limit]);

  useEffect(() => {
    fetchJobs(pagination.page);
  }, [pagination.page, fetchJobs]);

  const getStatusBadgeClass = (status: string) => {
    if (status === 'completed') return 'badge-success';
    if (status === 'running') return 'badge-warning';
    if (status === 'failed') return 'badge-error';
    return 'badge-info';
  };

  const getProgressPercent = (job: any) => {
    if (job.status === 'completed') return 100;
    const progress = job.progress || {};
    const crawled = progress.pagesCrawled || 0;
    const found = progress.pagesFound || 1;
    return Math.min(Math.round((crawled / found) * 100), 100);
  };

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString();
    } catch {
      return dateStr;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 600 }}>Crawl Jobs</h2>
          <p style={{ color: 'hsl(var(--text-secondary))', marginTop: '4px' }}>
            Monitor and manage your active and past lead extraction crawl runs.
          </p>
        </div>
        <Link href="/jobs/new" style={{ textDecoration: 'none' }}>
          <button className="btn-primary">New Scrape Config</button>
        </Link>
      </div>

      <div className={`glass-panel ${styles.tableCard}`}>
        {loading && jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'hsl(var(--text-secondary))' }}>
            Loading crawl jobs...
          </div>
        ) : jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'hsl(var(--text-muted))' }}>
            No crawl jobs launched yet. Configure a new job to start extracting leads.
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Target URL</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Leads Found</th>
                <th>Created At</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const percent = getProgressPercent(job);
                return (
                  <tr
                    key={job.id}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.closest('button') || target.closest('a')) return;
                      if (job.status === 'completed') {
                        router.push(`/leads?jobId=${job.id}`);
                      } else {
                        router.push(`/jobs/${job.id}`);
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className={styles.urlCell} title={job.targetUrl}>
                      {job.targetUrl}
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(job.status)}`}>
                        {job.status}
                      </span>
                    </td>
                    <td>
                      <div className={styles.progressContainer}>
                        <div className={styles.progressBar}>
                          <div className={styles.progressFill} style={{ width: `${percent}%` }}></div>
                        </div>
                        <div className={styles.progressLabel}>
                          <span>{percent}%</span>
                          <span>
                            {(job.progress?.pagesCrawled ?? 0)}/{(job.progress?.pagesFound ?? 0)} pages
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge" style={{
                        backgroundColor: 'rgba(249, 115, 22, 0.1)',
                        color: 'hsl(var(--accent-primary))',
                        border: '1px solid rgba(249, 115, 22, 0.2)',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        display: 'inline-block'
                      }}>
                        {job.progress?.leadsFound ?? 0} leads
                      </span>
                    </td>
                    <td>{formatTime(job.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {job.status !== 'completed' ? (
                          <Link href={`/jobs/${job.id}`} style={{ textDecoration: 'none' }}>
                            <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12.5px' }}>
                              View Feed
                            </button>
                          </Link>
                        ) : (
                          <Link href={`/leads?jobId=${job.id}`} style={{ textDecoration: 'none' }}>
                            <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '12.5px' }}>
                              View Leads
                            </button>
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {pagination.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '12px' }}>
          <button
            className="btn-secondary"
            disabled={pagination.page <= 1 || loading}
            onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
          >
            Previous
          </button>
          <span style={{ alignSelf: 'center', color: 'hsl(var(--text-secondary))', fontSize: '14px' }}>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            className="btn-secondary"
            disabled={pagination.page >= pagination.totalPages || loading}
            onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
