'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import styles from './view-statements.module.css';

interface Statement {
  id: number;
  month: string;
  year: number;
  date: string;
  totalDues: number;
  amountPaid: number;
  balance: number;
  status: 'Paid' | 'Partially Paid' | 'Pending';
  fileFormat: 'PDF' | 'Excel';
}

export default function ViewStatementsPage() {
  const router = useRouter();
  const [filterYear, setFilterYear] = useState<number>(2026);

  const statements: Statement[] = [
    {
      id: 1,
      month: 'February',
      year: 2026,
      date: '2026-02-28',
      totalDues: 500,
      amountPaid: 500,
      balance: 0,
      status: 'Paid',
      fileFormat: 'PDF',
    },
    {
      id: 2,
      month: 'January',
      year: 2026,
      date: '2026-01-31',
      totalDues: 500,
      amountPaid: 500,
      balance: 0,
      status: 'Paid',
      fileFormat: 'PDF',
    },
    {
      id: 3,
      month: 'December',
      year: 2025,
      date: '2025-12-31',
      totalDues: 500,
      amountPaid: 500,
      balance: 0,
      status: 'Paid',
      fileFormat: 'PDF',
    },
    {
      id: 4,
      month: 'November',
      year: 2025,
      date: '2025-11-30',
      totalDues: 500,
      amountPaid: 500,
      balance: 0,
      status: 'Paid',
      fileFormat: 'PDF',
    },
    {
      id: 5,
      month: 'October',
      year: 2025,
      date: '2025-10-31',
      totalDues: 500,
      amountPaid: 500,
      balance: 0,
      status: 'Paid',
      fileFormat: 'PDF',
    },
    {
      id: 6,
      month: 'September',
      year: 2025,
      date: '2025-09-30',
      totalDues: 500,
      amountPaid: 500,
      balance: 0,
      status: 'Paid',
      fileFormat: 'PDF',
    },
  ];

  const filteredStatements = statements.filter((s) => s.year === filterYear);

  const handleDownload = (statement: Statement) => {
    alert(
      `Downloading ${statement.month} ${statement.year} statement as ${statement.fileFormat}...`
    );
  };

  const handleBulkDownload = () => {
    alert('Downloading all statements as ZIP file...');
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLefty}>
            <Link href="/dashboard" className={styles.backBtn}>
              ← Back
            </Link>
            <div className={styles.headerBrand}>
              <span className={styles.headerIcon}>🏠</span>
              <div>
                <h1 className={styles.headerTitle}>LH-Connect</h1>
                <p className={styles.headerSubtitle}>View Statements</p>
              </div>
            </div>
          </div>
          <button
            className={styles.logoutBtn}
            onClick={() => {
              localStorage.removeItem('isAuthenticated');
              localStorage.removeItem('userEmail');
              router.push('/');
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
            >
              <option value={2026}>2026</option>
              <option value={2025}>2025</option>
              <option value={2024}>2024</option>
            </select>
          </div>
          <button className={styles.bulkDownloadBtn} onClick={handleBulkDownload}>
            ⬇ Download All ({filteredStatements.length})
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
                </div>

                <div className={styles.cardFooter}>
                  <button
                    className={styles.downloadBtn}
                    onClick={() => handleDownload(statement)}
                  >
                    ⬇ Download {statement.fileFormat}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.emptyState}>
              <p className={styles.emptyIcon}>📄</p>
              <p className={styles.emptyText}>No statements found for {filterYear}</p>
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
