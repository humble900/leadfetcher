'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import ThreePlexus from './ThreePlexus';
import { CrawlerSvg, VerifiedSvg, ExporterSvg } from './AnimatedSvg';
import ScraperSimulator from './ScraperSimulator';
import styles from '../../app/page.module.css';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: 'How does the email verification engine work?',
    answer: 'LeadFetcher executes a multi-step verification process on every extracted email. First, it performs Zod-based syntax checks. Second, it executes MX record lookups to ensure the domain accepts email. Finally, it initiates an SMTP handshake (without sending a mail) to verify if the mailbox physically exists, filtering out bounces and catch-alls.',
  },
  {
    question: 'Can I configure custom extraction rules?',
    answer: 'Yes! LeadFetcher supports three scraping modes. Standard Mode scans the page source for emails and phone numbers. Regex Mode matches custom text patterns you specify. AI Extraction Mode utilizes advanced language models to read the page content organically, extracting fields like roles, team sizes, and social profiles.',
  },
  {
    question: 'Is the platform GDPR compliant?',
    answer: 'Absolutely. LeadFetcher only extracts publicly available business contact information from websites you direct it to. We do not maintain a pre-scraped database or purchase list brokers. You own and control the scrapers, making it compliant with local outreach regulations.',
  },
  {
    question: 'What happens when a crawl job runs in the background?',
    answer: 'When you launch a crawl, it gets enqueued into our BullMQ queue. A distributed worker thread picks up the job, spawns a headless Puppeteer browser container, and crawls the domain concurrently. You can watch execution logs update in real-time on your dashboard.',
  },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  // Mouse follower glow animation
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!glowRef.current) return;
      glowRef.current.style.transform = `translate3d(${e.clientX - 200}px, ${e.clientY - 200}px, 0)`;
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // GSAP Animations
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Fade-in animation for hero items
    gsap.fromTo(
      '.hero-reveal',
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, duration: 1.2, stagger: 0.15, ease: 'power3.out' }
    );

    // Mockup 3D tilt scroll animation
    gsap.fromTo(
      '.mockup-tilt',
      { transform: 'rotateX(12deg) rotateY(-3deg) scale(0.95)' },
      {
        transform: 'rotateX(0deg) rotateY(0deg) scale(1)',
        scrollTrigger: {
          trigger: '.mockup-trigger',
          start: 'top bottom',
          end: 'bottom center',
          scrub: 1.2,
        },
      }
    );

    // Stagger reveal for feature cards
    gsap.fromTo(
      '.feature-card-reveal',
      { y: 60, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        stagger: 0.2,
        scrollTrigger: {
          trigger: '.features-trigger',
          start: 'top 85%',
          toggleActions: 'play none none reverse',
        },
      }
    );

    // Draw scroll-line for step process
    gsap.fromTo(
      '.flow-line-draw',
      { strokeDashoffset: 600 },
      {
        strokeDashoffset: 0,
        scrollTrigger: {
          trigger: '.flow-trigger',
          start: 'top 60%',
          end: 'bottom center',
          scrub: 1.5,
        },
      }
    );

    // Use cases cards reveal
    gsap.fromTo(
      '.usecase-card-reveal',
      { y: 50, opacity: 0, scale: 0.97 },
      {
        y: 0,
        opacity: 1,
        scale: 1,
        stagger: 0.15,
        scrollTrigger: {
          trigger: '.usecase-trigger',
          start: 'top 80%',
          toggleActions: 'play none none reverse',
        },
      }
    );

    // Pricing cards reveal
    gsap.fromTo(
      '.pricing-card-reveal',
      { y: 50, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        stagger: 0.15,
        scrollTrigger: {
          trigger: '.pricing-trigger',
          start: 'top 80%',
          toggleActions: 'play none none reverse',
        },
      }
    );
  }, []);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className={styles.landingContainer}>
      {/* 3D WebGL background */}
      <ThreePlexus />

      {/* Mouse tracker glow aura */}
      <div ref={glowRef} className={styles.glowingAura}></div>

      {/* Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.navContent}>
          <div className={styles.logoArea}>
            <div className={styles.logoIcon}>LF</div>
            <span>LeadFetcher</span>
          </div>
          <div className={styles.navLinks}>
            <a href="#features" className={styles.navLink}>Features</a>
            <a href="#simulator" className={styles.navLink}>Simulator</a>
            <a href="#workflow" className={styles.navLink}>Workflow</a>
            <a href="#pricing" className={styles.navLink}>Pricing</a>
          </div>
          <div className={styles.navActions}>
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
      <section className={styles.heroSection}>
        <h1 className={`${styles.heroTitle} hero-reveal`}>
          Extract High-Value Leads from any website with <span>AI Precision</span>
        </h1>
        <p className={`${styles.heroSub} hero-reveal`}>
          The ultimate multi-tenant platform for automated domain crawling, email verification, contact discovery, and structured data exports.
        </p>
        <div className={`${styles.ctaGroup} hero-reveal`}>
          <Link href="/register" className="btn-primary" style={{ padding: '14px 28px', fontSize: '15px' }}>
            Start Crawling Free
          </Link>
          <Link href="/login" className="btn-secondary" style={{ padding: '14px 28px', fontSize: '15px' }}>
            View Dashboard
          </Link>
        </div>

        {/* Dashboard Mockup */}
        <div className="mockup-trigger" style={{ width: '100%' }}>
          <div className={`${styles.mockupContainer} mockup-tilt`}>
            <div className={styles.mockup}>
              <div className={styles.mockupHeader}>
                <div className={styles.mockupDots}>
                  <div className={styles.mockupDot}></div>
                  <div className={styles.mockupDot}></div>
                  <div className={styles.mockupDot}></div>
                </div>
                <div className={styles.mockupTitle}>dashboard.leadfetcher.com/jobs/active</div>
                <div style={{ width: '40px' }}></div>
              </div>
              <div className={styles.mockupContent}>
                <div className={styles.mockupMain}>
                  <div className={styles.mockupHeading}>Real-Time Extraction Log</div>
                  <div className={styles.mockupCodeLine}><span>[09:21:40]</span> Initiating Puppeteer cluster controller...</div>
                  <div className={styles.mockupCodeLine}><span>[09:21:41]</span> Spawning worker thread #1 for target domain...</div>
                  <div className={styles.mockupCodeLine} style={{ color: '#22c55e' }}><span>[09:21:42]</span> Found email: <strong style={{ fontWeight: 600 }}>contact@domain.com</strong> (Added to DB)</div>
                  <div className={styles.mockupCodeLine}><span>[09:21:44]</span> Resolving repeating card structures on page 2...</div>
                  <div className={styles.mockupCodeLine} style={{ color: '#eab308' }}><span>[09:21:45]</span> Extracted WhatsApp: <strong style={{ fontWeight: 600 }}>+234 809 1122</strong> (Verified link)</div>
                  <div className={styles.mockupCodeLine}><span>[09:21:48]</span> Thread complete. Found 28 verified records.</div>
                </div>
                <div className={styles.mockupSidebar}>
                  <div className={styles.mockupBox}>
                    <div className={styles.mockupHeading}>Status</div>
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: '4px' }}>
                      <span className={styles.mockupPulse}></span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#22c55e' }}>Active</span>
                    </div>
                  </div>
                  <div className={styles.mockupBox}>
                    <div className={styles.mockupHeading}>Leads Found</div>
                    <div className={styles.mockupValue}>1,428</div>
                  </div>
                  <div className={styles.mockupBox}>
                    <div className={styles.mockupHeading}>Success Rate</div>
                    <div className={styles.mockupValue} style={{ color: '#f97316' }}>98.4%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className={`${styles.sectionWrapper} features-trigger`}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Everything you need to source leads</h2>
          <p className={styles.sectionSub}>
            Automated intelligence built directly into the crawling pipeline to filter, clean, and enrich contacts.
          </p>
        </div>
        <div className={styles.grid}>
          <div className={`${styles.featureCard} feature-card-reveal`}>
            <div className={styles.featureIcon}>
              <CrawlerSvg />
            </div>
            <h3>Deep Domain Crawling</h3>
            <p>Programmatically paginate and extract deep links or listing card elements from complex target sites in record time.</p>
          </div>

          <div className={`${styles.featureCard} feature-card-reveal`}>
            <div className={styles.featureIcon}>
              <VerifiedSvg />
            </div>
            <h3>Verified Contacts</h3>
            <p>Smart filters discover and format emails, phone numbers, and WhatsApp links, keeping bounces and bad numbers out of your CRM.</p>
          </div>

          <div className={`${styles.featureCard} feature-card-reveal`}>
            <div className={styles.featureIcon}>
              <ExporterSvg />
            </div>
            <h3>Custom Columns & Export</h3>
            <p>Filter leads instantly on the unified dashboard table and select custom columns to build clean, compliant CSV downloads.</p>
          </div>
        </div>
      </section>

      {/* Interactive Sandbox Simulator */}
      <section id="simulator" className={styles.sectionWrapper}>
        <ScraperSimulator />
      </section>

      {/* Step-by-Step Timeline (How it works) */}
      <section id="workflow" className={`${styles.sectionWrapper} flow-trigger`}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Automated target pipeline execution</h2>
          <p className={styles.sectionSub}>
            How LeadFetcher crawls, extracts, and delivers business prospects autonomously.
          </p>
        </div>

        <div className={styles.flowTimeline}>
          {/* Animated linking vector path */}
          <div className={styles.flowVector}>
            <svg width="4" height="400" viewBox="0 0 4 400" fill="none" style={{ overflow: 'visible' }}>
              <line x1="2" y1="0" x2="2" y2="400" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="4" />
              <line
                x1="2"
                y1="0"
                x2="2"
                y2="400"
                stroke="#f97316"
                strokeWidth="4"
                className="flow-line-draw"
                strokeDasharray="600"
                strokeDashoffset="600"
              />
            </svg>
          </div>

          {/* Timeline Nodes */}
          <div className={styles.flowNode}>
            <div className={styles.flowNumber}>1</div>
            <div className={`glass-panel ${styles.flowContent}`}>
              <h3>Configure Target Rules</h3>
              <p>
                Provide the crawler with a starting URL, maximum search depth, and extraction parameters (AI schemas, custom regex strings, or basic email parsing).
              </p>
            </div>
          </div>

          <div className={styles.flowNode}>
            <div className={styles.flowNumber}>2</div>
            <div className={`glass-panel ${styles.flowContent}`}>
              <h3>Background Parsing & Verification</h3>
              <p>
                Puppeteer worker threads scrape pages. Validated data gets passed to the verification handler, running instant MX record and SMTP handshake status checks.
              </p>
            </div>
          </div>

          <div className={styles.flowNode}>
            <div className={styles.flowNumber}>3</div>
            <div className={`glass-panel ${styles.flowContent}`}>
              <h3>Export and Sync Leads</h3>
              <p>
                Browse your verified contacts in the leads grid. Export only the custom columns you need or link them directly to automated outbound campaigns.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Grid */}
      <section className={`${styles.sectionWrapper} usecase-trigger`}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Designed for high-impact teams</h2>
          <p className={styles.sectionSub}>
            Discover how agencies, sales professionals, and marketers use the scraper to double efficiency.
          </p>
        </div>
        <div className={styles.grid}>
          <div className={`glass-panel ${styles.usecaseCard} usecase-card-reveal`}>
            <h3>Outbound Sales Teams</h3>
            <p>
              Instantly find and verify direct decision-maker contacts without wasting hours manually crawling directories or using stale static lists.
            </p>
          </div>

          <div className={`glass-panel ${styles.usecaseCard} usecase-card-reveal`}>
            <h3>Growth Marketers</h3>
            <p>
              Discover target WhatsApp lists, social profiles, and company telephone channels to execute multi-channel inbound campaigns efficiently.
            </p>
          </div>

          <div className={`glass-panel ${styles.usecaseCard} usecase-card-reveal`}>
            <h3>Marketing & Data Agencies</h3>
            <p>
              Scale client lead lists by running parallel scraping tasks in isolated workspaces, managing separate team credentials and quotas seamlessly.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className={`${styles.sectionWrapper} pricing-trigger`}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Simple, predictable plans</h2>
          <p className={styles.sectionSub}>
            Scale your scraping capacity up or down as your lead generation goals grow.
          </p>
        </div>
        <div className={styles.pricingGrid}>
          {/* Free Plan */}
          <div className={`${styles.pricingCard} pricing-card-reveal`}>
            <div className={styles.pricingPlan}>Free</div>
            <div className={styles.pricingPrice}>$0<span>/mo</span></div>
            <p className={styles.pricingDesc}>For exploring the platform and running minor manual extractions.</p>
            <div className={styles.pricingDivider}></div>
            <ul className={styles.pricingFeatures}>
              <li className={styles.pricingFeature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                1 Active Workspace
              </li>
              <li className={styles.pricingFeature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                100 Page crawls per month
              </li>
              <li className={styles.pricingFeature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Basic Table Filter
              </li>
              <li className={styles.pricingFeature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Standard CSV Export
              </li>
            </ul>
            <Link href="/register" className={`btn-secondary ${styles.pricingBtn}`}>
              Get Started
            </Link>
          </div>

          {/* Pro Plan */}
          <div className={`${styles.pricingCard} ${styles.popularCard} pricing-card-reveal`}>
            <span className={styles.popularBadge}>Most Popular</span>
            <div className={styles.pricingPlan}>Pro</div>
            <div className={styles.pricingPrice}>$49<span>/mo</span></div>
            <p className={styles.pricingDesc}>For teams and growth agencies requiring persistent crawling pipelines.</p>
            <div className={styles.pricingDivider}></div>
            <ul className={styles.pricingFeatures}>
              <li className={styles.pricingFeature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Unlimited Workspaces
              </li>
              <li className={styles.pricingFeature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                10,000 Page crawls per month
              </li>
              <li className={styles.pricingFeature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Advanced Social/WA Extraction
              </li>
              <li className={styles.pricingFeature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Priority Queue Processing
              </li>
              <li className={styles.pricingFeature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Prisma Database Sync
              </li>
            </ul>
            <Link href="/register" className={`btn-primary ${styles.pricingBtn}`}>
              Upgrade to Pro
            </Link>
          </div>

          {/* Enterprise Plan */}
          <div className={`${styles.pricingCard} pricing-card-reveal`}>
            <div className={styles.pricingPlan}>Enterprise</div>
            <div className={styles.pricingPrice}>Custom</div>
            <p className={styles.pricingDesc}>For large scale operations demanding high capacity and custom scrapers.</p>
            <div className={styles.pricingDivider}></div>
            <ul className={styles.pricingFeatures}>
              <li className={styles.pricingFeature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Custom Puppeteer Crawlers
              </li>
              <li className={styles.pricingFeature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Unlimited Crawls & Bandwidth
              </li>
              <li className={styles.pricingFeature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Custom Webhooks & API Access
              </li>
              <li className={styles.pricingFeature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Dedicated Server Nodes
              </li>
              <li className={styles.pricingFeature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Whitelabel Options
              </li>
            </ul>
            <Link href="mailto:enterprise@leadfetcher.com" className={`btn-secondary ${styles.pricingBtn}`}>
              Contact Sales
            </Link>
          </div>
        </div>
      </section>

      {/* Accordion FAQ Section */}
      <section className={styles.sectionWrapper}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
          <p className={styles.sectionSub}>
            Clear answers to help you configure and run scrapers successfully.
          </p>
        </div>

        <div className={styles.faqContainer}>
          {FAQ_ITEMS.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div key={index} className={`glass-panel ${styles.faqItem}`}>
                <button className={styles.faqQuestion} onClick={() => toggleFaq(index)}>
                  <span>{faq.question}</span>
                  <span className={styles.faqIcon} style={{ transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}>
                    +
                  </span>
                </button>
                <div className={styles.faqAnswerWrapper} style={{ height: isOpen ? 'auto' : '0', opacity: isOpen ? 1 : 0 }}>
                  <div className={styles.faqAnswer}>
                    <p>{faq.answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerCopyright}>
            &copy; {new Date().getFullYear()} LeadFetcher. All rights reserved.
          </div>
          <div className={styles.footerLinks}>
            <a href="#" className={styles.footerLink}>Terms of Service</a>
            <a href="#" className={styles.footerLink}>Privacy Policy</a>
            <a href="#" className={styles.footerLink}>Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
