'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiCall } from '@/lib/api-client';
import { useAuthPageshow } from '@/lib/useAuthPageshow';
import styles from './transactions.module.css';

export default function TransactionsPage() {
  const router = useRouter();
  useAuthPageshow('resident');
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'All' | 'Paid' | 'Pending' | 'Rejected'>('All');
  const [statements, setStatements] = useState<any[]>([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadError('');
        const payload = await apiCall('/api/statements');
        setStatements(payload.statements || []);
      } catch (error: any) {
        setStatements([]);
        setLoadError(error?.message || 'Failed to load transaction history');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [router]);

  const auditEvents = useMemo(() => {
    const events: any[] = [];
    statements.forEach(stmt => {
      // Bill Event
      events.push({
        id: `bill-${stmt.id}`,
        month: `${stmt.month} ${stmt.year}`,
        date: stmt.date || new Date().toISOString(),
        type: 'BILL',
        amount: Number(stmt.totalDues || 0),
        status: stmt.status === 'Paid' ? 'Paid' : (stmt.status || 'Pending'),
        description: `Monthly Dues - ${stmt.month} ${stmt.year}`,
        paymentMethod: 'System',
      });

      // Payment Events
      if (stmt.relatedSubmissions) {
        stmt.relatedSubmissions.forEach((sub: any) => {
          events.push({
            id: `pay-${sub.id}`,
            month: sub.month || `${stmt.month} ${stmt.year}`,
            date: sub.verifiedDate || sub.submittedDate || stmt.date,
            type: 'PAYMENT',
            amount: Number(sub.paymentAmount || 0),
            status: sub.status === 'Verified' ? 'Paid' : (sub.status || 'Pending'),
            description: `Payment Submission - ${stmt.month} ${stmt.year}`,
            paymentMethod: sub.paymentMethod || 'System',
            rejectionReason: sub.rejectionReason,
          });
        });
      }
    });

    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [statements]);

  const filteredTransactions = filterStatus === 'All' 
    ? auditEvents 
    : auditEvents.filter(t => t.status === filterStatus);

  const totalBilled = filteredTransactions.filter(t => t.type === 'BILL').reduce((sum, t) => sum + t.amount, 0);
  const totalPaid = filteredTransactions.filter(t => t.type === 'PAYMENT' && t.status === 'Paid').reduce((sum, t) => sum + t.amount, 0);

  const handleDownloadCSV = async () => {
    setIsDownloading(true);
    try {
      const headers = ['Date', 'Month', 'Type', 'Description', 'Amount', 'Payment Method', 'Status'];
      const rows = filteredTransactions.map((t) => [
        t.date,
        t.month,
        t.type,
        t.description,
        String(t.amount),
        t.paymentMethod,
        t.status
      ]);

      const csv = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit_log_${new Date().toLocaleDateString()}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return <div className={styles.loading}>Loading history...</div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerTitle}>
            <Link href="/dashboard" className={styles.backBtn}>
              ← Dashboard
            </Link>
            <h1 className={styles.title}>Transaction History</h1>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.filterSection}>
          <h2 className={styles.filterTitle}>Filter by Status</h2>
          <div className={styles.filterButtons}>
            {['All', 'Paid', 'Pending', 'Rejected'].map((status) => (
              <button
                key={status}
                className={`${styles.filterBtn} ${filterStatus === status ? styles.active : ''}`}
                onClick={() => setFilterStatus(status as any)}
              >
                {status}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.summarySection}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>Total Billed</div>
            <div className={styles.summaryValue}>₱{totalBilled.toLocaleString()}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>Total Paid</div>
            <div className={styles.summaryValue} style={{ color: '#22c55e' }}>₱{totalPaid.toLocaleString()}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>Net Balance</div>
            <div className={styles.summaryValue} style={{ color: '#ef4444' }}>₱{(totalBilled - totalPaid).toLocaleString()}</div>
          </div>
        </section>

        <section className={styles.transactionsSection}>
          {loadError ? (
            <div className={styles.emptyState}>
              <p>{loadError}</p>
            </div>
          ) : null}
          {filteredTransactions.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No transactions found for this filter.</p>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.transactionsTable}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((t) => (
                    <tr key={t.id} className={styles.tableRow}>
                      <td className={styles.dateCell}>{new Date(t.date).toLocaleDateString()}</td>
                      <td className={styles.typeCell}>
                        <span className={`${styles.typeBadge} ${styles[t.type.toLowerCase()]}`}>
                          {t.type}
                        </span>
                      </td>
                      <td className={styles.descCell}>
                        <div>{t.description}</div>
                        {t.rejectionReason && (
                          <div className={styles.rejectionReason}>
                            ⚠️ Reason: {t.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td className={`${styles.amountCell} ${t.type === 'BILL' ? styles.billAmount : styles.payAmount}`}>
                        {t.type === 'BILL' ? '-' : '+'}₱{t.amount.toLocaleString()}
                      </td>
                      <td className={styles.statusCell}>
                        <span className={`${styles.statusBadge} ${styles[t.status.toLowerCase().replace(/\s/g, '')]}`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={styles.downloadSection}>
          <button className={styles.downloadBtn} onClick={handleDownloadCSV} disabled={isDownloading || filteredTransactions.length === 0}>
            📥 {isDownloading ? 'Downloading...' : 'Download Full History (CSV)'}
          </button>
          <button className={styles.printBtn} onClick={() => window.print()}>
            🖨️ Print Audit Log
          </button>
        </section>
      </main>
    </div>
  );
}
