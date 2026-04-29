'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiCall } from '@/lib/api-client';
import { useAuthPageshow } from '@/lib/useAuthPageshow';
import styles from './transactions.module.css';

interface Transaction {
  id: string;
  month: string;
  date: string;
  type: 'Payment' | 'Fine' | 'Adjustment';
  amount: number;
  status: 'Paid' | 'Pending' | 'Failed';
  description: string;
  paymentMethod: 'GCash' | 'Maya' | 'Bank Transfer' | 'Cash' | 'System';
}

export default function TransactionsPage() {
  const router = useRouter();
  useAuthPageshow('resident');
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'All' | 'Paid' | 'Pending' | 'Failed'>('All');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const loadTransactions = async () => {
      try {
        setLoadError('');
        const payload = await apiCall('/api/payments');
        const fetched = (payload.payments ?? []).map((payment: any) => {
          const toMillis = (value: any) => {
            if (!value) return 0;
            if (typeof value.toMillis === 'function') return value.toMillis();
            if (typeof value.toDate === 'function') return value.toDate().getTime();
            const numeric = Number(value);
            return Number.isFinite(numeric) ? numeric : new Date(value).getTime() || 0;
          };

          const createdAt = payment.createdAt ? new Date(toMillis(payment.createdAt)) : new Date();
          const month = createdAt.toLocaleString(undefined, { month: 'long', year: 'numeric' });

          return {
            id: payment.id,
            month,
            date: createdAt.toLocaleDateString(),
            type: payment.status?.toLowerCase() === 'pending' ? 'Adjustment' : 'Payment',
            amount: Number(payment.amount ?? 0),
            status: payment.status === 'Failed' ? 'Failed' : payment.status === 'Pending' ? 'Pending' : 'Paid',
            description: payment.reference ? `Payment reference ${payment.reference}` : `Monthly dues - ${month}`,
            paymentMethod: (payment.method || 'System') as Transaction['paymentMethod'],
          } as Transaction;
        }) as Transaction[];

        setTransactions(fetched);
      } catch (error: any) {
        setTransactions([]);
        setLoadError(error?.message || 'Failed to load transactions');
      } finally {
        setIsLoading(false);
      }
    };

    loadTransactions();
  }, [router]);

  const filteredTransactions = filterStatus === 'All' 
    ? transactions 
    : transactions.filter(t => t.status === filterStatus);

  const totalAmount = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);

  const handleDownloadCSV = async () => {
    setIsDownloading(true);
    try {
      const headers = ['Date', 'Month', 'Type', 'Description', 'Amount', 'Payment Method', 'Status'];
      const rows = filteredTransactions.map((transaction) => [
        transaction.date,
        transaction.month,
        transaction.type,
        transaction.description,
        String(transaction.amount),
        transaction.paymentMethod,
        transaction.status,
      ]);

      const csv = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'transactions.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerTitle}>
            <Link href="/dashboard" className={styles.backBtn}>
              ← Dashboard
            </Link>
            <h1 className={styles.title}>All Transactions</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        {/* Filter Section */}
        <section className={styles.filterSection}>
          <h2 className={styles.filterTitle}>Filter by Status</h2>
          <div className={styles.filterButtons}>
            {['All', 'Paid', 'Pending', 'Failed'].map((status) => (
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

        {/* Summary */}
        <section className={styles.summarySection}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>Total Transactions</div>
            <div className={styles.summaryValue}>{filteredTransactions.length}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>Total Amount</div>
            <div className={styles.summaryValue}>₱{totalAmount.toLocaleString()}</div>
          </div>
        </section>

        {/* Transactions Table */}
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
                    <th>Payment Method</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((transaction) => (
                    <tr key={transaction.id} className={styles.tableRow}>
                      <td className={styles.dateCell}>{transaction.date}</td>
                      <td className={styles.typeCell}>
                        <span className={`${styles.typeBadge} ${styles[transaction.type.toLowerCase()]}`}>
                          {transaction.type}
                        </span>
                      </td>
                      <td className={styles.descCell}>{transaction.description}</td>
                      <td className={styles.amountCell}>₱{transaction.amount}</td>
                      <td className={styles.methodCell}>{transaction.paymentMethod}</td>
                      <td className={styles.statusCell}>
                        <span className={`${styles.statusBadge} ${styles[transaction.status.toLowerCase()]}`}>
                          {transaction.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Download Section */}
        <section className={styles.downloadSection}>
          <button className={styles.downloadBtn} onClick={handleDownloadCSV} disabled={isDownloading || filteredTransactions.length === 0}>
            📥 {isDownloading ? 'Downloading...' : 'Download All as CSV'}
          </button>
          <button className={styles.printBtn} onClick={() => window.print()}>
            🖨️ Print Transactions
          </button>
        </section>
      </main>
    </div>
  );
}
