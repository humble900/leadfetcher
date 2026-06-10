'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '../../components/layout/AuthContext';
import styles from '../../components/auth/Auth.module.css';

function getPasswordStrength(password: string): { level: 'weak' | 'medium' | 'strong'; segments: number } {
  if (!password) return { level: 'weak', segments: 0 };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { level: 'weak', segments: 1 };
  if (score <= 3) return { level: 'medium', segments: 2 };
  return { level: 'strong', segments: 3 };
}

export default function RegisterPage() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [organizationName, setOrganizationName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const strengthColorClass = {
    weak: styles.strengthSegmentWeak,
    medium: styles.strengthSegmentMedium,
    strong: styles.strengthSegmentStrong,
  }[strength.level];

  const strengthTextClass = {
    weak: styles.strengthTextWeak,
    medium: styles.strengthTextMedium,
    strong: styles.strengthTextStrong,
  }[strength.level];

  const strengthLabels = { weak: 'Weak password', medium: 'Fair password', strong: 'Strong password' };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name || !email || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        name,
        email,
        password,
        organizationName: organizationName || undefined,
      });
    } catch (err: any) {
      setError(err.message || 'Registration failed. Email may already be in use.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>LF</div>
          <h2 className={styles.title}>Create your account</h2>
          <p className={styles.subtitle}>Get started with LeadFetcher today</p>
        </div>

        {error && (
          <div className={styles.generalError}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="reg-name" className={styles.label}>Full Name *</label>
            <input
              id="reg-name"
              type="text"
              className="form-input"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              required
              autoComplete="name"
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="reg-email" className={styles.label}>Email Address *</label>
            <input
              id="reg-email"
              type="email"
              className="form-input"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              required
              autoComplete="email"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="reg-org" className={styles.label}>Company / Workspace Name</label>
            <input
              id="reg-org"
              type="text"
              className="form-input"
              placeholder="Acme Corp"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              disabled={isSubmitting}
              autoComplete="organization"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="reg-password" className={styles.label}>Password * (min. 8 characters)</label>
            <div className={styles.passwordWrapper}>
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                required
                minLength={8}
                autoComplete="new-password"
              />
              <button
                type="button"
                className={styles.eyeToggle}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            {/* Password strength indicator */}
            {password.length > 0 && (
              <>
                <div className={styles.strengthBar}>
                  {[1, 2, 3].map((seg) => (
                    <div
                      key={seg}
                      className={`${styles.strengthSegment} ${seg <= strength.segments ? strengthColorClass : ''}`}
                    />
                  ))}
                </div>
                <span className={`${styles.strengthText} ${strengthTextClass}`}>
                  {strengthLabels[strength.level]}
                </span>
              </>
            )}
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', marginTop: '8px', padding: '12px 20px' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Creating account…
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <p className={styles.footerText}>
          Already have an account?{' '}
          <Link href="/login" className={styles.link}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
