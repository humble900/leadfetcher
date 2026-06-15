'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import styles from './Prospector.module.css';

interface LogMessage {
  agent: string;
  message: string;
  timestamp: string;
}

export default function ProspectorPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'single' | 'csv'>('single');
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [autoEnrich, setAutoEnrich] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // CSV State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedCompanies, setParsedCompanies] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Runs history state
  const [jobs, setJobs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Active Job Terminal Log overlay state
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<any>(null);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [sseConnected, setSseConnected] = useState(false);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll logs console
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Load prospector jobs history
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await api.get<any>('/jobs', {
        params: { page: 1, limit: 100 },
      });
      if (res.success) {
        const allJobs = res.data || res.jobs || [];
        // Filter only prospector type jobs
        const prospectorJobs = allJobs.filter((j: any) => j.config?.type === 'prospector');
        setJobs(prospectorJobs);
      }
    } catch (err) {
      console.error('Failed to load prospector jobs', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // SSE streaming listener for the active console log modal
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
        message: 'Connected to prospector worker live stream.',
        timestamp: new Date().toISOString(),
      }]);
    };

    eventSource.addEventListener('progress', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setActiveJob((prev: any) => prev ? { ...prev, progress: data } : null);
        // Also update the job in the main history list
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
          // reload history status shortly
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

  // CSV parsing logic
  const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      if (lines.length === 0) {
        setError('The CSV file appears to be empty.');
        return;
      }

      // Auto-detect company name column
      const headers = lines[0]!.split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
      let colIndex = headers.findIndex(h => h.includes('company') || h.includes('name') || h.includes('firm') || h.includes('business'));
      if (colIndex === -1) colIndex = 0; // Default to first column

      const companies: string[] = [];
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i]!.split(',');
        const name = row[colIndex]?.trim().replace(/^["']|["']$/g, '');
        if (name) companies.push(name);
      }

      if (companies.length === 0) {
        setError('Could not find any company names in the CSV. Make sure there is a header row.');
        return;
      }

      setParsedCompanies(companies);
      setSuccessMsg(`Successfully parsed ${companies.length} company names from CSV.`);
    };

    reader.onerror = () => {
      setError('Error reading CSV file.');
    };

    reader.readAsText(file);
  };

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    let targetCompanies: string[] = [];
    if (activeTab === 'single') {
      if (!companyName) {
        setError('Please enter a company name.');
        return;
      }
      targetCompanies = [companyName];
    } else {
      if (parsedCompanies.length === 0) {
        setError('Please upload and parse a valid CSV file first.');
        return;
      }
      targetCompanies = parsedCompanies;
    }

    setIsLaunching(true);

    try {
      const res = await api.post<any>('/jobs', {
        config: {
          type: 'prospector',
          companies: targetCompanies,
          autoEnrich,
          crawlDelay: 'normal',
        },
      });

      if (res.success && res.data) {
        setSuccessMsg(`Prospector job successfully launched!`);
        setCompanyName('');
        setCsvFile(null);
        setParsedCompanies([]);
        
        // Open the console logs modal immediately
        setActiveJob(res.data);
        setActiveJobId(res.data.id);
        
        fetchHistory();
      } else {
        setError(res.error || 'Failed to start prospector job');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while launching job.');
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
    if (norm.includes('prospector')) return styles['agent-prospector'];
    return '';
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 600 }}>Company Prospector</h2>
          <p style={{ color: 'hsl(var(--text-secondary))', marginTop: '4px' }}>
            Find companies' websites, social profiles, and verify key decision maker contacts.
          </p>
        </div>
      </div>

      <div className={styles.layoutGrid}>
        {/* Form panel */}
        <div className={`glass-panel ${styles.formCard}`}>
          {/* Tab switcher */}
          <div className={styles.tabRow}>
            <button
              className={`${styles.tabBtn} ${activeTab === 'single' ? styles.activeTabBtn : ''}`}
              onClick={() => {
                setActiveTab('single');
                setError(null);
                setSuccessMsg(null);
              }}
            >
              Single Search
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'csv' ? styles.activeTabBtn : ''}`}
              onClick={() => {
                setActiveTab('csv');
                setError(null);
                setSuccessMsg(null);
              }}
            >
              Bulk Import (CSV)
            </button>
          </div>

          {error && <div className={styles.errorBanner}>{error}</div>}
          {successMsg && <div className={styles.successBanner}>{successMsg}</div>}

          <form onSubmit={handleLaunch} className={styles.formGroup}>
            {activeTab === 'single' ? (
              <div>
                <label className={styles.fieldLabelRequired}>Company Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Google or Acme Corp"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={isLaunching}
                  required
                />
              </div>
            ) : (
              <div>
                <label className={styles.fieldLabelRequired}>CSV Upload</label>
                <div
                  className={styles.dropZone}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: '8px', color: 'hsl(var(--text-secondary))' }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>{csvFile ? csvFile.name : 'Click to select or drop CSV file'}</span>
                  <p style={{ fontSize: '12px', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>
                    CSV must contain a header row with a column for company name.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    style={{ display: 'none' }}
                    onChange={handleCsvChange}
                  />
                </div>
              </div>
            )}

            <div>
              <label className={styles.fieldLabel}>Target Industry (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Technology, Real Estate, Retail"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                disabled={isLaunching}
              />
            </div>

            <div className={styles.toggleContainer}>
              <div className={styles.toggleInfo}>
                <span className={styles.toggleLabel}>Auto-Enrich decision makers</span>
                <span className={styles.toggleDesc}>
                  Generates professional patterns and runs DDG verified searches automatically.
                </span>
              </div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={autoEnrich}
                  onChange={(e) => setAutoEnrich(e.target.checked)}
                  disabled={isLaunching}
                />
                <span className={styles.toggleSlider} />
              </label>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={isLaunching}>
              {isLaunching ? 'Launching...' : '🚀 Start Prospecting'}
            </button>
          </form>
        </div>

        {/* History panel */}
        <div className={`glass-panel ${styles.historyCard}`}>
          <h3 className={styles.cardTitle}>Run Executions</h3>
          <p className={styles.cardSubtitle}>List of company prospecting jobs executed under your workspace.</p>

          {loadingHistory && jobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'hsl(var(--text-muted))' }}>
              Loading job history...
            </div>
          ) : jobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'hsl(var(--text-muted))' }}>
              No prospecting runs created yet. Search a company above to start.
            </div>
          ) : (
            <div className={styles.historyList}>
              {jobs.map((job) => {
                const crawled = job.progress?.pagesCrawled ?? 0;
                const totalComp = job.progress?.pagesFound ?? 1;
                const percent = Math.min(Math.round((crawled / totalComp) * 100), 100);

                return (
                  <div key={job.id} className={styles.historyItem}>
                    <div className={styles.historyHeader}>
                      <div className={styles.historyInfo}>
                        <strong className={styles.jobUrlText} title={job.targetUrl}>
                          {job.targetUrl.startsWith('prospector://') ? 'Bulk Import Run' : 'Single Search'}
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
                          View Logs
                        </button>
                      </div>
                    </div>

                    <div className={styles.progressContainer}>
                      <div className={styles.progressBar}>
                        <div className={styles.progressFill} style={{ width: `${percent}%` }}></div>
                      </div>
                      <div className={styles.progressText}>
                        <span>{percent}% done</span>
                        <span>{crawled}/{totalComp} companies</span>
                        <span style={{ color: 'hsl(var(--accent-primary))', fontWeight: 600 }}>
                          {job.progress?.leadsStored ?? 0} leads found
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
                  Live Prospector Console
                </h4>
                <p style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', marginTop: '2px' }}>
                  Job ID: {activeJobId} | Target: {activeJob.targetUrl}
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
                Status: <strong style={{ color: 'hsl(var(--accent-primary))' }}>{activeJob.status.toUpperCase()}</strong> | Stored: <strong>{activeJob.progress?.leadsStored ?? 0} contacts</strong>
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
