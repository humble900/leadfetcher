'use client';

import React from 'react';
import Link from 'next/link';
import styles from './UpgradePrompt.module.css';

interface UpgradePromptProps {
  limitName: string;
  used: number;
  limit: number;
  onClose: () => void;
  userEmail?: string;
}

const WHATSAPP_NUMBER = '14094229714';

export default function UpgradePrompt({ limitName, used, limit, onClose, userEmail }: UpgradePromptProps) {
  const message = encodeURIComponent(
    `Hi, I've reached my ${limitName} limit on LeadFetcher and would like to upgrade my plan. My account email is ${userEmail || 'N/A'}. Current usage: ${used}/${limit}.`
  );
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className={styles.iconContainer}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>

        <h3 className={styles.title}>Plan Limit Reached</h3>
        <p className={styles.description}>
          You&apos;ve reached your monthly {limitName} limit. Upgrade your plan to continue
          using LeadFetcher without interruption.
        </p>

        <div className={styles.limitInfo}>
          <span className={styles.limitLabel}>{limitName}</span>
          <span className={styles.limitValue}>
            {used.toLocaleString()} / {limit.toLocaleString()} (100%)
          </span>
        </div>

        <div className={styles.actions}>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.whatsappBtn}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.39 0-4.597-.77-6.396-2.078l-.447-.335-3.105 1.041 1.041-3.105-.335-.447A9.955 9.955 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/>
            </svg>
            Contact Support on WhatsApp
          </a>

          <Link href="/settings" className={styles.viewPlansBtn} onClick={onClose}>
            View All Plans
          </Link>
        </div>
      </div>
    </div>
  );
}
