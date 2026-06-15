'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import styles from './GoogleMaps.module.css';

interface LogMessage {
  agent: string;
  message: string;
  timestamp: string;
}

export default function GoogleMapsScraperPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'search' | 'url'>('search');
  
  // Search Form State
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  
  // URL Form State
  const [directUrl, setDirectUrl] = useState('');
  
  // General settings
  const [limit, setLimit] = useState(30);
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Runs history state
  const [jobs, setJobs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Active Job Terminal Log modal state
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<any>(null);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [sseConnected, setSseConnected] = useState(false);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs terminal
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Fetch past google maps jobs
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await api.get<any>('/jobs', {
        params: { page: 1, limit: 100 },
      });
      if (res.success) {
        const allJobs = res.data || res.jobs || [];
        const mapJobs = allJobs.filter((j: any) => j.config?.type === 'google_maps');
        setJobs(mapJobs);
      }
    } catch (err) {
      console.error('Failed to load Google Maps jobs', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Subscribe to live activity logs stream
  useEffect(() => {
    if (!activeJobId) return;

    const streamUrl = `${api.apiUrl}/jobs/${activeJobId}/stream`;
    const eventSource = new EventSource(streamUrl, {
      withCredentials: true,
    });

    eventSource.onopen = () => {
      setSseConnected(true);
      setLogs([{
        agent: 'orchestrator',
        message: 'Connected to Google Maps scraper worker live stream.',
        timestamp: new Date().toISOString(),
      }]);
    };

    eventSource.addEventListener('progress', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setActiveJob((prev: any) => prev ? { ...prev, progress: data } : null);
        setJobs((prevJobs) => prevJobs.map((j) => j.id === activeJobId ? { ...j, progress: data } : j));
      } catch (err) {
        console.error(err);
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

        if (
          data.message.toLowerCase().includes('complete') ||
          data.message.toLowerCase().includes('failed') ||
          data.message.toLowerCase().includes('stopping')
        ) {
          setTimeout(async () => {
            fetchHistory();
            const res = await api.get<any>(`/jobs/${activeJobId}`);
            if (res.success && res.data) {
              setActiveJob(res.data);
            }
          }, 1000);
        }
      } catch (err) {
        console.error(err);
      }
    });

    eventSource.onerror = () => {
      setSseConnected(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [activeJobId, fetchHistory]);

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    let targetUrl = '';
    if (activeTab === 'search') {
      if (!query || !location) {
        setError('Please provide a search term and a location.');
        return;
      }
      targetUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}+in+${encodeURIComponent(location)}`;
    } else {
      if (!directUrl || !directUrl.startsWith('http')) {
        setError('Please enter a valid Google Maps search or place URL.');
        return;
      }
      targetUrl = directUrl;
    }

    setIsLaunching(true);

    try {
      const res = await api.post<any>('/jobs', {
        targetUrl,
        config: {
          type: 'google_maps',
          maxPages: limit,
          crawlDelay: 'normal',
          searchQuery: activeTab === 'search' ? query : undefined,
          searchLocation: activeTab === 'search' ? location : undefined,
        },
      });

      if (res.success && res.data) {
        setSuccessMsg(`Google Maps scraper job launched!`);
        setQuery('');
        setLocation('');
        setDirectUrl('');
        
        // Open the logs modal
        setActiveJob(res.data);
        setActiveJobId(res.data.id);
        
        fetchHistory();
      } else {
        setError(res.error || 'Failed to start Google Maps scraper job.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while launching the job.');
    } finally {
      setIsLaunching(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    if (status === 'completed') return 'badge-success';
    if (status === 'running') return 'badge-warning';
    if (status === 'failed') return 'badge-error';
    return 'badge-info';
  };

  const getAgentStyle = (agent: string) => {
    const norm = agent.toLowerCase();
    if (norm.includes('orchestrator')) return styles['agent-orchestrator'];
    if (norm.includes('google_maps')) return styles['agent-google_maps'];
    return '';
  };

  const getCleanLabel = (url: string, job?: any) => {
    // Use structured config fields if available
    if (job?.config?.searchQuery && job?.config?.searchLocation) {
      return `${job.config.searchQuery} in ${job.config.searchLocation}`;
    }
    if (job?.config?.searchQuery) {
      return job.config.searchQuery;
    }
    if (url.startsWith('https://www.google.com/maps/search/')) {
      const parts = url.replace('https://www.google.com/maps/search/', '').split('?')[0];
      return decodeURIComponent(parts || '').replace(/\+/g, ' ');
    }
    return url;
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 600 }}>Google Maps Scraper</h2>
          <p style={{ color: 'hsl(var(--text-secondary))', marginTop: '4px' }}>
            Extract business addresses, websites, phone numbers, and categories directly from Google Maps lists and search queries.
          </p>
        </div>
      </div>

      <div className={styles.layoutGrid}>
        {/* Input Form Panel */}
        <div className={`glass-panel ${styles.formCard}`}>
          {/* Tab switcher */}
          <div className={styles.tabRow}>
            <button
              className={`${styles.tabBtn} ${activeTab === 'search' ? styles.activeTabBtn : ''}`}
              onClick={() => {
                setActiveTab('search');
                setError(null);
                setSuccessMsg(null);
              }}
            >
              Search & Geolocation
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'url' ? styles.activeTabBtn : ''}`}
              onClick={() => {
                setActiveTab('url');
                setError(null);
                setSuccessMsg(null);
              }}
            >
              Direct Maps URL
            </button>
          </div>

          {error && <div className={styles.errorBanner}>{error}</div>}
          {successMsg && <div className={styles.successBanner}>{successMsg}</div>}

          <form onSubmit={handleLaunch} className={styles.formGroup}>
            {activeTab === 'search' ? (
              <>
                <div>
                  <label className={styles.fieldLabelRequired}>Search Query</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Restaurants, Dentists, Hotels"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    disabled={isLaunching}
                    required
                  />
                </div>
                <div>
                  <label className={styles.fieldLabelRequired}>Location / Geolocation</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Staten Island NY, Berlin, Cambridge"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    disabled={isLaunching}
                    required
                  />
                </div>
              </>
            ) : (
              <div>
                <label className={styles.fieldLabelRequired}>Google Maps Search or Place URL</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://www.google.com/maps/search/..."
                  value={directUrl}
                  onChange={(e) => setDirectUrl(e.target.value)}
                  disabled={isLaunching}
                  required
                />
              </div>
            )}

            <div>
              <div className={styles.sliderHeader}>
                <label className={styles.fieldLabel}>Maximum Places to Scrape</label>
                <span className={styles.sliderVal}>{limit} places</span>
              </div>
              <input
                type="range"
                min="5"
                max="120"
                step="5"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                style={{ width: '100%' }}
                disabled={isLaunching}
              />
              <p className={styles.infoHint}>
                Capped at 120 results per search due to Google Maps scroll bounds. Website contacts will automatically be crawled for email discovery!
              </p>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={isLaunching}>
              {isLaunching ? 'Launching Scraper...' : '📍 Start Maps Scraping'}
            </button>
          </form>
        </div>

        {/* History / Runs Panel */}
        <div className={`glass-panel ${styles.historyCard}`}>
          <h3 className={styles.cardTitle}>Maps Scraper Executions</h3>
          <p className={styles.cardSubtitle}>Track your active and completed Google Maps crawler runs.</p>

          {loadingHistory && jobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'hsl(var(--text-muted))' }}>
              Loading job history...
            </div>
          ) : jobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'hsl(var(--text-muted))' }}>
              No Google Maps crawler jobs found. Enter details above to run your first scrape.
            </div>
          ) : (
            <div className={styles.historyList}>
              {jobs.map((job) => {
                const crawled = job.progress?.pagesCrawled ?? 0;
                const totalComp = job.progress?.pagesFound ?? limit;
                const percent = Math.min(Math.round((crawled / Math.max(totalComp, 1)) * 100), 100);

                return (
                  <div key={job.id} className={styles.historyItem}>
                    <div className={styles.historyHeader}>
                      <div className={styles.historyInfo}>
                        <strong className={styles.jobUrlText} title={job.targetUrl}>
                          {getCleanLabel(job.targetUrl, job)}
                        </strong>
                        <span className={styles.jobDate}>
                          {new Date(job.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className={`badge ${getStatusBadgeClass(job.status)}`}>
                          {job.status}
                        </span>
                        <button
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                          onClick={() => {
                            setActiveJob(job);
                            setActiveJobId(job.id);
                          }}
                        >
                          Logs
                        </button>
                      </div>
                    </div>

                    <div className={styles.progressContainer}>
                      <div className={styles.progressBar}>
                        <div className={styles.progressFill} style={{ width: `${percent}%` }}></div>
                      </div>
                      <div className={styles.progressText}>
                        <span>{percent}% done</span>
                        <span>{crawled}/{totalComp} businesses extracted</span>
                        <span style={{ color: 'hsl(var(--accent-primary))', fontWeight: 600 }}>
                          {job.progress?.leadsStored ?? 0} leads stored
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Terminal Live Logs Modal */}
      {activeJobId && activeJob && (
        <div className={styles.modalOverlay} onClick={() => setActiveJobId(null)}>
          <div className={styles.consoleModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.consoleHeader}>
              <div>
                <h4 className={styles.consoleTitle}>
                  {sseConnected && <span className={styles.consolePulse}></span>}
                  Live Maps Scraper Console
                </h4>
                <p style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', marginTop: '2px' }}>
                  Job ID: {activeJobId} | Query: {getCleanLabel(activeJob.targetUrl, activeJob)}
                </p>
              </div>
              <button className={styles.closeBtn} onClick={() => setActiveJobId(null)}>&times;</button>
            </div>

            <div className={styles.consoleBody}>
              {logs.length === 0 ? (
                <div style={{ color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>
                  Awaiting worker connection...
                </div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className={styles.logEntry}>
                    <span className={styles.logTime}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`${styles.logAgent} ${getAgentStyle(log.agent)}`}>
                      {log.agent}
                    </span>
                    <span className={styles.logMessage}>{log.message}</span>
                  </div>
                ))
              )}
              <div ref={consoleEndRef} />
            </div>

            <div className={styles.consoleFooter}>
              <div style={{ fontSize: '13px', color: 'hsl(var(--text-secondary))' }}>
                Status: <strong style={{ color: 'hsl(var(--accent-primary))' }}>{activeJob.status.toUpperCase()}</strong> | Stored: <strong>{activeJob.progress?.leadsStored ?? 0} leads</strong>
              </div>
              {activeJob.status === 'completed' && (
                <button
                  className="btn-primary"
                  onClick={() => {
                    setActiveJobId(null);
                    router.push(`/leads?jobId=${activeJob.id}`);
                  }}
                >
                  Browse Extracted Leads
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
