'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../residents/admin-page.module.css';

interface Payment {
  id: string;
  resident: string;
  phase: string;
  block: string;
  lot: string;
  amount: number;
  date: string;
  time: string;
  method: string;
  status: 'Verified' | 'Pending' | 'Rejected';
}

export default function AdminPayments() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [activeNav, setActiveNav] = useState('payments');
  const [activeTab, setActiveTab] = useState<'Pending' | 'Verified' | 'Rejected'>('Pending');

  const allPayments: Payment[] = [
    { id: 'P001', resident: 'Maria Santos', phase: 'Phase 2', block: '2', lot: '8', amount: 500, date: '2026-02-23', time: '10:30 AM', method: 'GCash', status: 'Pending' },
    { id: 'P002', resident: 'Carlos Mendoza', phase: 'Phase 3', block: '3', lot: '19', amount: 1000, date: '2026-02-23', time: '10:15 AM', method: 'Maya', status: 'Pending' },
    { id: 'P003', resident: 'Ana Gomez', phase: 'Phase 3', block: '2', lot: '3', amount: 500, date: '2026-02-22', time: '03:45 PM', method: 'GCash', status: 'Pending' },
    { id: 'P004', resident: 'Juan Dela Cruz', phase: 'Phase 1', block: '1', lot: '15', amount: 500, date: 'Feb 22, 2026', time: '02:30 PM', method: 'GCash', status: 'Verified' },
    { id: 'P005', resident: 'Sofia Ruiz', phase: 'Phase 3', block: '2', lot: '20', amount: 500, date: 'Feb 21, 2026', time: '11:20 AM', method: 'Bank Transfer', status: 'Verified' },
    { id: 'P006', resident: 'Luis Lopez', phase: 'Phase 1', block: '1', lot: '5', amount: 1500, date: 'Feb 20, 2026', time: '04:10 PM', method: 'Maya', status: 'Rejected' },
  ];

  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    const userRole = localStorage.getItem('userRole');

    if (!isAuthenticated || userRole !== 'admin') {
      router.push('/login');
    } else {
      setIsLoading(false);
    }
  }, [router]);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userName');
      localStorage.removeItem('userRole');
      router.push('/');
    }
  };

  const filteredPayments = allPayments.filter(p => p.status === activeTab);
  const pendingCount = allPayments.filter(p => p.status === 'Pending').length;
  const verifiedCount = allPayments.filter(p => p.status === 'Verified').length;
  const rejectedCount = allPayments.filter(p => p.status === 'Rejected').length;

  if (isLoading) return <div className={styles.loading}>Loading...</div>;

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🏠</span>
            <div>
              <div className={styles.logoText}>LH-Connect</div>
              <div className={styles.logoSubtext}>Admin</div>
            </div>
          </div>
        </div>
        <nav className={styles.nav}>
          <Link href="/admin/dashboard" className={styles.navItem} onClick={() => setActiveNav('dashboard')}>
            <span>📊</span> Dashboard
          </Link>
          <Link href="/admin/residents" className={styles.navItem} onClick={() => setActiveNav('residents')}>
            <span>👥</span> Residents
          </Link>
          <Link href="/admin/payments" className={`${styles.navItem} ${activeNav === 'payments' ? styles.active : ''}`} onClick={() => setActiveNav('payments')}>
            <span>💳</span> Payments
          </Link>
          <Link href="/admin/qr-scanner" className={styles.navItem} onClick={() => setActiveNav('qr-scanner')}>
            <span>📱</span> QR Scanner
          </Link>
          <Link href="/admin/messages" className={styles.navItem} onClick={() => setActiveNav('messages')}>
            <span>💬</span> Messages
          </Link>
          <Link href="/admin/reports" className={styles.navItem} onClick={() => setActiveNav('reports')}>
            <span>📑</span> Reports
          </Link>
        </nav>
        <button className={styles.logoutBtn} onClick={handleLogout}>🚪 Logout</button>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.pageTitle}>Payment Verification - 60-Second Proof-of-Payment</h1>
          <div className={styles.headerRight}>
            <span className={styles.userLabel}>Admin User</span>
            <div className={styles.userAvatar}>👤</div>
          </div>
        </header>

        <div className={styles.content}>
          {/* Tabs */}
          <div className={styles.tabsContainer}>
            <button 
              className={`${styles.tab} ${activeTab === 'Pending' ? styles.active : ''}`}
              onClick={() => setActiveTab('Pending')}
            >
              ⏳ Pending ({pendingCount})
            </button>
            <button 
              className={`${styles.tab} ${activeTab === 'Verified' ? styles.active : ''}`}
              onClick={() => setActiveTab('Verified')}
            >
              ✓ Verified
            </button>
            <button 
              className={`${styles.tab} ${activeTab === 'Rejected' ? styles.active : ''}`}
              onClick={() => setActiveTab('Rejected')}
            >
              ✕ Rejected
            </button>
          </div>

          <div className={styles.sectionTitle}>
            {activeTab === 'Pending' && '⏳ Pending Payment Verifications'}
            {activeTab === 'Verified' && '✓ Verified Payments'}
            {activeTab === 'Rejected' && '✕ Rejected Payments'}
          </div>
          
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Payment ID</th>
                  <th>Resident</th>
                  <th>Block/Lot</th>
                  <th>Amount</th>
                  <th>Date/Time</th>
                  <th>Method</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td className={styles.paymentId}>{payment.id}</td>
                    <td className={styles.resident}>{payment.resident}</td>
                    <td><span className={styles.phaseBadge}>{payment.phase}</span> Blk {payment.block} Lot {payment.lot}</td>
                    <td className={styles.amount}>₱{payment.amount}</td>
                    <td className={styles.datetime}>
                      <div>{payment.date}</div>
                      <div className={styles.time}>{payment.time}</div>
                    </td>
                    <td>{payment.method}</td>
                    <td className={styles.paymentActions}>
                      <button className={styles.viewProofBtn} title="View Proof">👁️ View Proof</button>
                      {activeTab === 'Pending' && (
                        <>
                          <button className={styles.approveBtn} title="Approve">✓</button>
                          <button className={styles.rejectBtn} title="Reject">✕</button>
                        </>
                      )}
                      <button className={styles.deleteBtn} title="Delete">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
