'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from '../../app/page.module.css';

interface Log {
  time: string;
  type: 'info' | 'success' | 'warning';
  text: string;
}

interface Lead {
  name: string;
  email: string;
  role: string;
  confidence: number;
  status: 'Verified' | 'Catch-All';
}

const MOCK_LEADS: Lead[] = [
  { name: 'Sarah Jenkins', email: 'sjenkins@target.com', role: 'Head of Growth', confidence: 99, status: 'Verified' },
  { name: 'Marcus Chen', email: 'm.chen@target.com', role: 'VP of Product', confidence: 98, status: 'Verified' },
  { name: 'Elena Rostova', email: 'elena@target.com', role: 'Marketing Director', confidence: 94, status: 'Verified' },
  { name: 'David Miller', email: 'david.miller@target.com', role: 'Sales Lead', confidence: 88, status: 'Catch-All' },
];

export default function ScraperSimulator() {
  const [urlInput, setUrlInput] = useState('https://targetcompany.com/about');
  const [isScraping, setIsScraping] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [progress, setProgress] = useState(0);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleStartSimulation = () => {
    if (isScraping) return;
    setIsScraping(true);
    setLogs([]);
    setLeads([]);
    setProgress(0);

    const simulationSteps = [
      { time: '09:41:02', type: 'info', text: 'Initializing Puppeteer cluster agent...', delay: 0 },
      { time: '09:41:03', type: 'info', text: `Target resolved: ${urlInput}`, delay: 700 },
      { time: '09:41:04', type: 'info', text: 'Bypassing basic cloudflare protection layers...', delay: 1400 },
      { time: '09:41:05', type: 'info', text: 'Page DOM model loaded. Extracting structures...', delay: 2200 },
      { time: '09:41:06', type: 'success', text: 'Found Lead: Sarah Jenkins (sjenkins@target.com) - Head of Growth', delay: 3000, leadIndex: 0 },
      { time: '09:41:07', type: 'success', text: 'Found Lead: Marcus Chen (m.chen@target.com) - VP of Product', delay: 3800, leadIndex: 1 },
      { time: '09:41:08', type: 'success', text: 'Found Lead: Elena Rostova (elena@target.com) - Marketing Director', delay: 4600, leadIndex: 2 },
      { time: '09:41:09', type: 'warning', text: 'Found Lead: David Miller (david.miller@target.com) - Catch-all status', delay: 5400, leadIndex: 3 },
      { time: '09:41:10', type: 'info', text: 'Database sync complete. Cleaned and formatted records.', delay: 6200 },
      { time: '09:41:11', type: 'success', text: 'Success! Crawl finished. Extracted 4 high-value records.', delay: 6800 },
    ];

    simulationSteps.forEach((step) => {
      setTimeout(() => {
        setLogs((prev) => [...prev, { time: step.time, type: step.type as any, text: step.text }]);
        setProgress((prev) => Math.min(prev + 10, 100));

        if (step.leadIndex !== undefined) {
          setLeads((prev) => [...prev, MOCK_LEADS[step.leadIndex!]]);
        }

        if (step.text.includes('Crawl finished')) {
          setIsScraping(false);
        }
      }, step.delay);
    });
  };

  return (
    <div className={styles.simulatorWrapper}>
      <h2 className={styles.sectionTitle}>
        Experience our extraction intelligence in <span>real-time</span>
      </h2>
      <p className={styles.sectionSub} style={{ marginBottom: '40px' }}>
        Run a simulated crawlers execution targeting any sandbox address and view how our background workers parse, filter, and verify leads instantly.
      </p>

      {/* Simulator Sandbox */}
      <div className={`glass-panel ${styles.simulatorSandbox}`}>
        {/* Input area */}
        <div className={styles.simulatorInputRow}>
          <div className={styles.inputPrefix}>HTTPS://</div>
          <input
            type="text"
            className={styles.simulatorInput}
            value={urlInput.replace('https://', '').replace('http://', '')}
            onChange={(e) => setUrlInput(e.target.value)}
            disabled={isScraping}
          />
          <button
            className={`btn-primary ${styles.simulatorBtn}`}
            onClick={handleStartSimulation}
            disabled={isScraping}
          >
            {isScraping ? 'Scraping...' : 'Test Scraper'}
          </button>
        </div>

        {/* Progress Bar */}
        {isScraping && (
          <div className={styles.progressBarWrapper}>
            <div className={styles.progressBar} style={{ width: `${progress}%` }}></div>
          </div>
        )}

        {/* Console & Table Layout */}
        <div className={styles.simulatorPanels}>
          {/* Console Output */}
          <div className={styles.simulatorConsole}>
            <div className={styles.consoleHeader}>
              <div className={styles.consoleTitle}>Worker Logs</div>
              <div className={styles.consoleStatus}>
                <span className={isScraping ? styles.pulseActive : styles.pulseIdle}></span>
                {isScraping ? 'ACTIVE THREAD' : 'IDLE'}
              </div>
            </div>
            <div className={styles.consoleLogs}>
              {logs.length === 0 ? (
                <div className={styles.consolePlaceholder}>
                  Click "Test Scraper" above to initialize target extraction logs...
                </div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className={styles.consoleLine}>
                    <span className={styles.logTime}>[{log.time}]</span>{' '}
                    <span
                      style={{
                        color:
                          log.type === 'success'
                            ? '#22c55e'
                            : log.type === 'warning'
                            ? '#eab308'
                            : '#3b82f6',
                      }}
                    >
                      {log.type.toUpperCase()}:
                    </span>{' '}
                    {log.text}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>

          {/* Results Table */}
          <div className={styles.simulatorResults}>
            <div className={styles.consoleHeader}>
              <div className={styles.consoleTitle}>Extracted Leads ({leads.length})</div>
            </div>
            <div className={styles.resultsContainer}>
              {leads.length === 0 ? (
                <div className={styles.resultsPlaceholder}>
                  Results will populate here as leads are verified...
                </div>
              ) : (
                <table className={styles.resultsTable}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead, index) => (
                      <tr key={index} className={styles.resultsRow}>
                        <td style={{ fontWeight: 600 }}>{lead.name}</td>
                        <td style={{ color: 'hsl(var(--accent-primary))' }}>{lead.email}</td>
                        <td>{lead.role}</td>
                        <td>
                          <span
                            className={`badge badge-${
                              lead.status === 'Verified' ? 'success' : 'warning'
                            }`}
                          >
                            {lead.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
