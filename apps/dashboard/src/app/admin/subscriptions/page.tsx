'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../components/layout/AuthContext';
import { api } from '../../../lib/api';
import { useRouter } from 'next/navigation';
import styles from './AdminSubscriptions.module.css';

interface Plan {
  id: string;
  name: string;
  maxLeadsMonthly: number;
  maxJobsMonthly: number;
  maxPagesPerJob: number;
  maxConcurrentJobs: number;
  maxExportsMonthly: number;
  llmEnabled: boolean;
  maxLlmTokensMonthly: number;
  apiRateLimitRpm: number;
  dataRetentionDays: number;
  priceMonthyCents: number;
}

interface Tenant {
  id: string;
  name: string;
  status: string;
  planId: string;
  planName: string;
  userCount: number;
  jobCount: number;
  leadCount: number;
  customLimits: Record<string, any> | null;
  createdAt: string;
}

export default function AdminSubscriptionsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tenantsList, setTenantsList] = useState<Tenant[]>([]);
  const [plansList, setPlansList] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search query
  const [searchQuery, setSearchQuery] = useState('');

  // Editing state
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [customLimits, setCustomLimits] = useState<Record<string, string>>({
    maxLeadsMonthly: '',
    maxJobsMonthly: '',
    maxPagesPerJob: '',
    maxConcurrentJobs: '',
    maxExportsMonthly: '',
    maxLlmTokensMonthly: '',
  });

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [tenantsRes, plansRes] = await Promise.all([
        api.get<any>('/admin/tenants?limit=100'),
        api.get<any>('/admin/plans'),
      ]);

      if (tenantsRes.success) {
        setTenantsList(tenantsRes.data || []);
      }
      if (plansRes.success) {
        setPlansList(plansRes.data || []);
      }
    } catch (err: any) {
      if (err?.status === 403) {
        router.push('/');
        return;
      }
      setError(err?.message || 'Failed to load subscription administration data');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (user?.role !== 'super_admin') {
      router.push('/');
      return;
    }
    loadData();
  }, [user, router, loadData]);

  // Open Edit Modal
  const handleOpenEdit = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setSelectedPlanId(tenant.planId);
    
    // Set current custom limits or empty fields
    const limits = tenant.customLimits || {};
    setCustomLimits({
      maxLeadsMonthly: limits.maxLeadsMonthly?.toString() || '',
      maxJobsMonthly: limits.maxJobsMonthly?.toString() || '',
      maxPagesPerJob: limits.maxPagesPerJob?.toString() || '',
      maxConcurrentJobs: limits.maxConcurrentJobs?.toString() || '',
      maxExportsMonthly: limits.maxExportsMonthly?.toString() || '',
      maxLlmTokensMonthly: limits.maxLlmTokensMonthly?.toString() || '',
    });
  };

  // Close Edit Modal
  const handleCloseEdit = () => {
    setEditingTenant(null);
  };

  // Save Tenant plan and custom limits
  const handleSave = async () => {
    if (!editingTenant) return;

    setSaving(true);
    try {
      // Build clean custom limits (ignore empty strings so we default to plan limit)
      const cleanCustomLimits: Record<string, number> = {};
      Object.entries(customLimits).forEach(([key, val]) => {
        if (val.trim() !== '') {
          const num = parseInt(val, 10);
          if (!isNaN(num)) {
            cleanCustomLimits[key] = num;
          }
        }
      });

      const res = await api.put<any>(`/admin/tenants/${editingTenant.id}/plan`, {
        planId: selectedPlanId,
        customLimits: Object.keys(cleanCustomLimits).length > 0 ? cleanCustomLimits : null,
      });

      if (res.success) {
        // Refresh local tenants list
        setTenantsList((prev) =>
          prev.map((t) =>
            t.id === editingTenant.id
              ? {
                  ...t,
                  planId: selectedPlanId,
                  planName: plansList.find((p) => p.id === selectedPlanId)?.name || t.planName,
                  customLimits: Object.keys(cleanCustomLimits).length > 0 ? cleanCustomLimits : null,
                }
              : t
          )
        );

        setToast('Tenant plan and custom limits updated successfully');
        setTimeout(() => setToast(null), 3000);
        handleCloseEdit();
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to update tenant configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleLimitChange = (field: string, value: string) => {
    // Only allow digits or empty string
    if (value === '' || /^\d+$/.test(value)) {
      setCustomLimits((prev) => ({ ...prev, [field]: value }));
    }
  };

  // Filter tenants based on search query
  const filteredTenants = tenantsList.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.planName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPlanBadgeClass = (planName: string) => {
    const lower = planName.toLowerCase();
    if (lower === 'pro') return styles.planBadgePro;
    if (lower === 'enterprise') return styles.planBadgeEnterprise;
    return styles.planBadgeFree;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingWrapper}>
          <div className={styles.spinner} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorText}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Tenant Subscriptions</h1>
          <p className={styles.pageSubtitle}>
            Manage plans and assign custom limits for all workspaces
          </p>
        </div>
      </div>

      {/* Actions & Filters */}
      <div className={styles.actionsRow}>
        <div className={styles.searchWrapper}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search workspaces by name or plan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tenants Table */}
      <div className={styles.tableCard}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Workspace / ID</th>
                <th className={styles.th}>Current Plan</th>
                <th className={styles.th}>Users</th>
                <th className={styles.th}>Jobs Run</th>
                <th className={styles.th}>Leads Extracted</th>
                <th className={styles.th}>Custom Limits</th>
                <th className={styles.th} style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.td} style={{ textAlign: 'center', padding: '40px 0', color: 'hsl(var(--text-muted))' }}>
                    No workspaces found matching the query.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((tenant) => (
                  <tr key={tenant.id} className={styles.tenantRow}>
                    <td className={styles.td}>
                      <div className={styles.tenantName}>{tenant.name}</div>
                      <div className={styles.tenantId}>{tenant.id}</div>
                    </td>
                    <td className={styles.td}>
                      <span className={`${styles.planBadge} ${getPlanBadgeClass(tenant.planName)}`}>
                        {tenant.planName}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <div className={styles.metaBadge}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                        </svg>
                        {tenant.userCount}
                      </div>
                    </td>
                    <td className={styles.td}>{tenant.jobCount}</td>
                    <td className={styles.td}>{tenant.leadCount.toLocaleString()}</td>
                    <td className={styles.td}>
                      {tenant.customLimits ? (
                        <span style={{ color: 'hsl(var(--accent-primary))', fontWeight: 600, fontSize: '13px' }}>
                          Active ({Object.keys(tenant.customLimits).length})
                        </span>
                      ) : (
                        <span style={{ color: 'hsl(var(--text-muted))', fontSize: '13px' }}>Standard</span>
                      )}
                    </td>
                    <td className={styles.td} style={{ textAlign: 'right' }}>
                      <button
                        className={styles.editBtn}
                        onClick={() => handleOpenEdit(tenant)}
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit limits & plan modal */}
      {editingTenant && (
        <div className={styles.modalOverlay} onClick={handleCloseEdit}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Manage Workspace Subscriptions</h3>
              <button className={styles.closeBtn} onClick={handleCloseEdit}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Workspace Name</label>
                <div style={{ fontSize: '14px', fontWeight: 600, padding: '10px 14px', backgroundColor: 'hsl(var(--bg-surface-elevated))', borderRadius: 'var(--radius-md)', border: '1px solid hsl(var(--border-color))' }}>
                  {editingTenant.name}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Select Subscription Plan</label>
                <select
                  className={styles.selectInput}
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                >
                  {plansList.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} (${(plan.priceMonthyCents / 100).toFixed(0)}/mo)
                    </option>
                  ))}
                </select>
                <p className={styles.helpText}>
                  Assigning a plan updates limits to the plan defaults, unless custom overrides are specified below.
                </p>
              </div>

              <div className={styles.sectionTitle}>Custom Limit Overrides</div>

              <div className={styles.limitsGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Max Leads / month</label>
                  <input
                    type="text"
                    className={styles.inputField}
                    placeholder="Plan default"
                    value={customLimits.maxLeadsMonthly}
                    onChange={(e) => handleLimitChange('maxLeadsMonthly', e.target.value)}
                  />
                  <p className={styles.helpText}>Blank to use plan default</p>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Max Jobs / month</label>
                  <input
                    type="text"
                    className={styles.inputField}
                    placeholder="Plan default"
                    value={customLimits.maxJobsMonthly}
                    onChange={(e) => handleLimitChange('maxJobsMonthly', e.target.value)}
                  />
                  <p className={styles.helpText}>Blank to use plan default</p>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Max Pages per Job</label>
                  <input
                    type="text"
                    className={styles.inputField}
                    placeholder="Plan default"
                    value={customLimits.maxPagesPerJob}
                    onChange={(e) => handleLimitChange('maxPagesPerJob', e.target.value)}
                  />
                  <p className={styles.helpText}>Blank to use plan default</p>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Concurrent Job Limit</label>
                  <input
                    type="text"
                    className={styles.inputField}
                    placeholder="Plan default"
                    value={customLimits.maxConcurrentJobs}
                    onChange={(e) => handleLimitChange('maxConcurrentJobs', e.target.value)}
                  />
                  <p className={styles.helpText}>Blank to use plan default</p>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>CSV Exports / month</label>
                  <input
                    type="text"
                    className={styles.inputField}
                    placeholder="Plan default"
                    value={customLimits.maxExportsMonthly}
                    onChange={(e) => handleLimitChange('maxExportsMonthly', e.target.value)}
                  />
                  <p className={styles.helpText}>Blank to use plan default</p>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>LLM Tokens / month</label>
                  <input
                    type="text"
                    className={styles.inputField}
                    placeholder="Plan default"
                    value={customLimits.maxLlmTokensMonthly}
                    onChange={(e) => handleLimitChange('maxLlmTokensMonthly', e.target.value)}
                  />
                  <p className={styles.helpText}>Blank to use plan default</p>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={handleCloseEdit}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Success Message */}
      {toast && (
        <div className={styles.toast}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ color: 'hsl(var(--accent-green))' }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {toast}
        </div>
      )}
    </div>
  );
}
