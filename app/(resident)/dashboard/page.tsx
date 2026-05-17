'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { QRCodeCanvas } from 'qrcode.react';
import ConfirmationModal from '@/app/components/ConfirmationModal';
import { apiCall } from '@/lib/api-client';
import { logoutAndRedirect } from '@/lib/auth-session';
import { useAuthPageshow } from '@/lib/useAuthPageshow';
import LoadingScreen from '@/app/components/LoadingScreen';
import styles from './dashboard.module.css';

interface PaymentRecord {
  id?: string;
  amount: number;
  createdAt?: any;
  status?: string;
  method?: string;
  reference?: string;
  residentId?: string;
  month?: string;
  verifiedDate?: string;
  submittedDate?: string;
  verifiedAt?: any;
  rejectionReason?: string;
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
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const [nextDueDateStr, setNextDueDateStr] = useState<string>('');
  const nextDueDate = nextDueDateStr;
  const monthlyDues = 400;
  const qrCode = userId;
  
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [statements, setStatements] = useState<any[]>([]);
  const [statementsLoading, setStatementsLoading] = useState(true);

  const currentBalance = useMemo(
    () => statements.reduce((sum, stmt) => sum + Number(stmt.balance ?? 0), 0),
    [statements]
  );

  // Unified activity log calculation
  const recentActivity = useMemo(() => {
    const events: any[] = [];
    
    statements.forEach(stmt => {
      // Add Bill Event
      events.push({
        id: `bill-${stmt.id}`,
        date: stmt.date || new Date().toISOString(),
        description: `Monthly Dues - ${stmt.month} ${stmt.year}`,
        type: 'BILL',
        amount: Number(stmt.totalDues || 0),
        status: stmt.status,
      });

      // Add Payment Events from related submissions
      if (stmt.relatedSubmissions) {
        stmt.relatedSubmissions.forEach((sub: any) => {
          events.push({
            id: `pay-${sub.id}`,
            date: sub.verifiedDate || sub.submittedDate || stmt.date,
            description: `Payment - ${stmt.month} ${stmt.year}`,
            type: 'PAYMENT',
            amount: Number(sub.paymentAmount || 0),
            status: sub.status,
          });
        });
      }
    });

    // Sort by date descending and take top 5
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  }, [statements]);

  const pendingAmount = useMemo(() => {
    let total = 0;
    statements.forEach(stmt => {
      if (stmt.relatedSubmissions) {
        stmt.relatedSubmissions.forEach((sub: any) => {
          if (sub.status === 'Pending') {
            total += Number(sub.paymentAmount || 0);
          }
        });
      }
    });
    return total;
  }, [statements]);

  const loadNotifications = async () => {
    try {
      const payload = await apiCall('/api/notifications');
      const fetchedNotifications = payload.notifications || [];
      setNotifications(fetchedNotifications);
    } catch (e) {
      console.error('Failed to load notifications:', e);
    }
  };

  useEffect(() => {
    const loadResidentProfile = async () => {
      try {
        setUserId(localStorage.getItem('userId') ?? 'LH-Connect Resident');
        const profilePayload = await apiCall('/api/auth/profile');
        const userProfile = (profilePayload.user ?? {}) as UserProfile;
        setProfile(userProfile);
        setUserName(userProfile.fullName ?? localStorage.getItem('userName') ?? 'Resident');
        
        // Also load notifications once profile is loaded
        loadNotifications();
      } catch {
        setUserName(localStorage.getItem('userName') ?? 'Resident');
      } finally {
        setIsLoading(false);
      }
    };

    loadResidentProfile();
  }, [router]);

