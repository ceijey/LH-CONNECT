'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { logoutAndRedirect } from '@/lib/auth-session';
import { apiCall } from '@/lib/api-client';
import { useAuthPageshow } from '@/lib/useAuthPageshow';
import Toast from '@/app/components/Toast';
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

export default function ViewStatementsPage() {
  const router = useRouter();
  useAuthPageshow('resident');
  const currentYear = new Date().getFullYear();
  const [filterYear, setFilterYear] = useState<number>(currentYear);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [isToastVisible, setIsToastVisible] = useState(false);

  const availableYears = Array.from(new Set(statements.map((statement) => statement.year))).sort(
    (a, b) => b - a
  );
  const filteredStatements = statements.filter((s) => s.year === filterYear);
  const hasStatements = statements.length > 0;

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setIsToastVisible(true);
  };

  useEffect(() => {
    if (!availableYears.includes(filterYear) && availableYears.length > 0) {
      setFilterYear(availableYears[0]);
    }
  }, [availableYears, filterYear]);

  useEffect(() => {
    const fetchStatements = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiCall('/api/statements');
        console.log('Statements API response:', data);
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

  const handleDownload = async (statement: Statement, format: 'pdf' | 'csv' = 'pdf') => {
    try {
      setIsDownloading(true);
      const query = new URLSearchParams({
        format,
        statementId: statement.id,
      });
      const response = await fetch(`/api/statements/download?${query.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to download statement');
      }

      const blob = await response.blob();
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = `statement_${statement.month}_${statement.year}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Download error:', err);
      showToast('Failed to download statement. Please try again.', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleBulkDownload = async (format: 'pdf' | 'csv' = 'csv') => {
    try {
      setIsDownloading(true);
      const query = new URLSearchParams({ format });
      const response = await fetch(`/api/statements/download?${query.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to download statements');
      }

      const blob = await response.blob();
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = `all_statements.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Download error:', err);
      showToast('Failed to download statements. Please try again.', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.headerLefty}>
              <Link href="/dashboard" className={styles.backBtn}>
                ← Back
              </Link>
            </div>
            <button
              className={styles.logoutBtn}
              onClick={async () => {
                await logoutAndRedirect(router, '/');
              }}
            >
              ⬅ Logout
            </button>
          </div>
        </header>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>Loading your statements...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.headerLefty}>
              <Link href="/dashboard" className={styles.backBtn}>
                ← Back
              </Link>
            </div>
            <button
              className={styles.logoutBtn}
              onClick={async () => {
                await logoutAndRedirect(router, '/');
              }}
            >
              ⬅ Logout
            </button>
          </div>
        </header>
        <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>
          <p>Error: {error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={isToastVisible}
        onClose={() => setIsToastVisible(false)}
      />
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLefty}>
            <Link href="/dashboard" className={styles.backBtn}>
              ← Back
            </Link>
            <div className={styles.headerBrand}>
              <Image
                src="/lhhoa-logo.png"
                alt="LHHOA Logo"
                width={50}
                height={50}
                className={styles.headerIcon}
                priority
              />
              <div>
                <h1 className={styles.headerTitle}>LH-Connect</h1>
                <p className={styles.headerSubtitle}>View Statements</p>
              </div>
            </div>
          </div>
          <button
            className={styles.logoutBtn}
            onClick={async () => {
              await logoutAndRedirect(router, '/');
            }}
          >
            ⬅ Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        {/* Page Title Section */}
        <section className={styles.titleSection}>
          <div>
            <h2 className={styles.pageTitle}>Download Billing History</h2>
            <p className={styles.pageSubtitle}>
              View and download your monthly billing statements and payment history
            </p>
          </div>
        </section>

        {/* Filter and Actions */}
        <div className={styles.controlsSection}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Filter by Year:</label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
              className={styles.filterSelect}
              disabled={availableYears.length === 0}
            >
              {availableYears.length > 0 ? (
                availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))
              ) : (
                <option value={currentYear}>{currentYear}</option>
              )}
            </select>
          </div>
          <button
            className={styles.bulkDownloadBtn}
            onClick={() => handleBulkDownload('csv')}
            disabled={isDownloading || filteredStatements.length === 0}
          >
            {isDownloading ? '⏳ Downloading...' : `⬇ Download All (${filteredStatements.length})`}
          </button>
        </div>

        {/* Statements Grid */}
        <div className={styles.statementsGrid}>
          {filteredStatements.length > 0 ? (
            filteredStatements.map((statement) => (
              <div key={statement.id} className={styles.statementCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.monthInfo}>
                    <h3 className={styles.statementMonth}>
                      {statement.month} {statement.year}
                    </h3>
                    <p className={styles.statementDate}>{statement.date}</p>
                  </div>
                  <span
                    className={`${styles.badge} ${styles[statement.status.toLowerCase().replace(' ', '')]}`}
                  >
                    {statement.status}
                  </span>
                </div>

                <div className={styles.cardContent}>
                  <div className={styles.statDetail}>
                    <span className={styles.statLabel}>Total Dues</span>
                    <span className={styles.statValue}>₱{statement.totalDues}</span>
                  </div>
                  <div className={styles.statDetail}>
                    <span className={styles.statLabel}>Amount Paid</span>
                    <span className={styles.statValue}>₱{statement.amountPaid}</span>
                  </div>
                  <div className={styles.statDetail}>
                    <span className={styles.statLabel}>Balance</span>
                    <span
                      className={`${styles.statValue} ${
                        statement.balance === 0 ? styles.balanced : styles.outstanding
                      }`}
                    >
                      ₱{statement.balance}
                    </span>
                  </div>

                  {statement.relatedSubmissions && statement.relatedSubmissions.length > 0 && (
                    <div className={styles.submissionStatus}>
                      <span className={styles.submissionLabel}>Payment Proof Submitted:</span>
                      {statement.relatedSubmissions.map((sub: any) => {
                        const displayDate = (sub.status === 'Verified' && sub.verifiedDate)
                          ? new Date(sub.verifiedDate).toLocaleDateString()
                          : (sub.submittedDate ? new Date(sub.submittedDate).toLocaleDateString() : '—');
                        
                        return (
                          <div key={sub.id} className={styles.submissionValue}>
                            <div className={styles.submissionDetail}>
                              <span className={styles.statValue}>₱{sub.paymentAmount}</span>
                              <span className={styles.submissionDate}>{displayDate}</span>
                            </div>
                            <span className={styles.submissionBadge}>
                              {sub.status === 'Verified' ? '✓ Verified' : '⏳ Pending'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className={styles.cardFooter}>
                  <button
                    className={styles.downloadBtn}
                    onClick={() => handleDownload(statement, 'pdf')}
                    disabled={isDownloading}
                  >
                    {isDownloading ? '⏳ Downloading...' : `⬇ Download ${statement.fileFormat}`}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.emptyState}>
              <p className={styles.emptyIcon}>📄</p>
              <p className={styles.emptyText}>
                {hasStatements
                  ? `No billing statements found for ${filterYear}.`
                  : 'No billing statements yet.'}
              </p>
              <p className={styles.emptySubtext}>
                {hasStatements
                  ? 'Try a different year or check back later.'
                  : 'Your billing statements will appear here once they are issued.'}
              </p>
            </div>
          )}
        </div>

        {/* Summary Section */}
        <section className={styles.summarySection}>
          <div className={styles.summaryCard}>
            <h3 className={styles.summaryTitle}>Account Summary</h3>
            <div className={styles.summaryGrid}>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Total Statements</span>
                <span className={styles.summaryValue}>{filteredStatements.length}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Total Paid</span>
                <span className={styles.summaryValue}>
                  ₱{filteredStatements.reduce((sum, s) => sum + s.amountPaid, 0)}
                </span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Outstanding Balance</span>
                <span className={`${styles.summaryValue} ${styles.outstanding}`}>
                  ₱{filteredStatements.reduce((sum, s) => sum + s.balance, 0)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Information Box */}
        <div className={styles.infoBox}>
          <div className={styles.infoIcon}>📋</div>
          <div className={styles.infoContent}>
            <h3 className={styles.infoTitle}>About Your Statements</h3>
            <p className={styles.infoText}>
              Your monthly billing statements are automatically generated and available for download
              here. Each statement includes your monthly dues, payments received, and current balance.
              Statements are typically available within 2-3 days of the month-end date. You can
              download them in PDF or Excel format for your records.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
