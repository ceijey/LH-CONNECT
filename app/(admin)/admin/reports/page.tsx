'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import UnreadMessagesBadge from '@/app/components/UnreadMessagesBadge';
import Toast from '@/app/components/Toast';
import { logoutAndRedirect } from '@/lib/auth-session';
import { useAuthPageshow } from '@/lib/useAuthPageshow';
import styles from '../residents/admin-page.module.css';

interface ReportData {
  block: string;
  lot: string;
  resident: string;
  monthlyDues: number;
  amountPaid: number;
  balance: number;
  status: 'Paid' | 'Pending' | 'Delinquent';
}

export default function AdminReports() {
  const router = useRouter();
  useAuthPageshow('admin');
  const [isLoading, setIsLoading] = useState(true);
  const [activeNav, setActiveNav] = useState('reports');
  const [selectedMonth, setSelectedMonth] = useState('February 2026');
  const [selectedReportType, setSelectedReportType] = useState('Monthly Report');
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [isToastVisible, setIsToastVisible] = useState(false);

  const financialData: ReportData[] = [
    { block: '1', lot: '15', resident: 'Juan dela Cruz', monthlyDues: 500, amountPaid: 500, balance: 0, status: 'Paid' },
    { block: '2', lot: '8', resident: 'Maria Santos', monthlyDues: 500, amountPaid: 500, balance: 0, status: 'Paid' },
    { block: '3', lot: '22', resident: 'Pedro Reyes', monthlyDues: 500, amountPaid: 0, balance: 3500, status: 'Delinquent' },
    { block: '4', lot: '3', resident: 'Ana Gomez', monthlyDues: 500, amountPaid: 500, balance: 0, status: 'Paid' },
    { block: '2', lot: '19', resident: 'Carlos Mendoza', monthlyDues: 500, amountPaid: 0, balance: 1000, status: 'Pending' },
  ];

  const totalDues = financialData.reduce((sum, d) => sum + d.monthlyDues, 0);
  const totalCollected = financialData.reduce((sum, d) => sum + d.amountPaid, 0);
  const outstandingBalance = financialData.reduce((sum, d) => sum + d.balance, 0);
  const collectionRate = totalDues > 0 ? ((totalCollected / totalDues) * 100).toFixed(1) : '0';

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setIsToastVisible(true);
  };

  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    const userRole = localStorage.getItem('userRole');

    if (!isAuthenticated || userRole !== 'admin') {
      router.replace('/login');
    } else {
      setIsLoading(false);
    }
  }, [router]);

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await logoutAndRedirect(router, '/');
    }
  };

  const handleExportPDF = () => {
    showToast('Exporting report as PDF...', 'info');
  };

  const handleExportExcel = () => {
    showToast('Exporting report as Excel...', 'info');
  };

  if (isLoading) return <div className={styles.loading}>Loading...</div>;

  return (
    <div className={styles.container}>
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={isToastVisible}
        onClose={() => setIsToastVisible(false)}
      />
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
          <Link href="/admin/payments" className={styles.navItem} onClick={() => setActiveNav('payments')}>
            <span>💳</span> Payments
          </Link>
          <Link href="/admin/qr-scanner" className={styles.navItem} onClick={() => setActiveNav('qr-scanner')}>
            <span>📱</span> QR Scanner
          </Link>
          <Link href="/admin/messages" className={styles.navItem} onClick={() => setActiveNav('messages')}>
            <span>💬</span> Messages
            <UnreadMessagesBadge />
          </Link>
          <Link href="/admin/reports" className={`${styles.navItem} ${activeNav === 'reports' ? styles.active : ''}`} onClick={() => setActiveNav('reports')}>
            <span>📑</span> Reports
          </Link>
        </nav>
        <button className={styles.logoutBtn} onClick={handleLogout}>🚪 Logout</button>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.pageTitle}>Auto-Generated Reports</h1>
          <div className={styles.headerRight}>
            <span className={styles.userLabel}>Admin User</span>
            <div className={styles.userAvatar}>👤</div>
          </div>
        </header>

        <div className={styles.content}>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '15px', flex: 1 }}>
              <select 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{
                  padding: '10px 15px',
                  border: '2px solid #E0E0E0',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  backgroundColor: '#fff',
                  color: '#1B2A4A',
                  fontWeight: 500
                }}
              >
                <option>January 2026</option>
                <option>February 2026</option>
                <option>March 2026</option>
              </select>
              <select 
                value={selectedReportType}
                onChange={(e) => setSelectedReportType(e.target.value)}
                style={{
                  padding: '10px 15px',
                  border: '2px solid #E0E0E0',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  backgroundColor: '#fff',
                  color: '#1B2A4A',
                  fontWeight: 500
                }}
              >
                <option>Daily Report</option>
                <option>Monthly Report</option>
                <option>Annual Report</option>
                <option>Delinquency Report</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={handleExportPDF}
                style={{
                  background: '#1B2A4A',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                ⬇ Export PDF
              </button>
              <button 
                onClick={handleExportExcel}
                style={{
                  background: '#1B2A4A',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                ⬇ Export Excel
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '30px' }}>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
              <div style={{ fontSize: '0.85rem', color: '#9E9E9E', marginBottom: '10px' }}>Total Dues</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1B2A4A' }}>₱{totalDues.toLocaleString()}</div>
            </div>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
              <div style={{ fontSize: '0.85rem', color: '#9E9E9E', marginBottom: '10px' }}>Total Collected</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2e7d32' }}>₱{totalCollected.toLocaleString()}</div>
            </div>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
              <div style={{ fontSize: '0.85rem', color: '#9E9E9E', marginBottom: '10px' }}>Outstanding Balance</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#d32f2f' }}>₱{outstandingBalance.toLocaleString()}</div>
            </div>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
              <div style={{ fontSize: '0.85rem', color: '#9E9E9E', marginBottom: '10px' }}>Collection Rate</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1976d2' }}>{collectionRate}%</div>
            </div>
          </div>

          <div style={{ background: '#fff', padding: '30px', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
            <h2 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.1rem', fontWeight: 600, color: '#1B2A4A' }}>{selectedReportType} - {selectedMonth}</h2>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Block/Lot</th>
                    <th>Resident Name</th>
                    <th>Monthly Dues</th>
                    <th>Amount Paid</th>
                    <th>Balance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {financialData.map((row, idx) => (
                    <tr key={idx}>
                      <td>Blk {row.block} Lot {row.lot}</td>
                      <td>{row.resident}</td>
                      <td>₱{row.monthlyDues}</td>
                      <td style={{ color: row.amountPaid > 0 ? '#2e7d32' : '#000' }}>₱{row.amountPaid}</td>
                      <td style={{ color: row.balance > 0 ? '#d32f2f' : '#000' }}>₱{row.balance}</td>
                      <td>
                        <span style={{
                          padding: '0.3rem 0.8rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: row.status === 'Paid' ? '#e8f5e9' : row.status === 'Pending' ? '#fff3e0' : '#ffebee',
                          color: row.status === 'Paid' ? '#2e7d32' : row.status === 'Pending' ? '#f57c00' : '#d32f2f'
                        }}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 'bold', borderTop: '2px solid #e0e0e0', background: '#fafafa' }}>
                    <td colSpan={2}>TOTAL</td>
                    <td>₱{totalDues.toLocaleString()}</td>
                    <td style={{ color: '#2e7d32' }}>₱{totalCollected.toLocaleString()}</td>
                    <td style={{ color: '#d32f2f' }}>₱{outstandingBalance.toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
