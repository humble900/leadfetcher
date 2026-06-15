'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import styles from './Leads.module.css';

const ALL_COLUMNS = [
  { key: 'vendorName', label: 'Vendor / Company Name' },
  { key: 'email', label: 'Email Address' },
  { key: 'phone', label: 'Phone Number' },
  { key: 'whatsapp', label: 'WhatsApp Number' },
  { key: 'website', label: 'Website' },
  { key: 'location', label: 'Location' },
  { key: 'address', label: 'Street Address' },
  { key: 'businessCategory', label: 'Business Category' },
  { key: 'productName', label: 'Product Name' },
  { key: 'price', label: 'Price' },
  { key: 'description', label: 'Description' },
  { key: 'listingUrl', label: 'Source Page URL' },
  { key: 'qualityScore', label: 'Quality Score' },
  { key: 'isVerified', label: 'Verified Status' },
];

function LeadsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId') || '';

  const [leads, setLeads] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters state
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [hasEmail, setHasEmail] = useState<string>('all');
  const [hasPhone, setHasPhone] = useState<string>('all');
  const [minScore, setMinScore] = useState<number>(0);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [jumpPage, setJumpPage] = useState('');

  // Export Modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [selectedColumns, setSelectedColumns] = useState<string[]>(ALL_COLUMNS.map(c => c.key));

  // Load leads based on current filters and page
  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page,
        limit,
        sortBy,
        sortOrder,
      };

      if (jobId) params.jobId = jobId;
      if (search) params.search = search;
      if (category) params.businessCategory = category;
      if (hasEmail !== 'all') params.hasEmail = hasEmail;
      if (hasPhone !== 'all') params.hasPhone = hasPhone;
      if (minScore > 0) params.minQualityScore = minScore;

      const res = await api.get<any>('/leads', { params });
      if (res.success) {
        setLeads(res.data || res.leads || []);
        if (res.pagination) {
          setTotal(res.pagination.total);
          setTotalPages(res.pagination.totalPages);
        }
      }
    } catch (err) {
      console.error('Failed to load leads', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, sortBy, sortOrder, search, category, hasEmail, hasPhone, minScore, jobId]);

  // Fetch unique categories for dropdown on mount
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await api.get<any>('/leads/stats');
        if (res.success && res.data?.categories) {
          setCategories(res.data.categories.map((c: any) => c.name).filter(Boolean));
        }
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    }
    fetchStats();
  }, []);

  // Reload leads when filters, sorting or page change
  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadLeads();
  };

  const handleResetFilters = () => {
    setSearch('');
    setCategory('');
    setHasEmail('all');
    setHasPhone('all');
    setMinScore(0);
    setSortBy('created_at');
    setSortOrder('desc');
    setPage(1);
    router.push('/leads');
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    try {
      const res = await api.delete<any>(`/leads/${leadId}`);
      if (res.success) {
        // Refresh local leads list
        setLeads((prev) => prev.filter((l) => l.id !== leadId));
        setTotal((prev) => prev - 1);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete lead.');
    }
  };

  const handleExport = async () => {
    if (selectedColumns.length === 0) {
      alert('Please select at least one column to export.');
      return;
    }
    setExporting(true);
    try {
      const queryParams: Record<string, any> = {};
      if (jobId) queryParams.jobId = jobId;
      if (search) queryParams.search = search;
      if (category) queryParams.businessCategory = category;
      if (hasEmail !== 'all') queryParams.hasEmail = hasEmail;
      if (hasPhone !== 'all') queryParams.hasPhone = hasPhone;
      if (minScore > 0) queryParams.minQualityScore = minScore;

      const blob = await api.post<Blob>('/leads/export', {
        format: exportFormat,
        query: queryParams,
        columns: selectedColumns,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leadfetcher-export-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setIsExportModalOpen(false);
    } catch (err: any) {
      alert(err.message || `Failed to export ${exportFormat.toUpperCase()}. Export limits might be reached.`);
    } finally {
      setExporting(false);
    }
  };

  const toggleColumn = (key: string) => {
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const selectAllColumns = () => setSelectedColumns(ALL_COLUMNS.map((c) => c.key));
  const selectNoneColumns = () => setSelectedColumns([]);

  const getScoreClass = (score: number) => {
    if (score >= 80) return styles['score-high'];
    if (score >= 50) return styles['score-medium'];
    return styles['score-low'];
  };

  const truncate = (str: string | null | undefined, max = 30) => {
    if (!str) return 'N/A';
    if (str.length <= max) return str;
    return str.slice(0, max) + '...';
  };

  const handleJumpPage = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(jumpPage);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      setPage(parsed);
      setJumpPage('');
    }
  };

  const renderPaginationRange = () => {
    const range = [];
    const maxVisiblePages = 5;

    range.push(1);

    let start = Math.max(2, page - 2);
    let end = Math.min(totalPages - 1, page + 2);

    if (page <= 3) {
      end = Math.min(totalPages - 1, maxVisiblePages);
    }
    if (page >= totalPages - 2) {
      start = Math.max(2, totalPages - maxVisiblePages + 1);
    }

    if (start > 2) {
      range.push('...');
    }

    for (let i = start; i <= end; i++) {
      range.push(i);
    }

    if (end < totalPages - 1) {
      range.push('...');
    }

    if (totalPages > 1) {
      range.push(totalPages);
    }

    return range;
  };

  return (
    <div className={styles.container}>
      {/* Job filter banner */}
      {jobId && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'rgba(249, 115, 22, 0.1)',
          border: '1px solid rgba(249, 115, 22, 0.2)',
          padding: '12px 20px',
          borderRadius: 'var(--radius-md)',
          fontSize: '13.5px',
          color: 'hsl(var(--text-primary))'
        }}>
          <span>
            Showing leads for crawl job: <strong style={{ fontFamily: 'monospace', color: 'hsl(var(--accent-primary))' }}>{jobId}</strong>
          </span>
          <button
            className="btn-secondary"
            style={{ padding: '4px 10px', fontSize: '12px' }}
            onClick={() => router.push('/leads')}
          >
            Clear Job Filter
          </button>
        </div>
      )}

      {/* Filters Card */}
      <div className={`glass-panel ${styles.filterPanel}`}>
        <form onSubmit={handleSearchSubmit} className={styles.searchRow}>
          <input
            type="text"
            className={`form-input ${styles.searchBar}`}
            placeholder="Search leads by vendor name, location, address, product, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn-primary" style={{ flexShrink: 0 }}>
            Search
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleResetFilters}
            style={{ flexShrink: 0 }}
          >
            Reset Filters
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setIsExportModalOpen(true)}
            style={{ flexShrink: 0, background: 'var(--status-success-bg)', color: 'hsl(var(--status-success))', borderColor: 'hsl(var(--status-success) / 0.2)', boxShadow: 'none' }}
            disabled={leads.length === 0}
          >
            Export Option...
          </button>
        </form>

        <div className={styles.filterGrid}>
          <div className={styles.filterField}>
            <label className={styles.filterLabel}>Business Category</label>
            <select
              className={styles.selectInput || 'form-input'}
              style={{ padding: '8px 12px' }}
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterField}>
            <label className={styles.filterLabel}>Email Filter</label>
            <select
              className={styles.selectInput || 'form-input'}
              style={{ padding: '8px 12px' }}
              value={hasEmail}
              onChange={(e) => {
                setHasEmail(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Any Email Status</option>
              <option value="true">Has Email Address</option>
              <option value="false">No Email Address</option>
            </select>
          </div>

          <div className={styles.filterField}>
            <label className={styles.filterLabel}>Phone Filter</label>
            <select
              className={styles.selectInput || 'form-input'}
              style={{ padding: '8px 12px' }}
              value={hasPhone}
              onChange={(e) => {
                setHasPhone(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Any Phone Status</option>
              <option value="true">Has Phone Number</option>
              <option value="false">No Phone Number</option>
            </select>
          </div>

          <div className={styles.filterField}>
            <label className={styles.filterLabel}>Min Quality Score</label>
            <select
              className={styles.selectInput || 'form-input'}
              style={{ padding: '8px 12px' }}
              value={minScore}
              onChange={(e) => {
                setMinScore(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value="0">Any Quality</option>
              <option value="30">30+ Score</option>
              <option value="50">50+ Score</option>
              <option value="80">80+ Score (High Quality)</option>
            </select>
          </div>

          <div className={styles.filterField}>
            <label className={styles.filterLabel}>Sort By</label>
            <select
              className={styles.selectInput || 'form-input'}
              style={{ padding: '8px 12px' }}
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
            >
              <option value="created_at">Date Extracted</option>
              <option value="quality_score">Quality Score</option>
              <option value="vendor_name">Vendor Name</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table grid */}
      <div className={`glass-panel ${styles.tableCard}`}>
        {loading && leads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'hsl(var(--text-secondary))' }}>
            Loading extracted leads list...
          </div>
        ) : leads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'hsl(var(--text-muted))' }}>
            No leads matching the selected filters found.
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '160px' }}>Vendor / Company</th>
                <th style={{ width: '160px' }}>Email</th>
                <th style={{ width: '130px' }}>Phone</th>
                <th style={{ width: '130px' }}>WhatsApp</th>
                <th style={{ width: '140px' }}>Location</th>
                <th style={{ width: '160px' }}>Address</th>
                <th style={{ width: '130px' }}>Category</th>
                <th style={{ width: '100px' }}>Price</th>
                <th style={{ width: '160px' }}>Description</th>
                <th style={{ width: '80px' }}>Quality</th>
                <th style={{ width: '90px' }}>Method</th>
                <th style={{ width: '120px' }}>Source URL</th>
                <th style={{ width: '70px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td className={styles.vendorCell} title={lead.vendorName || 'N/A'}>
                    {truncate(lead.vendorName)}
                  </td>
                  <td>
                    {lead.email ? (
                      <a href={`mailto:${lead.email}`} className={styles.contactCell} title={lead.email}>
                        {truncate(lead.email)}
                      </a>
                    ) : (
                      <span style={{ color: 'hsl(var(--text-muted))' }}>N/A</span>
                    )}
                  </td>
                  <td>
                    {lead.phone ? (
                      <a href={`tel:${lead.phone}`} className={styles.contactCell} title={lead.phone}>
                        {truncate(lead.phone)}
                      </a>
                    ) : (
                      <span style={{ color: 'hsl(var(--text-muted))' }}>N/A</span>
                    )}
                  </td>
                  <td>
                    {lead.whatsapp ? (
                      <a
                        href={`https://wa.me/${lead.whatsapp.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.contactCell}
                        title={lead.whatsapp}
                      >
                        {truncate(lead.whatsapp)}
                      </a>
                    ) : (
                      <span style={{ color: 'hsl(var(--text-muted))' }}>N/A</span>
                    )}
                  </td>
                  <td title={lead.location || 'N/A'}>
                    {truncate(lead.location)}
                  </td>
                  <td title={lead.address || 'N/A'}>
                    {truncate(lead.address)}
                  </td>
                  <td title={lead.businessCategory || 'N/A'}>
                    {truncate(lead.businessCategory)}
                  </td>
                  <td style={{ fontWeight: 500 }} title={lead.price || 'N/A'}>
                    {truncate(lead.price)}
                  </td>
                  <td title={lead.description || 'N/A'}>
                    {truncate(lead.description)}
                  </td>
                  <td>
                    <span className={`${styles.scorePill} ${getScoreClass(lead.qualityScore)}`}>
                      {lead.qualityScore}
                    </span>
                  </td>
                  <td>
                    <span className={styles.methodBadge}>
                      {lead.extractionMethod}
                    </span>
                  </td>
                  <td>
                    {lead.website || lead.listingUrl ? (
                      <a
                        href={lead.website || lead.listingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.websiteLink}
                        title={lead.website || lead.listingUrl}
                      >
                        {truncate(lead.website || lead.listingUrl, 20)} &rarr;
                      </a>
                    ) : (
                      <span style={{ color: 'hsl(var(--text-muted))' }}>N/A</span>
                    )}
                  </td>
                  <td>
                    <button
                      onClick={() => handleDeleteLead(lead.id)}
                      className={styles.deleteBtn}
                      title="Delete lead"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Improved pagination with jumping */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            disabled={page <= 1 || loading}
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
          >
            &laquo; Prev
          </button>

          {renderPaginationRange().map((p, index) => {
            if (p === '...') {
              return <span key={`dots-${index}`} className={styles.pageInfo}>...</span>;
            }
            return (
              <button
                key={`page-${p}`}
                className={`${styles.pageBtn} ${page === p ? styles.pageBtnActive : ''}`}
                onClick={() => setPage(p as number)}
                disabled={loading}
              >
                {p}
              </button>
            );
          })}

          <button
            className={styles.pageBtn}
            disabled={page >= totalPages || loading}
            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
          >
            Next &raquo;
          </button>

          <span className={styles.pageInfo}>
            (Total: {total} leads)
          </span>

          <form onSubmit={handleJumpPage} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '12px' }}>
            <span style={{ fontSize: '12px', color: 'hsl(var(--text-muted))' }}>Go to:</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpPage}
              onChange={(e) => setJumpPage(e.target.value)}
              className="form-input"
              style={{ width: '55px', padding: '4px 6px', fontSize: '12px', textAlign: 'center', height: '28px' }}
            />
            <button type="submit" className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', height: '28px' }}>Jump</button>
          </form>
        </div>
      )}

      {/* Export Column Selector Modal */}
      {isExportModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>Export Leads</h3>
            <p className={styles.modalSubtitle}>Customize the format and columns for your exported file.</p>

            <div className={styles.filterField} style={{ marginBottom: '20px' }}>
              <label className={styles.filterLabel}>Export Format</label>
              <select
                className="form-input"
                style={{ padding: '8px 12px', width: '100%' }}
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'csv' | 'json')}
              >
                <option value="csv">CSV (Spreadsheet friendly)</option>
                <option value="json">JSON (Developer friendly)</option>
              </select>
            </div>

            <label className={styles.filterLabel} style={{ marginBottom: '8px', display: 'block' }}>Select Columns</label>
            <div className={styles.selectActions}>
              <button className={styles.selectLink} onClick={selectAllColumns}>Select All</button>
              <button className={styles.selectLink} onClick={selectNoneColumns}>Deselect All</button>
            </div>

            <div className={styles.columnGrid}>
              {ALL_COLUMNS.map((col) => (
                <label key={col.key} className={styles.columnCheckbox}>
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(col.key)}
                    onChange={() => toggleColumn(col.key)}
                  />
                  <span>{col.label}</span>
                </label>
              ))}
            </div>

            <div className={styles.modalActions}>
              <button
                className="btn-secondary"
                onClick={() => setIsExportModalOpen(false)}
                disabled={exporting}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleExport}
                disabled={exporting || selectedColumns.length === 0}
              >
                {exporting ? 'Exporting...' : 'Export File'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <p style={{ color: 'hsl(var(--text-secondary))' }}>Loading leads dashboard...</p>
      </div>
    }>
      <LeadsContent />
    </Suspense>
  );
}
