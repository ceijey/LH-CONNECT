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
  const [selectedMonth, setSelectedMonth] = useState(() => {
    return new Date().toLocaleString('en-US', { month: 'long' });
  });
  const [selectedYear, setSelectedYear] = useState(() => {
    return new Date().getFullYear().toString();
  });
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
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [isToastVisible, setIsToastVisible] = useState(false);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = ['2024', '2025', '2026', '2027', '2028', '2029', '2030'];

  const getFormattedPeriod = () => {
    if (selectedReportType === 'Daily Report') {
      if (!selectedDate) return '';
      try {
        const parts = selectedDate.split('-');
        if (parts.length === 3) {
          const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        }
      } catch (e) {}
      return selectedDate;
    }
    if (selectedReportType === 'Annual Report') {
      return selectedYear;
    }
    return selectedMonth;
  };

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams({
        month: selectedMonth,
        year: selectedYear,
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
    setCurrentPage(1);
  }, [selectedMonth, selectedYear, selectedReportType, selectedDate]);

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
    setCurrentPage(1);
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setIsToastVisible(true);
  };

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print.');
      return;
    }

    const dateStr = new Date().toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const rowsHtml = sortedData.map(row => {
      const firstVal = `Blk ${row.block} Lot ${row.lot}`;
      const secondVal = row.resident;
      const typeText = selectedReportType === 'Daily Report' ? (row as any).referenceNumber || 'N/A' : `₱${row.monthlyDues.toLocaleString()}`;
      const amountVal = `₱${row.amountPaid.toLocaleString()}`;
      const thirdVal = selectedReportType === 'Daily Report' ? (row as any).paymentMethod || 'Cash' : `₱${row.balance.toLocaleString()}`;
      const statusColor = row.status === 'Paid' ? '#059669' : row.status === 'Pending' ? '#b45309' : '#dc2626';

      return `
        <tr>
          <td style="padding: 14px 10px; border-bottom: 1px solid #e2e8f0; color: #475569; font-weight: 500;">${firstVal}</td>
          <td style="padding: 14px 10px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 700;">${secondVal}</td>
          <td style="padding: 14px 10px; border-bottom: 1px solid #e2e8f0; color: #475569; font-weight: 500;">${typeText}</td>
          <td style="padding: 14px 10px; border-bottom: 1px solid #e2e8f0; font-weight: 800; color: #1e293b; text-align: right;">${amountVal}</td>
          <td style="padding: 14px 10px; border-bottom: 1px solid #e2e8f0; color: #475569; font-weight: 600;">${thirdVal}</td>
          <td style="padding: 14px 10px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: ${statusColor}; text-align: right;">${row.status}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>${selectedReportType.toUpperCase()} - ${getFormattedPeriod()}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
            body { font-family: 'Inter', system-ui, sans-serif; padding: 40px 40px 80px 40px; color: #1e293b; background: white; line-height: 1.5; }
            .header { text-align: center; border-bottom: 3px double #1B2A4A; padding-bottom: 24px; margin-bottom: 30px; }
            .logo-section { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 8px; }
            .logo-img { width: 44px; height: 44px; object-fit: contain; }
            .logo-text { font-size: 28px; font-weight: 800; color: #1B2A4A; text-transform: uppercase; letter-spacing: -0.03em; }
            .subtitle { font-size: 11px; color: #475569; margin: 0; text-transform: uppercase; letter-spacing: 0.08em; text-align: center; font-weight: 600; }
            .report-title { font-size: 22px; font-weight: 800; color: #0f172a; margin: 25px 0 12px 0; text-transform: uppercase; letter-spacing: -0.01em; text-align: center; }
            .profile-info { font-size: 14px; background: #f8fafc; border: 1.5px solid #e2e8f0; padding: 18px; border-radius: 12px; margin-bottom: 30px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 30px; }
            .info-item { display: flex; justify-content: space-between; border-bottom: 1px dashed #e2e8f0; padding-bottom: 4px; }
            .info-label { font-weight: 700; color: #475569; }
            .info-value { color: #0f172a; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-top: 25px; }
            th { text-align: left; padding: 14px 10px; background: transparent; color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 2px solid #e2e8f0; }
            td { font-size: 13px; }
            .footer {
              position: fixed;
              bottom: 0;
              left: 0;
              right: 0;
              font-size: 11px;
              text-align: center;
              color: #94a3b8;
              border-top: 1px solid #e2e8f0;
              padding: 12px 40px;
              background: white;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              font-weight: 600;
            }
            @media print {
              body { padding: 0 0 60px 0; }
              .footer { position: fixed; bottom: 0; left: 0; right: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-section">
              <img src="/lhhoa-logo.png" alt="LH Logo" class="logo-img" />
              <span class="logo-text">LH-CONNECT</span>
            </div>
            <div class="subtitle">LINCOLN HEIGHTS SUBD., SAN PABLO, DINALUPIHAN, BATAAN • TIN: 420-968-199-000</div>
          </div>
          
          <div class="report-title">${selectedReportType.toUpperCase()} — ${getFormattedPeriod().toUpperCase()} STATEMENT</div>
          
          <div class="profile-info">
            <div class="info-grid">
              <div>
                <div class="info-item">
                  <span class="info-label">Report Period:</span>
                  <span class="info-value">${getFormattedPeriod()}</span>
                </div>
                <div class="info-item" style="margin-top: 8px;">
                  <span class="info-label">Total Receivables:</span>
                  <span class="info-value">₱${summary?.totalDues?.toLocaleString() || 0}</span>
                </div>
              </div>
              <div>
                <div class="info-item">
                  <span class="info-label">Total Collected:</span>
                  <span class="info-value" style="color: #059669;">₱${summary?.totalCollected?.toLocaleString() || 0}</span>
                </div>
                <div class="info-item" style="margin-top: 8px;">
                  <span class="info-label">Outstanding Balance:</span>
                  <span class="info-value" style="color: #dc2626;">₱${summary?.outstandingBalance?.toLocaleString() || 0}</span>
                </div>
              </div>
            </div>
            <div style="margin-top: 12px; font-size: 12px; color: #64748b; text-align: right;">
              Collection Rate: <strong>${summary?.collectionRate || 0}%</strong> | Report Generated: <strong>${dateStr}</strong>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="width: 15%;">BLK / LOT</th>
                <th style="width: 30%;">RESIDENT NAME</th>
                <th style="width: 20%;">${selectedReportType === 'Daily Report' ? 'REF NUMBER' : 'MONTHLY DUES'}</th>
                <th style="width: 15%; text-align: right;">${selectedReportType === 'Daily Report' ? 'AMOUNT' : 'AMOUNT PAID'}</th>
                <th style="width: 10%;">${selectedReportType === 'Daily Report' ? 'METHOD' : 'BALANCE'}</th>
                <th style="width: 10%; text-align: right;">STATUS</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          
          <div class="footer">
            LINCOLN HEIGHTS HOMEOWNERS ASSOCIATION © 2026. ALL RIGHTS RESERVED.
          </div>
          
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleExportExcel = () => {
    if (financialData.length === 0) return;
    const headers = ['Block', 'Lot', 'Resident', 'Monthly Dues', 'Amount Paid', 'Balance', 'Status', 'Method'];
    const rows = (financialData || []).map(d => [
      d.block, d.lot, d.resident, d.monthlyDues, d.amountPaid, d.balance, d.status, d.paymentMethod || 'N/A'
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const periodName = selectedReportType === 'Daily Report' ? selectedDate : selectedReportType === 'Annual Report' ? selectedYear : `${selectedMonth}_${selectedYear}`;
    link.setAttribute("download", `LH-Connect_Report_${periodName}.csv`);
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
                  <div>Lincoln Heights Subd., San Pablo, Dinalupihan, Bataan</div>
                  <div>TIN: <span className={reportsStyles.printTIN}>420-968-199-000</span></div>
                </div>
              </div>
              <div className={reportsStyles.printReportDetails}>
                <h1 className={reportsStyles.printReportTitle}>{selectedReportType}</h1>
                <div className={reportsStyles.printDate}>
                  Period: {getFormattedPeriod()} | Generated: {new Date().toLocaleDateString()}
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

              {selectedReportType === 'Daily Report' && (
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className={reportsStyles.select}
                />
              )}

              {selectedReportType === 'Monthly Report' && (
                <select 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className={reportsStyles.select}
                >
                  {months.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              )}

              {selectedReportType === 'Annual Report' && (
                <select 
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className={reportsStyles.select}
                >
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
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
              <div className={reportsStyles.statHeader}>
                <span className={reportsStyles.statIcon}>👜</span>
                <span className={reportsStyles.statLabel}>
                  {selectedReportType === 'Daily Report' ? 'Total Submissions' : 'Total Receivables'}
                </span>
              </div>
              <span className={reportsStyles.statValue}>₱{summary?.totalDues?.toLocaleString() || 0}</span>
            </div>
            <div className={reportsStyles.statCard}>
              <div className={reportsStyles.statHeader}>
                <span className={reportsStyles.statIcon}>✅</span>
                <span className={reportsStyles.statLabel}>
                  {selectedReportType === 'Daily Report' ? 'Collected Today' : 'Total Collected'}
                </span>
              </div>
              <span className={reportsStyles.statValue} style={{ color: '#16a34a' }}>₱{summary?.totalCollected?.toLocaleString() || 0}</span>
            </div>
            <div className={reportsStyles.statCard}>
              <div className={reportsStyles.statHeader}>
                <span className={reportsStyles.statIcon}>⚠️</span>
                <span className={reportsStyles.statLabel}>
                  {selectedReportType === 'Daily Report' ? 'Pending/Rejected' : 'Outstanding'}
                </span>
              </div>
              <span className={reportsStyles.statValue} style={{ color: '#dc2626' }}>₱{summary?.outstandingBalance?.toLocaleString() || 0}</span>
            </div>
            <div className={reportsStyles.statCard}>
              <div className={reportsStyles.statHeader}>
                <span className={reportsStyles.statIcon}>📈</span>
                <span className={reportsStyles.statLabel}>
                  {selectedReportType === 'Daily Report' ? 'Realization Rate' : 'Collection Rate'}
                </span>
              </div>
              <span className={reportsStyles.statValue} style={{ color: '#1976d2' }}>{summary?.collectionRate || 0}%</span>
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
                  {analytics?.methods?.map(m => (
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
                    <td><span className={reportsStyles.statusIndicator} style={{ background: '#dc2626' }}></span> Declined Payments</td>
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
              {selectedReportType} — {getFormattedPeriod()}
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
                    <th className={reportsStyles.sortableHeader}>
                      {selectedReportType === 'Daily Report' ? 'Ref Number' : 'Dues'}
                    </th>
                    <th onClick={() => requestSort('amountPaid')} className={reportsStyles.sortableHeader}>
                      {selectedReportType === 'Daily Report' ? 'Amount' : 'Paid'} {sortConfig?.key === 'amountPaid' && (sortConfig.direction === 'ascending' ? '🔼' : '🔽')}
                    </th>
                    <th className={reportsStyles.sortableHeader}>
                      {selectedReportType === 'Daily Report' ? 'Method' : 'Balance'}
                    </th>
                    <th onClick={() => requestSort('status')} className={reportsStyles.sortableHeader}>
                      Status {sortConfig?.key === 'status' && (sortConfig.direction === 'ascending' ? '🔼' : '🔽')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((row) => (
                    <tr key={row.id}>
                      <td>Blk {row.block} Lot {row.lot}</td>
                      <td>{row.resident}</td>
                      <td>
                        {selectedReportType === 'Daily Report' ? (row as any).referenceNumber : `₱${row.monthlyDues.toLocaleString()}`}
                      </td>
                      <td style={{ color: row.amountPaid > 0 ? '#16a34a' : '#64748b', fontWeight: 700 }}>
                        ₱{row.amountPaid.toLocaleString()}
                      </td>
                      <td>
                        {selectedReportType === 'Daily Report' ? (row as any).paymentMethod : `₱${row.balance.toLocaleString()}`}
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

            {/* Pagination Controls */}
            {sortedData.length > ITEMS_PER_PAGE && (
              <div className={styles.pagination}>
                <span className={styles.paginationInfo}>
                  Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, sortedData.length)}–{Math.min(currentPage * ITEMS_PER_PAGE, sortedData.length)} of {sortedData.length} records
                </span>
                <div className={styles.paginationControls}>
                  <button
                    className={styles.pageBtn}
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    title="First page"
                  >
                    «
                  </button>
                  <button
                    className={styles.pageBtn}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    ‹ Prev
                  </button>
                  {Array.from({ length: Math.ceil(sortedData.length / ITEMS_PER_PAGE) }, (_, i) => i + 1)
                    .filter(page => page === 1 || page === Math.ceil(sortedData.length / ITEMS_PER_PAGE) || Math.abs(page - currentPage) <= 1)
                    .reduce((acc: (number | string)[], page, idx, arr) => {
                      if (idx > 0 && (page as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                      acc.push(page);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === '...' ? (
                        <span key={`ellipsis-${idx}`} className={styles.pageEllipsis}>…</span>
                      ) : (
                        <button
                          key={item}
                          className={`${styles.pageBtn} ${currentPage === item ? styles.pageBtnActive : ''}`}
                          onClick={() => setCurrentPage(item as number)}
                        >
                          {item}
                        </button>
                      )
                    )
                  }
                  <button
                    className={styles.pageBtn}
                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(sortedData.length / ITEMS_PER_PAGE), p + 1))}
                    disabled={currentPage === Math.ceil(sortedData.length / ITEMS_PER_PAGE)}
                  >
                    Next ›
                  </button>
                  <button
                    className={styles.pageBtn}
                    onClick={() => setCurrentPage(Math.ceil(sortedData.length / ITEMS_PER_PAGE))}
                    disabled={currentPage === Math.ceil(sortedData.length / ITEMS_PER_PAGE)}
                    title="Last page"
                  >
                    »
                  </button>
                </div>
              </div>
            )}
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
