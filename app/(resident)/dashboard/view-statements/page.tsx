'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { logoutAndRedirect } from '@/lib/auth-session';
import { apiCall } from '@/lib/api-client';
import { useAuthPageshow } from '@/lib/useAuthPageshow';
import Toast from '@/app/components/Toast';
import LoadingScreen from '@/app/components/LoadingScreen';
import styles from './view-statements.module.css';

interface Statement {
  id: string;
  month: string;
  year: number;
  date: string;
  totalDues: number;
  amountPaid: number;
  balance: number;
  status: 'Paid' | 'Partially Paid' | 'Pending';
  fileFormat: 'PDF' | 'Excel';
  relatedSubmissions?: any[];
}

interface AuditEvent {
  id: string;
  date: string;
  description: string;
  type: 'BILL' | 'PAYMENT';
  amount: number;
  status: string;
  referenceId: string;
}

type ReportType = 'audit' | 'daily' | 'monthly' | 'annual';

export default function ViewStatementsPage() {
  const router = useRouter();
  useAuthPageshow('resident');
  const currentYear = new Date().getFullYear();
  
  const [filterYear, setFilterYear] = useState<number>(currentYear);
  const [reportType, setReportType] = useState<ReportType>('audit');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [isToastVisible, setIsToastVisible] = useState(false);

  const availableYears = useMemo(() => 
    Array.from(new Set(statements.map((s) => s.year))).sort((a, b) => b - a),
    [statements]
  );

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setIsToastVisible(true);
  };

  useEffect(() => {
    const fetchStatements = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiCall('/api/statements');
        setStatements(data.statements ?? []);
      } catch (err: any) {
        console.error('Error fetching statements:', err);
        setError(err.message || 'Failed to load statements');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatements();
  }, []);

  const auditEvents = useMemo(() => {
    const events: AuditEvent[] = [];
    
    statements.forEach(stmt => {
      // Add Bill Event
      events.push({
        id: `bill-${stmt.id}`,
        date: stmt.date,
        description: `Monthly Dues - ${stmt.month} ${stmt.year}`,
        type: 'BILL',
        amount: stmt.totalDues,
        status: stmt.status,
        referenceId: stmt.id
      });

      // Add Payment Events
      if (stmt.relatedSubmissions) {
        stmt.relatedSubmissions.forEach(sub => {
          const subDate = (sub.status === 'Verified' && sub.verifiedDate)
            ? sub.verifiedDate
            : (sub.submittedDate || stmt.date);
            
          events.push({
            id: `pay-${sub.id}`,
            date: subDate,
            description: `Payment for ${stmt.month} ${stmt.year}`,
            type: 'PAYMENT',
            amount: sub.paymentAmount,
            status: sub.status === 'Verified' ? 'Confirmed' : 'Pending Verification',
            referenceId: sub.id
          });
        });
      }
    });

    // Sort by date descending
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [statements]);

  const filteredEvents = useMemo(() => {
    return auditEvents.filter(event => {
      const eventYear = new Date(event.date).getFullYear();
      return eventYear === filterYear;
    });
  }, [auditEvents, filterYear]);

  const handleDownloadReport = async (format: 'pdf' | 'csv' = 'csv') => {
    try {
      setIsDownloading(true);
      const query = new URLSearchParams({ 
        format, 
        reportType,
        year: filterYear.toString()
      });
      
      const response = await fetch(`/api/statements/download?${query.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to download report');
      }

      const blob = await response.blob();
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = `${reportType}_report_${filterYear}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast('Report downloaded successfully', 'success');
    } catch (err: any) {
      console.error('Download error:', err);
      showToast(err.message || 'Failed to download report', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Loading your billing history..." />;
  }

  return (
    <div className={styles.container}>
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={isToastVisible}
        onClose={() => setIsToastVisible(false)}
      />
      
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLefty}>
            <Link href="/dashboard" className={styles.backBtn}>
              ← Back
            </Link>
            <div className={styles.headerBrand}>
              <Image src="/lhhoa-logo.png" alt="Logo" width={40} height={40} />
              <div>
                <h1 className={styles.headerTitle}>LH-Connect</h1>
                <p className={styles.headerSubtitle}>Billing Audit Log</p>
              </div>
            </div>
          </div>
          <button className={styles.logoutBtn} onClick={() => logoutAndRedirect(router, '/login')}>
            ⬅ Logout
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.heroSection}>
          <div className={styles.heroContent}>
            <h2 className={styles.pageTitle}>Transaction History & Audit Log</h2>
            <p className={styles.pageSubtitle}>
              Comprehensive history of your bills, payments, and account adjustments
            </p>
          </div>
          <div className={styles.reportControls}>
            <div className={styles.controlGroup}>
              <label>Report Type</label>
              <select value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)}>
                <option value="audit">Full Audit Log</option>
                <option value="daily">Daily Activity</option>
                <option value="monthly">Monthly Summary</option>
                <option value="annual">Annual Statement</option>
              </select>
            </div>
            <div className={styles.controlGroup}>
              <label>Year</label>
              <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))}>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                {availableYears.length === 0 && <option value={currentYear}>{currentYear}</option>}
              </select>
            </div>
            <button 
              className={styles.downloadReportBtn}
              onClick={() => handleDownloadReport('pdf')}
              disabled={isDownloading || filteredEvents.length === 0}
            >
              {isDownloading ? '...' : '⬇ Export PDF'}
            </button>
          </div>
        </section>

        <section className={styles.tableSection}>
          <div className={styles.tableCard}>
            <table className={styles.auditTable}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Transaction Description</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length > 0 ? (
                  filteredEvents.map((event) => (
                    <tr key={event.id} className={styles.tableRow}>
                      <td className={styles.dateCell}>
                        {new Date(event.date).toLocaleDateString(undefined, { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </td>
                      <td className={styles.descCell}>{event.description}</td>
                      <td className={styles.typeCell}>
                        <span className={`${styles.typeBadge} ${styles[event.type.toLowerCase()]}`}>
                          {event.type}
                        </span>
                      </td>
                      <td className={styles.amountCell}>
                        <span className={event.type === 'BILL' ? styles.billAmount : styles.payAmount}>
                          {event.type === 'BILL' ? '+' : '-'} ₱{event.amount.toLocaleString()}
                        </span>
                      </td>
                      <td className={styles.statusCell}>
                        <span className={`${styles.statusBadge} ${styles[event.status.toLowerCase().replace(/\s/g, '')]}`}>
                          {event.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className={styles.noData}>
                      No transactions found for {filterYear}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.summaryDashboard}>
          <div className={styles.summaryBox}>
            <h4>Total Billed</h4>
            <p className={`${styles.summaryValue} ${styles.billedValue}`}>
              ₱{filteredEvents.filter(e => e.type === 'BILL').reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
            </p>
          </div>
          <div className={styles.summaryBox}>
            <h4>Total Paid</h4>
            <p className={`${styles.summaryValue} ${styles.paidValue}`}>
              ₱{filteredEvents.filter(e => e.type === 'PAYMENT' && e.status === 'Confirmed').reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
            </p>
          </div>
          <div className={styles.summaryBox}>
            <h4>Net Balance ({filterYear})</h4>
            <p className={`${styles.summaryValue} ${styles.netBalance}`}>
              ₱{(
                filteredEvents.filter(e => e.type === 'BILL').reduce((sum, e) => sum + e.amount, 0) -
                filteredEvents.filter(e => e.type === 'PAYMENT' && e.status === 'Confirmed').reduce((sum, e) => sum + e.amount, 0)
              ).toLocaleString()}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
