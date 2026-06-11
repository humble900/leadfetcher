'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
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

export default function ScraperSimulator() {
  const router = useRouter();
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

  const handleStartSimulation = async () => {
    if (isScraping) return;
    setIsScraping(true);
    setLogs([]);
    setLeads([]);
    setProgress(5);

    try {
      setLogs([{
        time: new Date().toLocaleTimeString(),
        type: 'info',
        text: 'Contacting background scraping cluster agents...',
      }]);

      // Call public endpoint
      const response = await api.post<{
        success: boolean;
        domain: string;
        logs: string[];
        leads: Lead[];
      }>('/public/scrape', { targetUrl: urlInput });

      if (!response.success) {
        throw new Error('Sandbox scrape request failed.');
      }

      const logsToSimulate = response.logs;
      const leadsToSimulate = response.leads;
      let currentStep = 0;

      const runNextStep = () => {
        if (currentStep >= logsToSimulate.length) {
          setIsScraping(false);
          return;
        }

        const logText = logsToSimulate[currentStep]!;
        let logType: 'success' | 'warning' | 'info' = 'info';
        if (logText.includes('Success') || logText.includes('complete') || logText.includes('Found')) {
          logType = 'success';
        } else if (logText.includes('timed out') || logText.includes('restricted')) {
          logType = 'warning';
        }

        setLogs((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            type: logType,
            text: logText,
          },
        ]);

        const nextProgress = Math.min(
          Math.round(((currentStep + 1) / logsToSimulate.length) * 100),
          100
        );
        setProgress(nextProgress);

        // Batch populate leads based on steps to look realistic
        if (currentStep === 2) {
          setLeads(leadsToSimulate.slice(0, 5));
        } else if (currentStep === 4) {
          setLeads(leadsToSimulate.slice(0, 30));
        } else if (currentStep === 5) {
          setLeads(leadsToSimulate.slice(0, 65));
        } else if (currentStep === logsToSimulate.length - 1) {
          setLeads(leadsToSimulate);
        }

        currentStep++;
        setTimeout(runNextStep, 400); // 400ms pacing
      };

      // Delay starting steps slightly for natural timing
      setTimeout(runNextStep, 500);

    } catch (err: any) {
      setLogs((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          type: 'warning',
          text: `Scraper Error: ${err.message || 'Unable to establish sandbox proxy connection.'}`,
        },
      ]);
      setIsScraping(false);
    }
  };

  const handleExportLeads = () => {
    router.push('/register');
  };

  return (
    <div className={styles.simulatorWrapper} style={{ width: '100%' }}>
      {/* Simulator Sandbox */}
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
          {isScraping ? 'Scraping...' : 'Fetch'}
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
                Enter domain above and click "Fetch" to run sandbox extraction...
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
          <div className={styles.consoleHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className={styles.consoleTitle}>Extracted Leads ({leads.length})</div>
            {leads.length > 0 && (
              <button
                className="btn-primary"
                onClick={handleExportLeads}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  borderRadius: '4px',
                  background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                Export Leads
              </button>
            )}
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
  );
}
