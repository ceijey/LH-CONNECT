'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiCall } from '@/lib/api-client';
import Toast from '@/app/components/Toast';
import styles from '../residents/admin-page.module.css';
import reportsStyles from './reports.module.css';
import Skeleton from '@/app/components/Skeleton';

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
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('February 2026');
  const [selectedReportType, setSelectedReportType] = useState('Monthly Report');
  const [financialData, setFinancialData] = useState<ReportData[]>([]);
  const [summary, setSummary] = useState({
    totalDues: 0,
    totalCollected: 0,
    outstandingBalance: 0,
    collectionRate: '0'
  });
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [isToastVisible, setIsToastVisible] = useState(false);

  const months = [
    'January 2026', 'February 2026', 'March 2026', 'April 2026', 
    'May 2026', 'June 2026', 'July 2026', 'August 2026', 
    'September 2026', 'October 2026', 'November 2026', 'December 2026'
  ];

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const data = await apiCall(`/api/reports?month=${selectedMonth}&type=${selectedReportType}`);
      setFinancialData(data.financialData || []);
      setSummary(data.summary || {
        totalDues: 0,
        totalCollected: 0,
        outstandingBalance: 0,
        collectionRate: '0'
      });
    } catch (error) {
      console.error('Failed to fetch report:', error);
      showToast('Failed to load report data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedMonth, selectedReportType]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setIsToastVisible(true);
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (financialData.length === 0) return;
    
    const headers = ['Block', 'Lot', 'Resident', 'Monthly Dues', 'Amount Paid', 'Balance', 'Status'];
    const rows = financialData.map(d => [
      d.block, d.lot, d.resident, d.monthlyDues, d.amountPaid, d.balance, d.status
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `LH-Connect_Report_${selectedMonth.replace(' ', '_')}.csv`);
    link.style.visibility = 'hidden';
    if (document.body) {
      document.body.appendChild(link);
    }
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Report exported as CSV', 'success');
  };

  if (isLoading) {
    return (
      <div className={styles.content}>
        {/* Controls Skeleton */}
        <div className={`${reportsStyles.controlsRow} no-print`}>
          <div className={reportsStyles.selectGroup}>
            <Skeleton height="42px" width="240px" borderRadius="8px" />
            <Skeleton height="42px" width="240px" borderRadius="8px" />
          </div>
          <div className={reportsStyles.exportButtons}>
            <Skeleton height="42px" width="140px" borderRadius="8px" />
            <Skeleton height="42px" width="140px" borderRadius="8px" />
          </div>
        </div>

        {/* Summary Cards Skeleton */}
        <div className={reportsStyles.statsGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={reportsStyles.statCard}>
              <Skeleton height="0.875rem" width="50%" style={{ marginBottom: '0.625rem' }} />
              <Skeleton height="2rem" width="65%" />
            </div>
          ))}
        </div>

        {/* Report Content Skeleton */}
        <div className={reportsStyles.reportContent}>
          <Skeleton height="1.375rem" width="280px" style={{ marginBottom: '1.25rem' }} />
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
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td><Skeleton height="0.9rem" width="82%" /></td>
                    <td><Skeleton height="0.9rem" width="88%" /></td>
                    <td><Skeleton height="0.9rem" width="78%" /></td>
                    <td><Skeleton height="0.9rem" width="78%" /></td>
                    <td><Skeleton height="0.9rem" width="75%" /></td>
                    <td><Skeleton height="1.5rem" width="70%" borderRadius="4px" /></td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2}><Skeleton height="0.9rem" width="40%" /></td>
                  <td><Skeleton height="0.9rem" width="78%" /></td>
                  <td><Skeleton height="0.9rem" width="78%" /></td>
                  <td><Skeleton height="0.9rem" width="75%" /></td>
                  <td><Skeleton height="0.9rem" width="20%" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={isToastVisible}
        onClose={() => setIsToastVisible(false)}
      />
      <div className={styles.content}>
          <div className={`${reportsStyles.controlsRow} no-print`}>
            <div className={reportsStyles.selectGroup}>
              <select 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className={reportsStyles.select}
              >
                {months.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select 
                value={selectedReportType}
                onChange={(e) => setSelectedReportType(e.target.value)}
                className={reportsStyles.select}
              >
                <option>Monthly Report</option>
                <option>Annual Report</option>
                <option>Delinquency Report</option>
              </select>
            </div>
            <div className={reportsStyles.exportButtons}>
              <button 
                onClick={handleExportPDF}
                className={reportsStyles.exportBtn}
                style={{ borderRadius: '8px' }}
              >
                📄 Export PDF
              </button>
              <button 
                onClick={handleExportExcel}
                className={reportsStyles.exportBtn}
                style={{ borderRadius: '8px' }}
              >
                📊 Export Excel
              </button>
            </div>
          </div>

          <div className={reportsStyles.statsGrid}>
            <div className={reportsStyles.statCard}>
              <div className={reportsStyles.statLabel}>Total Dues</div>
              <div className={reportsStyles.statValue}>₱{summary.totalDues.toLocaleString()}</div>
            </div>
            <div className={reportsStyles.statCard}>
              <div className={reportsStyles.statLabel}>Total Collected</div>
              <div className={reportsStyles.statValue} style={{ color: '#2e7d32' }}>₱{summary.totalCollected.toLocaleString()}</div>
            </div>
            <div className={reportsStyles.statCard}>
              <div className={reportsStyles.statLabel}>Outstanding Balance</div>
              <div className={reportsStyles.statValue} style={{ color: '#d32f2f' }}>₱{summary.outstandingBalance.toLocaleString()}</div>
            </div>
            <div className={reportsStyles.statCard}>
              <div className={reportsStyles.statLabel}>Collection Rate</div>
              <div className={reportsStyles.statValue} style={{ color: '#1976d2' }}>{summary.collectionRate}%</div>
            </div>
          </div>

          <div className={reportsStyles.reportContent}>
            <h2 className={reportsStyles.reportTitle}>{selectedReportType} - {selectedMonth}</h2>
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
                    <td>₱{summary.totalDues.toLocaleString()}</td>
                    <td style={{ color: '#2e7d32' }}>₱{summary.totalCollected.toLocaleString()}</td>
                    <td style={{ color: '#d32f2f' }}>₱{summary.outstandingBalance.toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
        </div>
      </div>
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
          .content {
            box-shadow: none !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </>
  );
}
