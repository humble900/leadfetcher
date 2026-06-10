'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';
import { useAuth } from '../components/layout/AuthContext';
import overviewStyles from './Overview.module.css';
import landingStyles from './page.module.css';

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

function LandingPage() {
  return (
    <div className={landingStyles.landingContainer}>
      {/* Navbar */}
      <nav className={landingStyles.navbar}>
        <div className={landingStyles.navContent}>
          <div className={landingStyles.logoArea}>
            <div className={landingStyles.logoIcon}>LF</div>
            <span>LeadFetcher</span>
          </div>
          <div className={landingStyles.navLinks}>
            <a href="#features" className={landingStyles.navLink}>Features</a>
            <a href="#technology" className={landingStyles.navLink}>Technology</a>
            <a href="#pricing" className={landingStyles.navLink}>Pricing</a>
          </div>
          <div className={landingStyles.navActions}>
            <Link href="/login" className="btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>
              Sign In
            </Link>
            <Link href="/register" className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}>
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className={landingStyles.heroSection}>
        <div className={landingStyles.gradientBadge}>
          Next-Generation Lead Extraction
        </div>
        <h1 className={landingStyles.heroTitle}>
          Extract High-Value Leads from any website with <span>AI Precision</span>
        </h1>
        <p className={landingStyles.heroSub}>
          The ultimate multi-tenant platform for automated domain crawling, email verification, contact discovery, and structured data exports.
        </p>
        <div className={landingStyles.ctaGroup}>
          <Link href="/register" className="btn-primary" style={{ padding: '14px 28px', fontSize: '15px' }}>
            Start Crawling Free
          </Link>
          <Link href="/login" className="btn-secondary" style={{ padding: '14px 28px', fontSize: '15px' }}>
            View Dashboard
          </Link>
        </div>

        {/* Dashboard Mockup */}
        <div className={landingStyles.mockupContainer}>
          <div className={landingStyles.mockup}>
            <div className={landingStyles.mockupHeader}>
              <div className={landingStyles.mockupDots}>
                <div className={landingStyles.mockupDot}></div>
                <div className={landingStyles.mockupDot}></div>
                <div className={landingStyles.mockupDot}></div>
              </div>
              <div className={landingStyles.mockupTitle}>dashboard.leadfetcher.com/jobs/active</div>
              <div style={{ width: '40px' }}></div>
            </div>
            <div className={landingStyles.mockupContent}>
              <div className={landingStyles.mockupMain}>
                <div className={landingStyles.mockupHeading}>Real-Time Extraction Log</div>
                <div className={landingStyles.mockupCodeLine}><span>[09:21:40]</span> Initiating Puppeteer cluster controller...</div>
                <div className={landingStyles.mockupCodeLine}><span>[09:21:41]</span> Spawning worker thread #1 for target domain...</div>
                <div className={landingStyles.mockupCodeLine} style={{ color: '#22c55e' }}><span>[09:21:42]</span> Found email: <strong style={{ fontWeight: 600 }}>contact@domain.com</strong> (Added to DB)</div>
                <div className={landingStyles.mockupCodeLine}><span>[09:21:44]</span> Resolving repeating card structures on page 2...</div>
                <div className={landingStyles.mockupCodeLine} style={{ color: '#eab308' }}><span>[09:21:45]</span> Extracted WhatsApp: <strong style={{ fontWeight: 600 }}>+234 809 1122</strong> (Verified link)</div>
                <div className={landingStyles.mockupCodeLine}><span>[09:21:48]</span> Thread complete. Found 28 verified records.</div>
              </div>
              <div className={landingStyles.mockupSidebar}>
                <div className={landingStyles.mockupBox}>
                  <div className={landingStyles.mockupHeading}>Status</div>
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: '4px' }}>
                    <span className={landingStyles.mockupPulse}></span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#22c55e' }}>Active</span>
                  </div>
                </div>
                <div className={landingStyles.mockupBox}>
                  <div className={landingStyles.mockupHeading}>Leads Found</div>
                  <div className={landingStyles.mockupValue}>1,428</div>
                </div>
                <div className={landingStyles.mockupBox}>
                  <div className={landingStyles.mockupHeading}>Success Rate</div>
                  <div className={landingStyles.mockupValue} style={{ color: '#f97316' }}>98.4%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className={landingStyles.sectionWrapper}>
        <div className={landingStyles.sectionHeader}>
          <div className={landingStyles.sectionLabel}>Features</div>
          <h2 className={landingStyles.sectionTitle}>Everything you need to source leads</h2>
          <p className={landingStyles.sectionSub}>
            Automated intelligence built directly into the crawling pipeline to filter, clean, and enrich contacts.
          </p>
        </div>
        <div className={landingStyles.grid}>
          <div className={landingStyles.featureCard}>
            <div className={landingStyles.featureIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                <path d="M2 12h20"/>
              </svg>
            </div>
            <h3>Deep Domain Crawling</h3>
            <p>Programmatically paginate and extract deep links or listing card elements from complex target sites in record time.</p>
          </div>
          
          <div className={landingStyles.featureCard}>
            <div className={landingStyles.featureIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h3>Verified Contacts</h3>
            <p>Smart filters discover and format emails, phone numbers, and WhatsApp links, keeping bounces and bad numbers out of your CRM.</p>
          </div>

          <div className={landingStyles.featureCard}>
            <div className={landingStyles.featureIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
                <line x1="15" y1="3" x2="15" y2="21"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="3" y1="15" x2="21" y2="15"/>
              </svg>
            </div>
            <h3>Custom Columns & Export</h3>
            <p>Filter leads instantly on the unified dashboard table and select custom columns to build clean, compliant CSV downloads.</p>
          </div>
        </div>
      </section>

      {/* Technology Section */}
      <section id="technology" className={landingStyles.techWrapper}>
        <div style={{ width: '100%', maxWidth: '1200px' }}>
          <div className={landingStyles.sectionHeader}>
            <div className={landingStyles.sectionLabel}>Technology Stack</div>
            <h2 className={landingStyles.sectionTitle}>Built for speed and durability</h2>
            <p className={landingStyles.sectionSub}>
              Engineered with a high-performance distributed architecture to run crawls concurrently at scale.
            </p>
          </div>
          <div className={landingStyles.techGrid}>
            <div className={landingStyles.techCard}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
              <span className={landingStyles.techName}>Next.js 15</span>
            </div>
            <div className={landingStyles.techCard}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M16.5 9.4 7.55 4.24a1.79 1.79 0 0 0-2.5 1.55v12.42a1.79 1.79 0 0 0 2.5 1.55l8.95-5.16a1.79 1.79 0 0 0 0-3.1Z"/>
              </svg>
              <span className={landingStyles.techName}>TypeScript</span>
            </div>
            <div className={landingStyles.techCard}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                <path d="M12 6v6l4 2"/>
              </svg>
              <span className={landingStyles.techName}>BullMQ Queues</span>
            </div>
            <div className={landingStyles.techCard}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 3v18M3 12h18M12 3l9 9-9 9-9-9 9-9z"/>
              </svg>
              <span className={landingStyles.techName}>Prisma & Postgres</span>
            </div>
            <div className={landingStyles.techCard}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>
              </svg>
              <span className={landingStyles.techName}>Redis Cache</span>
            </div>
            <div className={landingStyles.techCard}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              <span className={landingStyles.techName}>Docker Containers</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className={landingStyles.sectionWrapper}>
        <div className={landingStyles.sectionHeader}>
          <div className={landingStyles.sectionLabel}>Pricing</div>
          <h2 className={landingStyles.sectionTitle}>Simple, predictable plans</h2>
          <p className={landingStyles.sectionSub}>
            Scale your scraping capacity up or down as your lead generation goals grow.
          </p>
        </div>
        <div className={landingStyles.pricingGrid}>
          {/* Free Plan */}
          <div className={landingStyles.pricingCard}>
            <div className={landingStyles.pricingPlan}>Free</div>
            <div className={landingStyles.pricingPrice}>$0<span>/mo</span></div>
            <p className={landingStyles.pricingDesc}>For exploring the platform and running minor manual extractions.</p>
            <div className={landingStyles.pricingDivider}></div>
            <ul className={landingStyles.pricingFeatures}>
              <li className={landingStyles.pricingFeature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                1 Active Workspace
              </li>
              <li className={landingStyles.pricingFeature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                100 Page crawls per month
              </li>
              <li className={landingStyles.pricingFeature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Basic Table Filter
              </li>
              <li className={landingStyles.pricingFeature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Standard CSV Export
              </li>
            </ul>
            <Link href="/register" className={`btn-secondary ${landingStyles.pricingBtn}`}>
              Get Started
            </Link>
          </div>

          {/* Pro Plan */}
          <div className={`${landingStyles.pricingCard} ${landingStyles.popularCard}`}>
            <span className={landingStyles.popularBadge}>Most Popular</span>
            <div className={landingStyles.pricingPlan}>Pro</div>
            <div className={landingStyles.pricingPrice}>$49<span>/mo</span></div>
            <p className={landingStyles.pricingDesc}>For teams and growth agencies requiring persistent crawling pipelines.</p>
            <div className={landingStyles.pricingDivider}></div>
            <ul className={landingStyles.pricingFeatures}>
              <li className={landingStyles.pricingFeature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Unlimited Workspaces
              </li>
              <li className={landingStyles.pricingFeature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                10,000 Page crawls per month
              </li>
              <li className={landingStyles.pricingFeature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Advanced Social/WA Extraction
              </li>
              <li className={landingStyles.pricingFeature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Priority Queue Processing
              </li>
              <li className={landingStyles.pricingFeature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Prisma Database Sync
              </li>
            </ul>
            <Link href="/register" className={`btn-primary ${landingStyles.pricingBtn}`}>
              Upgrade to Pro
            </Link>
          </div>

          {/* Enterprise Plan */}
          <div className={landingStyles.pricingCard}>
            <div className={landingStyles.pricingPlan}>Enterprise</div>
            <div className={landingStyles.pricingPrice}>Custom</div>
            <p className={landingStyles.pricingDesc}>For large scale operations demanding high capacity and custom scrapers.</p>
            <div className={landingStyles.pricingDivider}></div>
            <ul className={landingStyles.pricingFeatures}>
              <li className={landingStyles.pricingFeature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Custom Puppeteer Crawlers
              </li>
              <li className={landingStyles.pricingFeature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Unlimited Crawls & Bandwidth
              </li>
              <li className={landingStyles.pricingFeature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Custom Webhooks & API Access
              </li>
              <li className={landingStyles.pricingFeature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Dedicated Server Nodes
              </li>
              <li className={landingStyles.pricingFeature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Whitelabel Options
              </li>
            </ul>
            <Link href="mailto:enterprise@leadfetcher.com" className={`btn-secondary ${landingStyles.pricingBtn}`}>
              Contact Sales
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={landingStyles.footer}>
        <div className={landingStyles.footerContent}>
          <div className={landingStyles.footerCopyright}>
            &copy; {new Date().getFullYear()} LeadFetcher. All rights reserved.
          </div>
          <div className={landingStyles.footerLinks}>
            <a href="#" className={landingStyles.footerLink}>Terms of Service</a>
            <a href="#" className={landingStyles.footerLink}>Privacy Policy</a>
            <a href="#" className={landingStyles.footerLink}>Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