  const markAsRead = async (id: string) => {
    try {
      await apiCall('/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ notificationId: id, read: true })
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (e) {
      console.error('Failed to mark notification as read:', e);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const loadPayments = async () => {
      try {
        setPaymentsLoading(true);
        const payload = await apiCall('/api/payments');
        const fetched = (payload.payments ?? []) as PaymentRecord[];
        setPayments(fetched);
      } catch (e) {
        setPayments([]);
      } finally {
        setPaymentsLoading(false);
      }
    };

    loadPayments();
  }, []);

  useEffect(() => {
    const loadStatements = async () => {
      try {
        setStatementsLoading(true);
        const payload = await apiCall('/api/statements');
        const fetched = (payload.statements ?? []) as any[];
        setStatements(fetched);

        const now = Date.now();
        const unpaid = fetched.filter((s) => {
          const balance = Number(s.balance ?? 0);
          const status = (s.status || '').toString().toLowerCase();
          return balance > 0 || status !== 'paid';
        });

        if (unpaid.length === 0) {
          setNextDueDateStr('All caught up');
        } else {
          const withDates = unpaid
            .map((s) => ({ stmt: s, time: s.dueDate ? new Date(s.dueDate).getTime() : (s.date ? new Date(s.date).getTime() : 0) }))
            .sort((a, b) => a.time - b.time);

          const next = withDates.find((w) => w.time >= now) || withDates[0];
          if (next && next.time) setNextDueDateStr(new Date(next.time).toLocaleDateString());
          else setNextDueDateStr('Due date unknown');
        }
      } catch (e) {
        setStatements([]);
        setNextDueDateStr('—');
      } finally {
        setStatementsLoading(false);
      }
    };

    loadStatements();
  }, []);

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    await logoutAndRedirect(router, '/login');
  };

  if (isLoading) {
    return <LoadingScreen message="Loading your dashboard..." />;
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
          <div className={styles.headerActions}>
            <div className={styles.notificationWrapper}>
              <button 
                className={`${styles.iconBtn} ${unreadCount > 0 ? styles.hasUnread : ''}`}
                onClick={() => setShowNotifications(!showNotifications)}
                title="Notifications"
              >
                🔔 {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
              </button>
              
              {showNotifications && (
                <div className={styles.notificationDropdown}>
                  <div className={styles.notificationHeader}>
                    <h3>Notifications</h3>
                    {unreadCount > 0 && (
                      <button 
                        className={styles.markAllRead}
                        onClick={() => {
                          notifications.filter(n => !n.read).forEach(n => markAsRead(n.id));
                        }}
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className={styles.notificationList}>
                    {notifications.length === 0 ? (
                      <div className={styles.emptyNotifications}>No notifications yet</div>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          className={`${styles.notificationItem} ${!n.read ? styles.unread : ''}`}
                          onClick={() => !n.read && markAsRead(n.id)}
                        >
                          <div className={styles.notificationTitle}>{n.title}</div>
                          <div className={styles.notificationMessage}>{n.message}</div>
                          <div className={styles.notificationTime}>
                            {new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <Link href="/dashboard/account" className={styles.accountBtn}>
              👤 My Account
            </Link>
            <button className={styles.logoutBtn} onClick={handleLogout}>
              ⬅ Logout
            </button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.welcomeSection}>
          <div className={styles.welcomeText}>
            <h2 className={styles.welcomeTitle}>Welcome back, {userName}!</h2>
            <p className={styles.residentInfo}>
              <span className={styles.locationBadge}>
                {profile.phase ? `${profile.phase}` : 'Lincoln Heights'}
              </span>
              <span className={styles.addressText}>
                {profile.block ? `Block ${profile.block} ` : ''}
                {profile.lot ? `Lot ${profile.lot}` : ''}
              </span>
            </p>
          </div>
          <div className={styles.statusQuickView}>
            <div className={`${styles.statusPill} ${currentBalance > 0 ? styles.pillDelinquent : styles.pillPaid}`}>
              {currentBalance > 0 ? '● Delinquent' : '● Up to Date'}
            </div>
          </div>
        </section>

        <div className={styles.infoGrid}>
          <div className={`${styles.infoCard} ${currentBalance > 0 ? styles.unpaidCard : ''}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>
                ACCOUNT BALANCE
              </span>
              <span className={styles.infoIcon}>{currentBalance > 0 ? '⚠️' : 'ℹ️'}</span>
            </div>
            <div className={styles.cardContent}>
              <div className={`${styles.amount} ${currentBalance > 0 ? styles.unpaidAmount : ''}`}>
                ₱{currentBalance.toLocaleString()}
              </div>
              {pendingAmount > 0 && (
                <div className={styles.pendingIndicator}>
                  (₱{pendingAmount.toLocaleString()} pending verification)
                </div>
              )}
              {currentBalance > 0 ? (
                <div className={styles.cardActions}>
                  <p className={styles.cardSubtext}>Action required to settle dues.</p>
                  <Link
                    href="/dashboard/submit-payment"
                    className={styles.payNowBtn}
                  >
                    💳 Settle Balance
                  </Link>
                </div>
              ) : (
                <p className={styles.cardSubtext}>Your account is in good standing. 🎉</p>
              )}
            </div>
          </div>

          <div className={styles.infoCard}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>NEXT BILLING</span>
              <span className={styles.dateIcon}>📅</span>
            </div>
            <div className={styles.cardContent}>
              <div className={styles.dueDate}>{nextDueDate}</div>
              <div className={styles.billDetail}>
                <span className={styles.billLabel}>Monthly Dues:</span>
                <span className={styles.billValue}>₱{monthlyDues}</span>
              </div>
              <p className={styles.cardSubtext}>Set to recur every month.</p>
            </div>
          </div>

          <div className={`${styles.infoCard} ${styles.qrIdCard}`}>
            <div className={styles.idCardHeader}>
              <div className={styles.idCardBrand}>
                <span className={styles.idCardLogo}>LH</span>
                <span className={styles.idCardTitle}>RESIDENT ID</span>
              </div>
              <span className={styles.idCardChip}></span>
            </div>
            <div className={styles.idCardBody}>
              <div className={styles.qrCodeWrapper}>
                <QRCodeCanvas 
                  value={qrCode} 
                  size={120}
                  level="H"
                  includeMargin={false}
                  fgColor="#1B2A4A"
                  bgColor="#ffffff"
                />
              </div>
              <div className={styles.idCardInfo}>
                <div className={styles.idLabel}>ID NUMBER</div>
                <div className={styles.idValue}>{userId.substring(0, 12)}...</div>
                <div className={styles.idLabel}>RESIDENT</div>
                <div className={styles.idName}>{userName}</div>
              </div>
            </div>
            <div className={styles.idCardFooter}>
              <span className={styles.idCardSecure}>🔒 SECURE DIGITAL ACCESS</span>
            </div>
          </div>
        </div>

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

        {/* Recent Activity Section */}
        <section className={styles.paymentSection}>
          <h2 className={styles.sectionTitle}>Recent Account Activity</h2>
          <div className={styles.paymentList}>
            {statementsLoading ? (
              <div className={styles.loading}>Loading activity...</div>
            ) : recentActivity.length === 0 ? (
              <div className={styles.empty}>No recent activity found.</div>
            ) : (
              recentActivity.map((event) => (
                <div key={event.id} className={styles.paymentItem}>
                  <div className={styles.paymentInfo}>
                    <div className={styles.paymentMonth}>
                      <span className={`${styles.typeBadge} ${styles[event.type.toLowerCase()]}`}>
                        {event.type}
                      </span>
                      {event.description}
                    </div>
                    <div className={styles.paymentDate}>
                      {new Date(event.date).toLocaleDateString(undefined, { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </div>
                  </div>
                  <div className={styles.paymentAmount}>
                    <span className={`${styles.amount} ${event.type === 'BILL' ? styles.billAmount : styles.payAmount}`}>
                      {event.type === 'BILL' ? '-' : '+'}₱{event.amount.toLocaleString()}
                    </span>
                    <span className={`${styles.status} ${styles[(event.status ?? 'pending').toLowerCase().replace(/\s/g, '')]}`}>
                      {event.status ?? 'Pending'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          <Link href="/dashboard/transactions">
            <button className={styles.viewAllBtn}>View All Transactions</button>
          </Link>
        </section>
      </main>
    </div>
  );
}