'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { logoutAndRedirect } from '@/lib/auth-session';
import styles from './PendingApproval.module.css';
import { useState } from 'react';

export default function PendingApprovalPage() {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate checking status
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Image 
            src="/lhhoa-logo.png" 
            alt="LHHOA Logo" 
            width={64} 
            height={64} 
            priority 
            style={{ marginBottom: '8px' }}
          />
          <div className={styles.brand}>LH-Connect</div>
          
          <div className={styles.statusIconContainer}>
            <div className={styles.pulse}></div>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          
          <h1 className={styles.title}>Account pending HOA approval</h1>
        </div>

        <div className={styles.content}>
          <p className={styles.description}>
            Your account has been successfully created, but it is not active yet. 
            An HOA admin needs to verify your residency details.
          </p>
          <p className={styles.subtext}>
            If you need to speed things up, you can contact the HOA office directly 
            to confirm your unit details.
          </p>
        </div>

        <div className={styles.steps}>
          <div className={`${styles.step} ${styles.completed}`}>
            <div className={styles.stepIndicator}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <span>Account Registration Completed</span>
          </div>
          <div className={`${styles.step} ${styles.active}`}>
            <div className={styles.stepIndicator}>2</div>
            <span>HOA Admin Verification In Progress</span>
          </div>
          <div className={styles.step}>
            <div className={styles.stepIndicator}>3</div>
            <span>Access Resident Dashboard</span>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            onClick={handleRefresh}
            className={styles.primaryButton}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <>
                <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/>
                </svg>
                Checking Status...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
                </svg>
                Refresh Status
              </>
            )}
          </button>
          
          <button
            onClick={async () => {
              await logoutAndRedirect(router, '/login');
            }}
            className={styles.secondaryButton}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}