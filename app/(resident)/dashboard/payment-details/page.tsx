'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { apiCall } from '@/lib/api-client';
import { logoutAndRedirect } from '@/lib/auth-session';
import { useAuthPageshow } from '@/lib/useAuthPageshow';
import styles from './payment-details.module.css';

interface UserProfile {
  fullName?: string;
  phase?: string;
  block?: string;
  lot?: string;
  balance?: number;
}

export default function PaymentDetailsPage() {
  const router = useRouter();
  useAuthPageshow('resident');
  const [profile, setProfile] = useState<UserProfile>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profilePayload = await apiCall('/api/auth/profile');
        setProfile(profilePayload.user ?? {});
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleLogout = async () => {
    await logoutAndRedirect(router, '/');
  };

  const dueAmount = profile.balance ?? 0;
  const currentMonth = new Date().toLocaleString(undefined, { month: 'long', year: 'numeric' });

  if (isLoading) {
    return <div className={styles.loading}>Loading payment details...</div>;
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.logo}>
            <Image
              src="/lhhoa-logo.png"
              alt="LHHOA Logo"
              width={50}
              height={50}
              className={styles.logoIcon}
              priority
            />
            <div>
              <h1 className={styles.logoText}>LH-Connect</h1>
              <p className={styles.logoSubtext}>Payment Details</p>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.logoutBtn} onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        <div className={styles.contentWrapper}>
          {/* Back Button */}
          <button className={styles.backBtn} onClick={() => router.back()}>
            ← Back
          </button>

          {/* Payment Details Card */}
          <div className={styles.detailsCard}>
            <div className={styles.cardHeader}>
              <h2>Payment Due</h2>
              <span className={styles.statusBadge}>Due This Month</span>
            </div>

            {/* Amount Section */}
            <div className={styles.amountSection}>
              <div className={styles.amountLabel}>Amount Due</div>
              <div className={styles.amount}>₱{dueAmount.toLocaleString()}</div>
              <div className={styles.month}>{currentMonth}</div>
            </div>

            {/* Property Information */}
            <div className={styles.propertyInfo}>
              <h3>Property Information</h3>
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <label>Name:</label>
                  <span>{profile.fullName || 'N/A'}</span>
                </div>
                <div className={styles.infoItem}>
                  <label>Phase:</label>
                  <span>{profile.phase || 'N/A'}</span>
                </div>
                <div className={styles.infoItem}>
                  <label>Block:</label>
                  <span>{profile.block || 'N/A'}</span>
                </div>
                <div className={styles.infoItem}>
                  <label>Lot:</label>
                  <span>{profile.lot || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Payment Instructions */}
            <div className={styles.instructions}>
              <h3>Payment Instructions</h3>
              <ol>
                <li>Click the "Pay Now" button below</li>
                <li>Select your preferred payment method</li>
                <li>Enter your payment reference number</li>
                <li>Upload proof of payment</li>
                <li>Submit for verification</li>
              </ol>
            </div>

            {/* Divider */}
            <hr className={styles.divider} />

            {/* Important Notice */}
            <div className={styles.notice}>
              <strong>⚠️ Important:</strong> Please keep your payment proof/receipt for your records. Our admin team will verify your payment within 1-2 business days.
            </div>
          </div>

          {/* Action Buttons */}
          <div className={styles.actionButtons}>
            <button className={styles.secondaryBtn} onClick={() => router.push('/dashboard')}>
              Back to Dashboard
            </button>
            <Link href="/dashboard/submit-payment" className={styles.payNowBtn}>
              Pay Now
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
