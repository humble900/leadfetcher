'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../components/layout/AuthContext';
import { api } from '../../lib/api';
import styles from './Settings.module.css';

interface PlanInfo {
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

interface SubscriptionData {
  currentPlan: PlanInfo | null;
  allPlans: PlanInfo[];
  paymentMode: 'manual' | 'automatic';
  whatsappNumber: string;
}

const WHATSAPP_NUMBER = '14094229714';

const CHECK_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default function SettingsPage() {
  const { user } = useAuth();
  const [subData, setSubData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get<any>('/usage/subscription');
        if (res.success) {
          setSubData(res.data);
        }
      } catch (err) {
        console.error('Failed to load subscription data', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
      </div>
    );
  }

  const currentPlan = subData?.currentPlan;
  const allPlans = subData?.allPlans || [];
  const userInitials = user?.email?.slice(0, 2) || 'U';

  const formatPrice = (cents: number) => {
    if (cents === 0) return '$0';
    return `$${(cents / 100).toFixed(0)}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 999_999) return 'Unlimited';
    return num.toLocaleString();
  };

  const getPlanBadgeClass = (planName: string) => {
    const lower = planName.toLowerCase();
    if (lower === 'pro') return styles.badgePro;
    if (lower === 'enterprise') return styles.badgeEnterprise;
    return styles.badgeFree;
  };

  const getWhatsAppUrl = (planName: string) => {
    const rawNum = subData?.whatsappNumber || WHATSAPP_NUMBER;
    const cleanNum = rawNum.replace(/\D/g, '');
    const message = encodeURIComponent(
      `Hi, I'd like to upgrade my LeadFetcher plan to ${planName}. My account email is ${user?.email || 'N/A'}.`
    );
    return `https://wa.me/${cleanNum}?text=${message}`;
  };

  // Sort plans: Free first, then Pro, then Enterprise
  const sortedPlans = [...allPlans].sort((a, b) => a.priceMonthyCents - b.priceMonthyCents);

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Settings</h1>
        <p className={styles.pageSubtitle}>
          Manage your profile and subscription plan
        </p>
      </div>

      {/* ─── Profile Card ─────────────────── */}
      <div className={styles.profileCard}>
        <div className={styles.profileHeader}>
          <div className={styles.avatar}>{userInitials}</div>
          <div className={styles.profileInfo}>
            <h2>{user?.email || 'User'}</h2>
            <p>
              {user?.role === 'super_admin'
                ? 'Super Administrator'
                : user?.role === 'owner'
                  ? 'Workspace Owner'
                  : user?.role === 'admin'
                    ? 'Administrator'
                    : 'Team Member'}
            </p>
          </div>
        </div>
        <div className={styles.profileMeta}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Role</span>
            <span className={styles.metaValue}>{user?.role || 'member'}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Tenant ID</span>
            <span className={styles.metaValue} style={{ fontFamily: 'monospace', fontSize: '12px' }}>
              {user?.tenantId?.slice(0, 8) || 'N/A'}...
            </span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Current Plan</span>
            <span className={`${styles.planBadge} ${getPlanBadgeClass(currentPlan?.name || 'Free')}`}>
              {currentPlan?.name || 'Free'}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Subscription Card ────────────── */}
      <div className={styles.subscriptionCard}>
        <h2 className={styles.cardTitle}>Subscription & Plans</h2>
        <p className={styles.cardDescription}>
          View your current plan and upgrade to unlock more features and higher limits.
        </p>

        {/* Current Plan Banner */}
        <div className={styles.currentPlanBanner}>
          <div className={styles.currentPlanInfo}>
            <span className={styles.currentPlanLabel}>Your Current Plan</span>
            <span className={styles.currentPlanName}>{currentPlan?.name || 'Free'}</span>
            <span className={styles.currentPlanPrice}>
              {currentPlan?.priceMonthyCents === 0
                ? 'Free forever'
                : `${formatPrice(currentPlan?.priceMonthyCents || 0)}/month`}
            </span>
          </div>
          <span className={`${styles.planBadge} ${getPlanBadgeClass(currentPlan?.name || 'Free')}`}>
            Active
          </span>
        </div>

        {/* Pricing Cards */}
        <div className={styles.pricingGrid}>
          {sortedPlans.map((plan) => {
            const isCurrentPlan = currentPlan?.id === plan.id;
            const isPro = plan.name.toLowerCase() === 'pro';
            const isEnterprise = plan.name.toLowerCase() === 'enterprise';

            return (
              <div
                key={plan.id}
                className={`${styles.pricingCard} ${isCurrentPlan ? styles.pricingCardActive : ''} ${isPro ? styles.pricingCardPopular : ''}`}
              >
                {isPro && <span className={styles.popularTag}>Most Popular</span>}

                <h3 className={styles.planName}>{plan.name}</h3>
                <div className={styles.planPrice}>
                  {isEnterprise ? 'Custom' : formatPrice(plan.priceMonthyCents)}
                  {!isEnterprise && <span>/mo</span>}
                </div>
                <p className={styles.planDesc}>
                  {plan.name === 'Free'
                    ? 'For exploring the platform and running minor manual extractions.'
                    : isPro
                      ? 'For teams and growth agencies requiring persistent crawling pipelines.'
                      : 'For large scale operations demanding high capacity and custom scrapers.'}
                </p>

                <div className={styles.planDivider} />

                <ul className={styles.planFeatures}>
                  <li className={styles.planFeature}>
                    {CHECK_ICON}
                    {formatNumber(plan.maxLeadsMonthly)} leads/month
                  </li>
                  <li className={styles.planFeature}>
                    {CHECK_ICON}
                    {formatNumber(plan.maxJobsMonthly)} jobs/month
                  </li>
                  <li className={styles.planFeature}>
                    {CHECK_ICON}
                    {formatNumber(plan.maxPagesPerJob)} pages per job
                  </li>
                  <li className={styles.planFeature}>
                    {CHECK_ICON}
                    {plan.maxConcurrentJobs} concurrent jobs
                  </li>
                  {plan.llmEnabled && (
                    <li className={styles.planFeature}>
                      {CHECK_ICON}
                      AI-Powered Extraction
                    </li>
                  )}
                </ul>

                {isCurrentPlan ? (
                  <div className={styles.currentPlanBtn}>Current Plan</div>
                ) : isEnterprise ? (
                  <a
                    href={getWhatsAppUrl('Enterprise (Custom)')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.enterpriseBtn}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.39 0-4.597-.77-6.396-2.078l-.447-.335-3.105 1.041 1.041-3.105-.335-.447A9.955 9.955 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/>
                    </svg>
                    Contact Sales
                  </a>
                ) : (
                  <a
                    href={getWhatsAppUrl(plan.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.whatsappBtn}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.39 0-4.597-.77-6.396-2.078l-.447-.335-3.105 1.041 1.041-3.105-.335-.447A9.955 9.955 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/>
                    </svg>
                    Contact to Upgrade
                  </a>
                )}
              </div>
            );
          })}
        </div>

        {/* Info Box */}
        <div className={styles.infoBox}>
          <svg className={styles.infoIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div className={styles.infoText}>
            <strong>How to upgrade:</strong> Click the &quot;Contact to Upgrade&quot; button on your desired plan.
            You&apos;ll be connected with our support team on WhatsApp who will process your upgrade
            and activate your new plan within minutes.
          </div>
        </div>
      </div>
    </div>
  );
}
