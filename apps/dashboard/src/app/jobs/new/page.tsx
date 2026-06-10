'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import styles from '../Jobs.module.css';

export default function NewJobPage() {
  const router = useRouter();
  const [targetUrl, setTargetUrl] = useState('');
  const [maxPages, setMaxPages] = useState(50);
  const [crawlDelay, setCrawlDelay] = useState<'polite' | 'normal' | 'aggressive'>('normal');
  const [enableLLM, setEnableLLM] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom selectors state
  const [vendorNameSelector, setVendorNameSelector] = useState('');
  const [phoneSelector, setPhoneSelector] = useState('');
  const [emailSelector, setEmailSelector] = useState('');
  const [priceSelector, setPriceSelector] = useState('');
  const [locationSelector, setLocationSelector] = useState('');
  const [listingLinksSelector, setListingLinksSelector] = useState('');

  // Slider ref for filled track
  const sliderRef = useRef<HTMLInputElement>(null);
  const sliderMin = 1;
  const sliderMax = 10000;

  const getSliderPercent = useCallback(
    (val: number) => ((val - sliderMin) / (sliderMax - sliderMin)) * 100,
    [],
  );

  // Keep fill width updated
  const [fillPercent, setFillPercent] = useState(getSliderPercent(50));

  useEffect(() => {
    setFillPercent(getSliderPercent(maxPages));
  }, [maxPages, getSliderPercent]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setMaxPages(val);
    setFillPercent(getSliderPercent(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!targetUrl) {
      setError('Please provide a target URL.');
      return;
    }

    try {
      new URL(targetUrl);
    } catch {
      setError('Please enter a valid URL including http:// or https://');
      return;
    }

    setIsSubmitting(true);

    const customSelectors =
      vendorNameSelector || phoneSelector || emailSelector || priceSelector || locationSelector || listingLinksSelector
        ? {
            vendorName: vendorNameSelector || undefined,
            phone: phoneSelector || undefined,
            email: emailSelector || undefined,
            price: priceSelector || undefined,
            location: locationSelector || undefined,
            listingLinks: listingLinksSelector || undefined,
          }
        : undefined;

    const payload = {
      targetUrl,
      config: {
        maxPages: Number(maxPages),
        crawlDelay,
        enableLLM,
        customSelectors,
      },
    };

    try {
      const res = await api.post<any>('/jobs', payload);
      if (res.success && res.data) {
        router.push(`/jobs/${res.data.id}`);
      } else {
        setError(res.error || 'Failed to create job');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while launching the job.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const speedDescriptions: Record<string, string> = {
    polite: 'Safest option — 2 second delay between requests. Best for sensitive sites.',
    normal: 'Balanced — 500ms delay. Good for most directory sites.',
    aggressive: 'No delay between requests. Use with caution, may trigger blocks.',
  };

  return (
    <div className={styles.container}>
      <div className={`glass-panel ${styles.formCard}`}>
        <h2 className={styles.formTitle}>Launch Scrape Job</h2>
        <p className={styles.formSubtitle}>
          Configure target parameters and limits for the lead extraction process.
        </p>

        {error && (
          <div className={styles.errorBanner}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.formGroup}>
          {/* ─── Target URL ─────────────────── */}
          <div>
            <label htmlFor="targetUrl" className={`${styles.fieldLabel} ${styles.fieldLabelRequired}`}>
              Target URL
            </label>
            <input
              id="targetUrl"
              type="url"
              className="form-input"
              placeholder="https://directory.com/vendors"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              disabled={isSubmitting}
              required
              autoFocus
            />
          </div>

          <div className={styles.flexRow}>
            {/* ─── Max Crawl Pages Slider ─────── */}
            <div className={styles.sliderContainer}>
              <div className={styles.sliderHeader}>
                <span className={styles.toggleLabel}>Max Crawl Pages</span>
                <input
                  type="number"
                  className={styles.sliderValue}
                  value={maxPages}
                  min={sliderMin}
                  max={sliderMax}
                  onChange={(e) => {
                    const v = Math.max(sliderMin, Math.min(sliderMax, Number(e.target.value) || sliderMin));
                    setMaxPages(v);
                  }}
                  onBlur={(e) => {
                    const v = Math.max(sliderMin, Math.min(sliderMax, Number(e.target.value) || sliderMin));
                    setMaxPages(v);
                  }}
                  disabled={isSubmitting}
                  style={{ width: '72px', textAlign: 'right', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', padding: '2px 8px', color: 'var(--accent)', fontWeight: 700, fontSize: '0.95rem', fontFamily: 'inherit' }}
                />
              </div>

              {/* Custom slider with fill track */}
              <div className={styles.sliderTrack}>
                <div
                  className={styles.sliderFill}
                  style={{ width: `${fillPercent}%` }}
                />
                <input
                  ref={sliderRef}
                  type="range"
                  min={sliderMin}
                  max={sliderMax}
                  step="10"
                  className={styles.sliderInput}
                  value={maxPages}
                  onChange={handleSliderChange}
                  disabled={isSubmitting}
                  style={{ position: 'absolute', top: '-7px', left: 0, width: '100%' }}
                />
              </div>

              <div className={styles.sliderTicks}>
                <span>1</span>
                <span>100</span>
                <span>1K</span>
                <span>5K</span>
                <span>10K</span>
              </div>
            </div>

            {/* ─── Crawl Speed Preset ────────── */}
            <div>
              <label htmlFor="crawlDelay" className={styles.fieldLabel}>
                Crawl Speed Preset
              </label>
              <select
                id="crawlDelay"
                className={styles.selectInput}
                value={crawlDelay}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCrawlDelay(e.target.value as any)}
                disabled={isSubmitting}
              >
                <option value="polite">🐢 Polite (2s delay)</option>
                <option value="normal">⚡ Normal (500ms delay)</option>
                <option value="aggressive">🔥 Aggressive (No delay)</option>
              </select>
              <p className={styles.toggleDesc} style={{ marginTop: '6px' }}>
                {speedDescriptions[crawlDelay]}
              </p>
            </div>
          </div>

          {/* ─── LLM Extraction Toggle ─────── */}
          <div className={styles.toggleContainer}>
            <div className={styles.toggleInfo}>
              <span className={styles.toggleLabel}>LLM Extraction Fallback</span>
              <span className={styles.toggleDesc}>
                Uses Gemini to extract contacts if regex &amp; heuristics fail. Consumes token credits.
              </span>
            </div>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={enableLLM}
                onChange={(e) => setEnableLLM(e.target.checked)}
                disabled={isSubmitting}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>

          {/* ─── Advanced Selectors Accordion ── */}
          <div>
            <button
              type="button"
              className={styles.advancedToggle}
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <span>Advanced Selectors CSS Override</span>
              <span className={`${styles.advancedArrow} ${showAdvanced ? styles.advancedArrowOpen : ''}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </button>

            {showAdvanced && (
              <div className={styles.advancedPanel}>
                <div className={styles.flexRow}>
                  <div className={styles.selectorField}>
                    <label className={styles.selectorLabel}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                      Vendor Listing Card Links
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder=".vendor-card a.link"
                      value={listingLinksSelector}
                      onChange={(e) => setListingLinksSelector(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className={styles.selectorField}>
                    <label className={styles.selectorLabel}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      Vendor Name Heading
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder=".profile-header h1"
                      value={vendorNameSelector}
                      onChange={(e) => setVendorNameSelector(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className={styles.flexRow}>
                  <div className={styles.selectorField}>
                    <label className={styles.selectorLabel}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                      Email Address Element
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="a[href^='mailto:']"
                      value={emailSelector}
                      onChange={(e) => setEmailSelector(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className={styles.selectorField}>
                    <label className={styles.selectorLabel}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.68 2.34a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.74.32 1.53.55 2.34.68A2 2 0 0 1 22 16.92z"/></svg>
                      Phone Number Element
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="span.phone-number"
                      value={phoneSelector}
                      onChange={(e) => setPhoneSelector(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className={styles.flexRow}>
                  <div className={styles.selectorField}>
                    <label className={styles.selectorLabel}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      Price Range / Target Price
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder=".price-value"
                      value={priceSelector}
                      onChange={(e) => setPriceSelector(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className={styles.selectorField}>
                    <label className={styles.selectorLabel}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      Vendor Physical Location
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="div.address"
                      value={locationSelector}
                      onChange={(e) => setLocationSelector(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ─── Form Actions ─────────────────── */}
          <div className={styles.formActions}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => router.push('/jobs')}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Launching…
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Start Crawling
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
