'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import UnreadMessagesBadge from '@/app/components/UnreadMessagesBadge';
import { logoutAndRedirect } from '@/lib/auth-session';
import { useAuthPageshow } from '@/lib/useAuthPageshow';
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
  useAuthPageshow('admin');
  const [isLoading, setIsLoading] = useState(true);
  const [activeNav, setActiveNav] = useState('payments');
  const [activeTab, setActiveTab] = useState<'Pending' | 'Verified' | 'Rejected'>('Pending');
  const [searchTerm, setSearchTerm] = useState('');

  // State to hold real payments fetched from the API (replaces mock data)
  const [allPayments, setAllPayments] = useState<Payment[]>([]);

  useEffect(() => {
    let mounted = true;

    async function loadPayments() {
      try {
        const res = await fetch('/api/payments', { credentials: 'include' });
        if (!res.ok) {
          console.error('Failed to load payments', res.status);
          setAllPayments([]);
          return;
        }

        const data = await res.json();
        // API returns { payments, user }
        if (mounted && Array.isArray(data.payments)) {
          setAllPayments(data.payments as Payment[]);
        }
      } catch (err) {
        console.error('Error fetching payments:', err);
        setAllPayments([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadPayments();

    return () => { mounted = false; };
  }, [router]);

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await logoutAndRedirect(router, '/');
    }
  };

  const filteredPayments = allPayments.filter((payment) => {
    const matchesStatus = payment.status === activeTab;
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return matchesStatus;
    }

    const matchesSearch = [
      payment.id,
      payment.resident,
      payment.phase,
      `blk ${payment.block} lot ${payment.lot}`,
      payment.method,
      payment.date,
    ].some((value) => value.toLowerCase().includes(normalizedSearch));

    return matchesStatus && matchesSearch;
  });
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
          <Link href="/admin/dashboard" className={styles.navItem} onClick={(e) => { e.preventDefault(); setActiveNav('dashboard'); router.push('/admin/dashboard'); }}>
            <span>📊</span> Dashboard
          </Link>
          <Link href="/admin/residents" className={styles.navItem} onClick={(e) => { e.preventDefault(); setActiveNav('residents'); router.push('/admin/residents'); }}>
            <span>👥</span> Residents
          </Link>
          <Link href="/admin/payments" className={`${styles.navItem} ${activeNav === 'payments' ? styles.active : ''}`} onClick={(e) => { e.preventDefault(); setActiveNav('payments'); router.push('/admin/payments'); }}>
            <span>💳</span> Payments
          </Link>
          <Link href="/admin/qr-scanner" className={styles.navItem} onClick={(e) => { e.preventDefault(); setActiveNav('qr-scanner'); router.push('/admin/qr-scanner'); }}>
            <span>📱</span> QR Scanner
          </Link>
          <Link href="/admin/messages" className={styles.navItem} onClick={(e) => { e.preventDefault(); setActiveNav('messages'); router.push('/admin/messages'); }}>
            <span>💬</span> Messages
            <UnreadMessagesBadge />
          </Link>
          <Link href="/admin/reports" className={styles.navItem} onClick={(e) => { e.preventDefault(); setActiveNav('reports'); router.push('/admin/reports'); }}>
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
          <div className={styles.controlsSection} style={{ marginBottom: '20px' }}>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by resident, payment ID, block, lot, method, or date"
              className={styles.filterSelect}
              style={{ width: '100%', maxWidth: '420px' }}
            />
          </div>

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
              ✓ Verified ({verifiedCount})
            </button>
            <button 
              className={`${styles.tab} ${activeTab === 'Rejected' ? styles.active : ''}`}
              onClick={() => setActiveTab('Rejected')}
            >
              ✕ Rejected ({rejectedCount})
            </button>
          </div>

          <div className={styles.sectionTitle}>
            {activeTab === 'Pending' && '⏳ Pending Payment Verifications'}
            {activeTab === 'Verified' && '✓ Verified Payments'}
            {activeTab === 'Rejected' && '✕ Rejected Payments'}
          </div>

          {searchTerm && (
            <div style={{ marginBottom: '12px', color: '#666', fontSize: '0.95rem' }}>
              Showing {filteredPayments.length} result{filteredPayments.length === 1 ? '' : 's'} for "{searchTerm.trim()}"
            </div>
          )}
          
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
                {filteredPayments.length > 0 ? (
                  filteredPayments.map((payment) => (
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
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
                      No payments match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
