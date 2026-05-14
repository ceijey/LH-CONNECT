'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { apiCall } from '@/lib/api-client';
import Toast from '@/app/components/Toast';
import styles from '../residents/admin-page.module.css';
import reportsStyles from './reports.module.css';
import Skeleton from '@/app/components/Skeleton';

interface ReportData {
  id: string;
  block: string;
  lot: string;
  resident: string;
  monthlyDues: number;
  amountPaid: number;
  balance: number;
  status: 'Paid' | 'Pending' | 'Delinquent' | 'Rejected';
  paymentMethod?: string;
}

interface AnalyticsData {
  totalCount: number;
  verifiedCount: number;
  pendingCount: number;
  rejectedCount: number;
  paidCount: number;
  delinquentCount: number;
  methods: { name: string; value: number }[];
}

type SortConfig = {
  key: keyof ReportData;
  direction: 'ascending' | 'descending';
} | null;

export default function AdminReports() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('February 2026');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedReportType, setSelectedReportType] = useState('Monthly Report');
  const [financialData, setFinancialData] = useState<ReportData[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [summary, setSummary] = useState({
    totalDues: 0,
    totalCollected: 0,
    outstandingBalance: 0,
    collectionRate: '0'
  });
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  
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
      const query = new URLSearchParams({
        month: selectedMonth,
        type: selectedReportType,
        date: selectedDate
      });
      const data = await apiCall(`/api/reports?${query.toString()}`);
      setFinancialData(data.financialData || []);
      setAnalytics(data.analytics || null);
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
  }, [selectedMonth, selectedReportType, selectedDate]);

  const sortedData = useMemo(() => {
    let sortableItems = [...financialData];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aVal = a[sortConfig.key] ?? '';
        const bVal = b[sortConfig.key] ?? '';
        
        if (aVal < bVal) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aVal > bVal) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [financialData, sortConfig]);

  const requestSort = (key: keyof ReportData) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

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
    const headers = ['Block', 'Lot', 'Resident', 'Monthly Dues', 'Amount Paid', 'Balance', 'Status', 'Method'];
    const rows = financialData.map(d => [
      d.block, d.lot, d.resident, d.monthlyDues, d.amountPaid, d.balance, d.status, d.paymentMethod || 'N/A'
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `LH-Connect_Report_${selectedMonth.replace(' ', '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Report exported as CSV', 'success');
  };

  if (isLoading) {
    return (
      <div className={styles.content}>
        <div className={`${reportsStyles.controlsRow} no-print`}>
          <Skeleton height="42px" width="500px" borderRadius="10px" />
          <Skeleton height="42px" width="300px" borderRadius="10px" />
        </div>
        <div className={reportsStyles.statsGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height="120px" borderRadius="16px" />
          ))}
        </div>
        <Skeleton height="400px" borderRadius="16px" />
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
          {/* Print Header */}
          <div className={reportsStyles.printOnly}>
            <div className={reportsStyles.printHeader}>
              <div className={reportsStyles.printLogo}>
                <div className={reportsStyles.printLogoBrand}>
                  <img src="/lhhoa-logo.png" alt="LH Logo" className={reportsStyles.printLogoImg} />
                  <span className={reportsStyles.printLogoText}>LH-Connect</span>
                </div>
                <div className={reportsStyles.printAddressInfo}>
                  <div>San Pablo Dinalupihan Bataan</div>
                  <div>TIN: <span className={reportsStyles.printTIN}>480-266-103-000</span></div>
                </div>
              </div>
              <div className={reportsStyles.printReportDetails}>
                <h1 className={reportsStyles.printReportTitle}>{selectedReportType}</h1>
                <div className={reportsStyles.printDate}>
                  Period: {selectedReportType === 'Daily Report' ? selectedDate : selectedMonth} | Generated: {new Date().toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>

          <div className={`${reportsStyles.controlsRow} no-print`}>
            <div className={reportsStyles.selectGroup}>
              <select 
                value={selectedReportType}
                onChange={(e) => setSelectedReportType(e.target.value)}
                className={reportsStyles.select}
              >
                <option>Monthly Report</option>
                <option>Daily Report</option>
                <option>Annual Report</option>
              </select>

              {selectedReportType === 'Daily Report' ? (
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className={reportsStyles.select}
                />
              ) : (
                <select 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className={reportsStyles.select}
                >
                  {months.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              )}
            </div>
            <div className={reportsStyles.exportButtons}>
              <button onClick={handleExportPDF} className={reportsStyles.exportBtn}>📄 PDF Report</button>
              <button onClick={handleExportExcel} className={reportsStyles.exportBtn}>📊 Excel/CSV</button>
            </div>
          </div>

          <div className={reportsStyles.statsGrid}>
            <div className={reportsStyles.statCard}>
              <span className={reportsStyles.statLabel}>
                {selectedReportType === 'Daily Report' ? 'Total Submissions' : 'Total Receivables'}
              </span>
              <span className={reportsStyles.statValue}>₱{summary.totalDues.toLocaleString()}</span>
            </div>
            <div className={reportsStyles.statCard}>
              <span className={reportsStyles.statLabel}>
                {selectedReportType === 'Daily Report' ? 'Collected Today' : 'Total Collected'}
              </span>
              <span className={reportsStyles.statValue} style={{ color: '#16a34a' }}>₱{summary.totalCollected.toLocaleString()}</span>
            </div>
            <div className={reportsStyles.statCard}>
              <span className={reportsStyles.statLabel}>
                {selectedReportType === 'Daily Report' ? 'Pending/Rejected' : 'Outstanding'}
              </span>
              <span className={reportsStyles.statValue} style={{ color: '#dc2626' }}>₱{summary.outstandingBalance.toLocaleString()}</span>
            </div>
            <div className={reportsStyles.statCard}>
              <span className={reportsStyles.statLabel}>
                {selectedReportType === 'Daily Report' ? 'Realization Rate' : 'Collection Rate'}
              </span>
              <span className={reportsStyles.statValue} style={{ color: '#1976d2' }}>{summary.collectionRate}%</span>
            </div>
          </div>

          {/* Analytics Visualization (Visible in App & Print) */}
          <div className={reportsStyles.analyticsGrid}>
            <div className={reportsStyles.analyticsCard}>
              <h3 className={reportsStyles.analyticsTitle}>📊 Payment Methods Breakdown</h3>
              <table className={reportsStyles.analyticsTable}>
                <thead>
                  <tr>
                    <th>Method Name</th>
                    <th>Transactions</th>
                    <th className="no-print">Distribution</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics?.methods.map(m => (
                    <tr key={m.name}>
                      <td style={{ fontWeight: 600 }}>{m.name}</td>
                      <td>{m.value}</td>
                      <td className="no-print">
                        <div className={reportsStyles.methodBarContainer}>
                          <div 
                            className={reportsStyles.methodBar} 
                            style={{ width: `${(m.value / (analytics.totalCount || 1)) * 100}%` }}
                          ></div>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!analytics?.methods || analytics.methods.length === 0) && (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>
                        No payment data for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className={reportsStyles.analyticsCard}>
              <h3 className={reportsStyles.analyticsTitle}>📈 Efficiency Summary</h3>
              <table className={reportsStyles.analyticsTable}>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span className={reportsStyles.statusIndicator} style={{ background: '#16a34a' }}></span> Verified / Paid</td>
                    <td style={{ fontWeight: 700 }}>{analytics?.verifiedCount || 0}</td>
                  </tr>
                  <tr>
                    <td><span className={reportsStyles.statusIndicator} style={{ background: '#f59e0b' }}></span> Pending Verification</td>
                    <td style={{ fontWeight: 700, color: '#f59e0b' }}>{analytics?.pendingCount || 0}</td>
                  </tr>
                  <tr>
                    <td><span className={reportsStyles.statusIndicator} style={{ background: '#dc2626' }}></span> Rejected Payments</td>
                    <td style={{ fontWeight: 700, color: '#dc2626' }}>{analytics?.rejectedCount || 0}</td>
                  </tr>
                  <tr style={{ borderTop: '2px solid #e2e8f0' }}>
                    <td style={{ fontWeight: 700 }}>Resident Collection Rate</td>
                    <td style={{ fontWeight: 800, color: '#1B2A4A' }}>{summary.collectionRate}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className={reportsStyles.reportContent}>
            <h2 className={reportsStyles.reportTitle}>
              {selectedReportType} — {selectedReportType === 'Daily Report' ? selectedDate : selectedMonth}
            </h2>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th onClick={() => requestSort('block')} className={reportsStyles.sortableHeader}>
                      Blk/Lot {sortConfig?.key === 'block' && (sortConfig.direction === 'ascending' ? '🔼' : '🔽')}
                    </th>
                    <th onClick={() => requestSort('resident')} className={reportsStyles.sortableHeader}>
                      Resident Name {sortConfig?.key === 'resident' && (sortConfig.direction === 'ascending' ? '🔼' : '🔽')}
                    </th>
                    <th onClick={() => requestSort('monthlyDues')} className={reportsStyles.sortableHeader}>
                      Dues {sortConfig?.key === 'monthlyDues' && (sortConfig.direction === 'ascending' ? '🔼' : '🔽')}
                    </th>
                    <th onClick={() => requestSort('amountPaid')} className={reportsStyles.sortableHeader}>
                      Paid {sortConfig?.key === 'amountPaid' && (sortConfig.direction === 'ascending' ? '🔼' : '🔽')}
                    </th>
                    <th onClick={() => requestSort('balance')} className={reportsStyles.sortableHeader}>
                      Balance {sortConfig?.key === 'balance' && (sortConfig.direction === 'ascending' ? '🔼' : '🔽')}
                    </th>
                    <th onClick={() => requestSort('status')} className={reportsStyles.sortableHeader}>
                      Status {sortConfig?.key === 'status' && (sortConfig.direction === 'ascending' ? '🔼' : '🔽')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((row) => (
                    <tr key={row.id}>
                      <td>Blk {row.block} Lot {row.lot}</td>
                      <td>{row.resident}</td>
                      <td>₱{row.monthlyDues.toLocaleString()}</td>
                      <td style={{ color: row.amountPaid > 0 ? '#16a34a' : '#64748b', fontWeight: 700 }}>
                        ₱{row.amountPaid.toLocaleString()}
                      </td>
                      <td style={{ color: row.balance > 0 ? '#dc2626' : '#64748b', fontWeight: 700 }}>
                        ₱{row.balance.toLocaleString()}
                      </td>
                      <td>
                        <span className={`${styles.badge} ${row.status === 'Paid' ? styles.verified : row.status === 'Pending' ? styles.pending : row.status === 'Rejected' ? styles.rejected : styles.delinquent}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {sortedData.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                        No records found for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`${reportsStyles.printOnly} ${reportsStyles.printFooter}`}>
            <div className={reportsStyles.printFooterText}>
              <div>LH-Connect Financial Analytics System — Property of LH Homeowners Association</div>
              <div>Report generated on {new Date().toLocaleString()} by System Administrator</div>
            </div>
            <div className={reportsStyles.pageNumber}></div>
          </div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { 
            background: white !important; 
            padding: 0 !important; 
            margin: 0 !important;
            -webkit-print-color-adjust: exact;
          }
          .content { 
            box-shadow: none !important; 
            padding: 0 !important; 
            margin: 0 !important;
            max-width: 100% !important; 
            border: none !important;
            background: transparent !important;
            overflow: visible !important;
          }
          * {
            scrollbar-width: none !important;
          }
          *::-webkit-scrollbar {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
