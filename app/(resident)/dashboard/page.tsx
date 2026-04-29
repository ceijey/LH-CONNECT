'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { QRCodeCanvas } from 'qrcode.react';
import ConfirmationModal from '@/app/components/ConfirmationModal';
import { apiCall } from '@/lib/api-client';
import { logoutAndRedirect } from '@/lib/auth-session';
import { useAuthPageshow } from '@/lib/useAuthPageshow';
import styles from './dashboard.module.css';

interface PaymentRecord {
  month: string;
  date: string;
  amount: number;
  status: 'Paid' | 'Pending';
}

interface UserProfile {
  fullName?: string;
  phase?: string;
  block?: string;
  lot?: string;
  balance?: number;
}

export default function DashboardPage() {
  const router = useRouter();
  useAuthPageshow('resident');
  const [userName, setUserName] = useState<string>('Resident');
  const [profile, setProfile] = useState<UserProfile>({});
  const [userId, setUserId] = useState<string>('LH-Connect Resident');
  const [isLoading, setIsLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const currentBalance = profile.balance ?? 0;
  const nextDueDate = 'March 1, 2026';
  const monthlyDues = 500;
  const qrCode = userId;
  
  const paymentHistory: PaymentRecord[] = [
    { month: 'February 2026', date: 'Feb 22, 2026', amount: 500, status: 'Paid' },
    { month: 'January 2026', date: 'Jan 20, 2026', amount: 500, status: 'Paid' },
    { month: 'December 2025', date: 'Dec 18, 2025', amount: 500, status: 'Paid' },
  ];

  useEffect(() => {
    const loadResidentProfile = async () => {
      try {
        setUserId(localStorage.getItem('userId') ?? 'LH-Connect Resident');
        const profilePayload = await apiCall('/api/auth/profile');
        const userProfile = (profilePayload.user ?? {}) as UserProfile;
        setProfile(userProfile);
        setUserName(userProfile.fullName ?? localStorage.getItem('userName') ?? 'Resident');
      } catch {
        setUserName(localStorage.getItem('userName') ?? 'Resident');
      } finally {
        setIsLoading(false);
      }
    };

    loadResidentProfile();
  }, [router]);



  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    await logoutAndRedirect(router, '/');
  };

  if (isLoading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={styles.container}>
      <ConfirmationModal
        isOpen={showLogoutModal}
        title="Logout Confirmation"
        message="Are you sure you want to logout? You will be redirected to the login page."
        confirmText="Logout"
        cancelText="Cancel"
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutModal(false)}
        isDangerous={true}
      />

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
              <p className={styles.logoSubtext}>Resident Portal</p>
            </div>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            ⬅ Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        {/* Welcome Section */}
        <section className={styles.welcomeSection}>
          <h2 className={styles.welcomeTitle}>Welcome back, {userName}!</h2>
          <p className={styles.residentInfo}>
            {profile.phase ? `${profile.phase} ` : ''}
            {profile.block ? `Blk ${profile.block} ` : ''}
            {profile.lot ? `Lot ${profile.lot}` : ''}
          </p>
        </section>

        {/* Info Cards Grid */}
        <div className={styles.infoGrid}>
          {/* Current Balance Card */}
          <div className={styles.infoCard}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Current Balance</span>
              <span className={styles.infoIcon}>ℹ️</span>
            </div>
            <div className={styles.cardContent}>
              <div className={styles.amount}>₱{currentBalance}</div>
              <p className={styles.cardSubtext}>All caught up! 🎉</p>
            </div>
          </div>

          {/* Next Due Date Card */}
          <div className={styles.infoCard}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Next Due Date</span>
              <span className={styles.dateIcon}>📅</span>
            </div>
            <div className={styles.cardContent}>
              <div className={styles.dueDate}>{nextDueDate}</div>
              <p className={styles.cardSubtext}>Monthly Dues: ₱{monthlyDues}</p>
            </div>
          </div>

          {/* QR Code Card */}
          <div className={styles.infoCard}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Your QR Code</span>
              <span className={styles.qrIcon}>📱</span>
            </div>
            <div className={styles.qrCodeContainer}>
              <div className={styles.qrCodeWrapper}>
                <QRCodeCanvas 
                  value={qrCode} 
                  size={150}
                  level="H"
                  includeMargin={true}
                  fgColor="#1B2A4A"
                  bgColor="#ffffff"
                />
              </div>
              <p className={styles.qrText}>{qrCode}</p>
            </div>
          </div>
        </div>

        {/* Action Cards */}
        <div className={styles.actionGrid}>
          <Link href="/dashboard/submit-payment" className={styles.actionCard}>
            <div className={styles.actionIcon}>💳</div>
            <h3 className={styles.actionTitle}>Submit Payment</h3>
            <p className={styles.actionDesc}>Upload proof of payment</p>
          </Link>

          <Link href="/dashboard/contact-hoa" className={styles.actionCard}>
            <div className={styles.actionIcon}>💬</div>
            <h3 className={styles.actionTitle}>Contact HOA</h3>
            <p className={styles.actionDesc}>Send a message</p>
          </Link>

          <Link href="/dashboard/view-statements" className={styles.actionCard}>
            <div className={styles.actionIcon}>📋</div>
            <h3 className={styles.actionTitle}>View Statements</h3>
            <p className={styles.actionDesc}>Download billing history</p>
          </Link>
        </div>

        {/* Payment History */}
        <section className={styles.paymentSection}>
          <h2 className={styles.sectionTitle}>Recent Payment History</h2>
          <div className={styles.paymentList}>
            {paymentHistory.map((payment, index) => (
              <div key={index} className={styles.paymentItem}>
                <div className={styles.paymentInfo}>
                  <div className={styles.paymentMonth}>{payment.month}</div>
                  <div className={styles.paymentDate}>{payment.date}</div>
                </div>
                <div className={styles.paymentAmount}>
                  <span className={styles.amount}>₱{payment.amount}</span>
                  <span className={`${styles.status} ${styles[payment.status.toLowerCase()]}`}>
                    {payment.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <Link href="/dashboard/transactions">
            <button className={styles.viewAllBtn}>View All Transactions</button>
          </Link>
        </section>
      </main>
    </div>
  );
}