'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import styles from './JobDetail.module.css';

interface LogMessage {
  agent: string;
  message: string;
  timestamp: string;
}

export default function JobDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  
  const [job, setJob] = useState<any>(null);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the terminal logs console to bottom
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Load initial job details
  useEffect(() => {
    async function loadJob() {
      try {
        const res = await api.get<any>(`/jobs/${id}`);
        if (res.success && res.data) {
          setJob(res.data);
          // Seed initial status log
          setLogs([{
            agent: 'orchestrator',
            message: `Loaded job status: ${res.data.status.toUpperCase()}. Target: ${res.data.targetUrl}`,
            timestamp: res.data.startedAt || res.data.createdAt,
          }]);
        } else {
          setError('Job not found.');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load job details.');
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadJob();
    }
  }, [id]);

  // Subscribe to real-time SSE stream
  useEffect(() => {
    if (!id || loading || error) return;

    // Only connect SSE for active jobs
    const activeStatuses = ['running', 'queued', 'paused'];
    if (job && !activeStatuses.includes(job.status)) return;

    // EventSource can't send custom headers, so pass the token via query param
    let streamUrl = `${api.apiUrl}/jobs/${id}/stream`;
    try {
      const token = localStorage.getItem('leadfetcher_token');
      if (token) {
        streamUrl += `?token=${encodeURIComponent(token)}`;
      }
    } catch {}

    const eventSource = new EventSource(streamUrl, {
      withCredentials: true,
    });

    eventSource.onopen = () => {
      setSseConnected(true);
      setLogs((prev) => [
        ...prev,
        {
          agent: 'orchestrator',
          message: 'Connected to worker live stream.',
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    eventSource.addEventListener('connected', (e: MessageEvent) => {
      console.log('SSE Stream connected:', e.data);
    });

    eventSource.addEventListener('progress', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setJob((prev: any) => {
          if (!prev) return null;
          return { ...prev, progress: data };
        });
      } catch (err) {
        console.error('Failed to parse progress data', err);
      }
    });

    eventSource.addEventListener('activity', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setLogs((prev) => [
          ...prev,
          {
            agent: data.agent,
            message: data.message,
            timestamp: data.timestamp || new Date().toISOString(),
          },
        ]);
        
        // If the activity says job is completed/failed/cancelled, reload the main job status
        if (
          data.message.toLowerCase().includes('completed') ||
          data.message.toLowerCase().includes('failed') ||
          data.message.toLowerCase().includes('stopping')
        ) {
          // Trigger slight delay then fetch latest status
          setTimeout(async () => {
            try {
              const res = await api.get<any>(`/jobs/${id}`);
              if (res.success && res.data) {
                setJob(res.data);
              }
            } catch (err) {
              console.error('Error reloading job state', err);
            }
          }, 1000);
        }
      } catch (err) {
        console.error('Failed to parse activity log', err);
      }
    });

    eventSource.addEventListener('done', (e: MessageEvent) => {
      // Job completed/failed — reload final state
      setSseConnected(false);
      eventSource.close();
      setTimeout(async () => {
        try {
          const res = await api.get<any>(`/jobs/${id}`);
          if (res.success && res.data) {
            setJob(res.data);
          }
        } catch (err) {
          console.error('Error reloading final job state', err);
        }
      }, 500);
    });

    eventSource.onerror = () => {
      // SSE connection lost — mark as offline but don't crash
      setSseConnected(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [id, loading, error, job?.status]);

  const handlePause = async () => {
    try {
      const res = await api.post<any>(`/jobs/${id}/pause`);
      if (res.success) {
        setJob(res.data);
        setLogs((prev) => [
          ...prev,
          {
            agent: 'orchestrator',
            message: 'Requested crawl pause...',
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to pause job.');
    }
  };

  const handleResume = async () => {
    try {
      const res = await api.post<any>(`/jobs/${id}/resume`);
      if (res.success) {
        setJob(res.data);
        setLogs((prev) => [
          ...prev,
          {
            agent: 'orchestrator',
            message: 'Requested crawl resume...',
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to resume job.');
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this crawl job? This cannot be undone.')) {
      return;
    }
    try {
      const res = await api.post<any>(`/jobs/${id}/cancel`);
      if (res.success) {
        setJob(res.data);
        setLogs((prev) => [
          ...prev,
          {
            agent: 'orchestrator',
            message: 'Crawl job cancelled by user.',
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to cancel job.');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <p style={{ color: 'hsl(var(--text-secondary))' }}>Loading live crawl dashboard...</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <h3 style={{ color: 'hsl(var(--status-error))' }}>Error</h3>
        <p style={{ marginTop: '8px' }}>{error || 'Job not found'}</p>
        <button onClick={() => router.push('/jobs')} className="btn-secondary" style={{ marginTop: '16px' }}>
          Back to Jobs List
        </button>
      </div>
    );
  }

  // Calculate progress stats
  const pagesCrawled = job.progress?.pagesCrawled ?? 0;
  const pagesFound = job.progress?.pagesFound ?? 1;
  const leadsFound = job.progress?.leadsFound ?? 0;
  const errorsCount = job.progress?.errors ?? 0;
  const percent = Math.min(Math.round((pagesCrawled / pagesFound) * 100), 100);

  const getAgentStyle = (agent: string) => {
    const norm = agent.toLowerCase();
    if (norm.includes('orchestrator')) return styles['agent-orchestrator'];
    if (norm.includes('discovery')) return styles['agent-discovery'];
    if (norm.includes('extractor')) return styles['agent-extractor'];
    if (norm.includes('validator')) return styles['agent-validator'];
    if (norm.includes('enricher') || norm.includes('enrichment')) return styles['agent-enricher'];
    return '';
  };

  const getStatusBadgeClass = (status: string) => {
    if (status === 'completed') return 'badge-success';
    if (status === 'running') return 'badge-warning';
    if (status === 'failed') return 'badge-error';
    return 'badge-info';
  };

  return (
    <div className={styles.container}>
      <div className={styles.titleRow}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 600 }}>Crawl Details</h2>
          <p className={styles.urlText}>{job.targetUrl}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className={`badge ${getStatusBadgeClass(job.status)}`}>
            {job.status}
          </span>
          <button onClick={() => router.push('/jobs')} className="btn-secondary" style={{ padding: '8px 16px' }}>
            &larr; Back to List
          </button>
        </div>
      </div>

      <div className={styles.layoutGrid}>
        {/* Left column: Summary Stats */}
        <div className={`glass-panel ${styles.card}`}>
          <h3>Crawl Progress</h3>

          <div className={styles.progressSection}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${percent}%` }}></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'hsl(var(--text-secondary))' }}>
              <span>{percent}% Crawled</span>
              <span>{pagesCrawled} / {pagesFound} Pages</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Leads Extracted</span>
              <span className={styles.statValue} style={{ color: 'hsl(var(--status-success))' }}>{leadsFound}</span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Failed Pages</span>
              <span className={styles.statValue} style={{ color: errorsCount > 0 ? 'hsl(var(--status-error))' : 'hsl(var(--text-primary))' }}>
                {errorsCount}
              </span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>LLM Extraction</span>
              <span className={styles.statValue}>{job.config?.enableLLM ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Crawl Delay</span>
              <span className={styles.statValue} style={{ textTransform: 'capitalize' }}>{job.config?.crawlDelay ?? 'normal'}</span>
            </div>
          </div>

          {/* Job Control Actions */}
          <div className={styles.controlButtons}>
            {job.status === 'running' && (
              <button onClick={handlePause} className="btn-secondary styles.controlBtn">
                Pause Crawl
              </button>
            )}
            {job.status === 'paused' && (
              <button onClick={handleResume} className="btn-primary styles.controlBtn">
                Resume Crawl
              </button>
            )}
            {(job.status === 'running' || job.status === 'paused' || job.status === 'queued') && (
              <button onClick={handleCancel} className="btn-secondary styles.controlBtn" style={{ color: 'hsl(var(--status-error))', borderColor: 'hsl(var(--status-error) / 0.2)' }}>
                Cancel Crawl Job
              </button>
            )}
            {job.status === 'completed' && (
              <button onClick={() => router.push(`/leads?jobId=${id}`)} className="btn-primary styles.controlBtn">
                Browse Extracted Leads
              </button>
            )}
          </div>
        </div>

        {/* Right column: Terminal Console */}
        <div className={`glass-panel ${styles.consoleCard}`}>
          <div className={styles.consoleHeader} style={{ padding: '0 24px', paddingTop: '20px' }}>
            <span className={styles.consoleTitle}>
              {sseConnected && <span className={styles.consolePulse}></span>}
              Agent Execution Log
            </span>
            <span style={{ fontSize: '12px', color: sseConnected ? 'hsl(var(--status-success))' : 'hsl(var(--text-muted))' }}>
              {sseConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>

          <div style={{ padding: '0 24px 24px 24px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className={styles.consoleBody}>
              {logs.map((log, index) => (
                <div key={index} className={styles.logEntry}>
                  <span className={styles.logTime}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`${styles.logAgent} ${getAgentStyle(log.agent)}`}>
                    {log.agent}
                  </span>
                  <span className={styles.logMessage}>{log.message}</span>
                </div>
              ))}
              <div ref={consoleEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
