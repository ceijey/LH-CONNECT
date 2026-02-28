'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './transactions.module.css';

interface Transaction {
  id: string;
  month: string;
  date: string;
  type: 'Payment' | 'Fine' | 'Adjustment';
  amount: number;
  status: 'Paid' | 'Pending' | 'Failed';
  description: string;
}

export default function TransactionsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'All' | 'Paid' | 'Pending' | 'Failed'>('All');

  // Mock transaction data
  const allTransactions: Transaction[] = [
    { id: 'TXN001', month: 'February 2026', date: 'Feb 22, 2026', type: 'Payment', amount: 500, status: 'Paid', description: 'Monthly dues - February 2026' },
    { id: 'TXN002', month: 'January 2026', date: 'Jan 20, 2026', type: 'Payment', amount: 500, status: 'Paid', description: 'Monthly dues - January 2026' },
    { id: 'TXN003', month: 'December 2025', date: 'Dec 18, 2025', type: 'Payment', amount: 500, status: 'Paid', description: 'Monthly dues - December 2025' },
    { id: 'TXN004', month: 'November 2025', date: 'Nov 15, 2025', type: 'Payment', amount: 500, status: 'Paid', description: 'Monthly dues - November 2025' },
    { id: 'TXN005', month: 'October 2025', date: 'Oct 22, 2025', type: 'Payment', amount: 500, status: 'Paid', description: 'Monthly dues - October 2025' },
    { id: 'TXN006', month: 'September 2025', date: 'Sep 19, 2025', type: 'Payment', amount: 500, status: 'Paid', description: 'Monthly dues - September 2025' },
    { id: 'TXN007', month: 'August 2025', date: 'Aug 21, 2025', type: 'Payment', amount: 500, status: 'Paid', description: 'Monthly dues - August 2025' },
    { id: 'TXN008', month: 'July 2025', date: 'Jul 18, 2025', type: 'Payment', amount: 500, status: 'Paid', description: 'Monthly dues - July 2025' },
    { id: 'TXN009', month: 'June 2025', date: 'Jun 20, 2025', type: 'Fine', amount: 50, status: 'Paid', description: 'Late payment fine' },
    { id: 'TXN010', month: 'June 2025', date: 'Jun 15, 2025', type: 'Payment', amount: 500, status: 'Paid', description: 'Monthly dues - June 2025' },
    { id: 'TXN011', month: 'May 2025', date: 'May 22, 2025', type: 'Payment', amount: 500, status: 'Paid', description: 'Monthly dues - May 2025' },
    { id: 'TXN012', month: 'April 2025', date: 'Apr 18, 2025', type: 'Payment', amount: 500, status: 'Paid', description: 'Monthly dues - April 2025' },
  ];

  useEffect(() => {
    // Check if user is authenticated
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    
    if (!isAuthenticated) {
      router.push('/login');
    } else {
      setIsLoading(false);
    }
  }, [router]);

  const filteredTransactions = filterStatus === 'All' 
    ? allTransactions 
    : allTransactions.filter(t => t.status === filterStatus);

  const totalAmount = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);

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
          {filteredTransactions.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No transactions found for this filter.</p>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.transactionsTable}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((transaction) => (
                    <tr key={transaction.id} className={styles.tableRow}>
                      <td className={styles.idCell}>{transaction.id}</td>
                      <td className={styles.dateCell}>{transaction.date}</td>
                      <td className={styles.typeCell}>
                        <span className={`${styles.typeBadge} ${styles[transaction.type.toLowerCase()]}`}>
                          {transaction.type}
                        </span>
                      </td>
                      <td className={styles.descCell}>{transaction.description}</td>
                      <td className={styles.amountCell}>₱{transaction.amount}</td>
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
          <button className={styles.downloadBtn}>
            📥 Download All as CSV
          </button>
          <button className={styles.printBtn}>
            🖨️ Print Transactions
          </button>
        </section>
      </main>
    </div>
  );
}
