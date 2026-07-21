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
      if (selectedReportType === 'Daily Report' && row.amountPaid <= 0) return '';
      if (row.amountPaid <= 0 && row.status !== 'Paid') return '';

      const monthlyDue = 400;
      let currentMonthAmount = 0;
      let arrearsAmount = 0;
      
      if (row.amountPaid > monthlyDue) {
         currentMonthAmount = monthlyDue;
         arrearsAmount = row.amountPaid - monthlyDue;
      } else if (row.amountPaid > 0) {
         currentMonthAmount = row.amountPaid;
      }

      const othersAmount = 0;
      const totalAmount = row.amountPaid;

      const householdNo = `B${row.block} L${row.lot}`;
      const name = row.resident;
      const orNo = (row as any).referenceNumber || '—';
      const remarks = row.paymentMethod === 'Gcash' || row.paymentMethod === 'GCash' ? 'GCASH' : (row.paymentMethod?.toUpperCase() || 'CASH');

      return `
        <tr>
          <td class="col-blk">${householdNo}</td>
          <td class="col-name">${name}</td>
          <td class="col-orno">${orNo}</td>
          <td class="col-amount">${currentMonthAmount > 0 ? '₱' + currentMonthAmount.toLocaleString() : '—'}</td>
          <td class="col-amount" style="color: #dc2626;">${arrearsAmount > 0 ? '₱' + arrearsAmount.toLocaleString() : '—'}</td>
          <td class="col-amount" style="color: #0284c7;">${othersAmount > 0 ? '₱' + othersAmount.toLocaleString() : '—'}</td>
          <td class="col-amount" style="font-weight: 800; color: #16a34a;">₱${totalAmount.toLocaleString()}</td>
          <td class="col-status" style="color: ${remarks.includes('GCASH') ? '#dc2626' : '#475569'};">${remarks}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>${selectedReportType.toUpperCase()} - ${getFormattedPeriod()}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
            body { font-family: 'Inter', system-ui, sans-serif; padding: 40px; color: #1e293b; background: white; line-height: 1.5; }
            .header { text-align: center; border-bottom: 2px solid #1B2A4A; padding-bottom: 20px; margin-bottom: 25px; }
            .logo-section { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 6px; }
            .logo-img { width: 48px; height: 48px; object-fit: contain; }
            .logo-text { font-size: 30px; font-weight: 900; color: #1B2A4A; text-transform: uppercase; letter-spacing: -0.02em; }
            .subtitle { font-size: 11px; color: #64748b; margin: 0; text-transform: uppercase; letter-spacing: 0.1em; text-align: center; font-weight: 600; }
            .report-title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.02em; text-align: center; }
            .profile-info { background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 16px; text-align: center; }
            .info-item { display: flex; flex-direction: column; gap: 4px; border-right: 1px solid #e2e8f0; }
            .info-item:last-child { border-right: none; }
            .info-label { font-weight: 600; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
            .info-value { color: #0f172a; font-weight: 700; font-size: 16px; }
            .rate-footer { margin-top: 16px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center; display: flex; justify-content: space-between; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { text-align: left; padding: 12px 14px; background: #1B2A4A; color: white; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; border: none; }
            td { font-size: 12px; padding: 12px 14px; border-bottom: 1px solid #e2e8f0; color: #334155; }
            tr:nth-child(even) td { background-color: #f8fafc; }
            .col-blk { font-weight: 600; color: #475569; }
            .col-name { font-weight: 700; color: #0f172a; }
            .col-orno { color: #64748b; font-size: 11px; }
            .col-amount { font-weight: 700; color: #0f172a; text-align: right; }
            .col-status { font-weight: 800; text-align: right; font-size: 11px; }
            .footer { position: fixed; bottom: 0; left: 0; right: 0; font-size: 10px; text-align: center; color: #94a3b8; border-top: 1px solid #e2e8f0; padding: 15px 40px; background: white; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; }
            tr { page-break-inside: avoid; }
            @media print {
              @page { margin-bottom: 25mm; margin-top: 20mm; }
              body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
          
          <div class="report-title">${selectedReportType.toUpperCase()} — ${getFormattedPeriod().toUpperCase()}</div>
          
          <div class="profile-info">
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Report Period</span>
                <span class="info-value">${getFormattedPeriod()}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Total Receivables</span>
                <span class="info-value">₱${summary?.totalDues?.toLocaleString() || 0}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Total Collected</span>
                <span class="info-value" style="color: #059669;">₱${summary?.totalCollected?.toLocaleString() || 0}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Outstanding Balance</span>
                <span class="info-value" style="color: #dc2626;">₱${summary?.outstandingBalance?.toLocaleString() || 0}</span>
              </div>
            </div>
            <div class="rate-footer">
              <span>Report Generated: <strong>${dateStr}</strong></span>
              <span>Collection Rate: <strong style="color: #0f172a; font-size: 12px;">${summary?.collectionRate || 0}%</strong></span>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="width: 12%;">HOUSEHOLD</th>
                <th style="width: 25%;">NAME</th>
                <th style="width: 15%;">OR NO.</th>
                <th style="width: 10%; text-align: right;">CURRENT</th>
                <th style="width: 10%; text-align: right;">ARREARS</th>
                <th style="width: 10%; text-align: right;">OTHERS</th>
                <th style="width: 10%; text-align: right;">TOTAL</th>
                <th style="width: 8%; text-align: right;">REMARKS</th>
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

  const handleExportExcel = async () => {
    if (financialData.length === 0) {
      showToast('No data to export', 'error');
      return;
    }

    try {
      const XLSX = await import('xlsx-js-style');
      
      const wb = XLSX.utils.book_new();

      const reportDate = selectedReportType === 'Daily Report' && selectedDate 
        ? new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        : getFormattedPeriod();

      const wsData: any[][] = [
        ['DAILY COLLECTION REPORT'],
        [reportDate],
        [
          'HOUSEHOLD NO.', 'NAME', 'ADDRESS', 'OR NO.', 
          'CURRENT MONTH', '', 'ARREARS', '', 'OTHERS', '', 
          'TOTAL COLLECTION', 'REMARKS'
        ],
        [
          '', '', '', '', 
          'MONTH', 'AMOUNT', 'MONTH', 'AMOUNT', 'PARTICULAR', 'AMOUNT', 
          '', ''
        ]
      ];

      let currentMonthTotal = 0;
      let arrearsTotal = 0;
      let othersTotal = 0;
      let grandTotal = 0;
      let gcashTotal = 0;

      const dateObj = selectedReportType === 'Daily Report' && selectedDate ? new Date(selectedDate) : new Date();
      const currentMonthStr = dateObj.toLocaleDateString('en-US', { month: 'short' }) + '-' + dateObj.getFullYear().toString().slice(-2);

      sortedData.forEach(row => {
        if (selectedReportType === 'Daily Report' && row.amountPaid <= 0) return;
        if (row.amountPaid <= 0 && row.status !== 'Paid') return;

        const householdNo = `B${row.block}L${row.lot}`;
        const name = row.resident;
        const address = `Blk. ${row.block} Lot ${row.lot}`;
        const orNo = (row as any).referenceNumber || '';
        
        let currentMonthAmount = 0;
        let currentMonthLabel = '';
        let arrearsAmount = 0;
        let arrearsLabel = '';

        const monthlyDue = 400; 
        if (row.amountPaid > monthlyDue) {
           currentMonthAmount = monthlyDue;
           currentMonthLabel = currentMonthStr;
           arrearsAmount = row.amountPaid - monthlyDue;
           arrearsLabel = 'ARREARS';
        } else if (row.amountPaid > 0) {
           currentMonthAmount = row.amountPaid;
           currentMonthLabel = currentMonthStr;
        }

        const particular = '';
        const othersAmount = 0;
        const total = row.amountPaid;
        const remarks = row.paymentMethod === 'Gcash' || row.paymentMethod === 'GCash' ? 'GCASH' : (row.paymentMethod?.toUpperCase() || '');

        if (remarks === 'GCASH' || remarks.includes('GCASH')) gcashTotal += total;

        currentMonthTotal += currentMonthAmount;
        arrearsTotal += arrearsAmount;
        othersTotal += othersAmount;
        grandTotal += total;

        wsData.push([
          householdNo,
          name,
          address,
          orNo,
          currentMonthLabel,
          currentMonthAmount || '',
          arrearsLabel,
          arrearsAmount || '',
          particular,
          othersAmount || '',
          total || '',
          remarks === 'GCASH' ? remarks : ''
        ]);
      });

      wsData.push([
        '', '', '', '', '', currentMonthTotal || '', '', arrearsTotal || '', '', othersTotal || '', grandTotal || '', ''
      ]);
      wsData.push(['', '', '', '', '', '', '', '', '', 'GCASH', gcashTotal || '', '']);
      wsData.push(['', '', '', '', '', '', '', '', '', 'TOTAL CASH REMITTED', (grandTotal - gcashTotal) || '', '']);

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }, 
        { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } }, 
        { s: { r: 2, c: 0 }, e: { r: 3, c: 0 } }, 
        { s: { r: 2, c: 1 }, e: { r: 3, c: 1 } }, 
        { s: { r: 2, c: 2 }, e: { r: 3, c: 2 } }, 
        { s: { r: 2, c: 3 }, e: { r: 3, c: 3 } }, 
        { s: { r: 2, c: 4 }, e: { r: 2, c: 5 } }, 
        { s: { r: 2, c: 6 }, e: { r: 2, c: 7 } }, 
        { s: { r: 2, c: 8 }, e: { r: 2, c: 9 } }, 
        { s: { r: 2, c: 10 }, e: { r: 3, c: 10 } }, 
        { s: { r: 2, c: 11 }, e: { r: 3, c: 11 } }, 
      ];

      ws['!cols'] = [
        { wch: 15 }, { wch: 30 }, { wch: 25 }, { wch: 15 },
        { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 },
        { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }
      ];

      // APPLY STYLES
      const range = XLSX.utils.decode_range(ws['!ref'] as string);
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
          if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' };

          const isTitle = R === 0 || R === 1;
          const isHeader = R === 2 || R === 3;
          
          let style: any = {
            font: { name: 'Arial', sz: 9 },
            alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
            border: {
              top: { style: 'thin', color: { auto: 1 } },
              bottom: { style: 'thin', color: { auto: 1 } },
              left: { style: 'thin', color: { auto: 1 } },
              right: { style: 'thin', color: { auto: 1 } }
            }
          };

          if (isTitle) {
            style.font.bold = true;
            style.font.sz = R === 0 ? 14 : 12;
            style.border = {}; // No borders for title
          }

          if (isHeader) {
            style.font.bold = true;
          }

          // ARREARS red
          if (R === 2 && C === 6) style.font.color = { rgb: "FF0000" };
          if (R === 3 && (C === 6 || C === 7)) style.font.color = { rgb: "FF0000" };

          // OTHERS blue
          if (R === 2 && C === 8) style.font.color = { rgb: "00B0F0" };
          if (R === 3 && (C === 8 || C === 9)) style.font.color = { rgb: "00B0F0" };

          // REMARKS red (Header & Data)
          if ((R === 2 || R > 3) && C === 11) {
            style.font.bold = true;
            style.font.color = { rgb: "FF0000" };
          }
          
          // Data rows Name/Address alignment
          if (R > 3 && (C === 1 || C === 2)) {
            style.alignment.horizontal = 'left';
          }

          // Number formats
          if (R > 3 && (C === 5 || C === 7 || C === 9 || C === 10)) {
            ws[cellRef].z = '#,##0.00';
            style.alignment.horizontal = 'right';
          }

          ws[cellRef].s = style;
        }
      }

      // Format Totals Row (3 rows from bottom)
      const lastRow = range.e.r;
      const totalTotalsRow = lastRow - 2;
      for (let C = 0; C <= 11; C++) {
        const cellRef = XLSX.utils.encode_cell({ c: C, r: totalTotalsRow });
        if (ws[cellRef]) ws[cellRef].s.font.bold = true;
      }
      
      const mainTotalCell = XLSX.utils.encode_cell({ c: 10, r: totalTotalsRow });
      if (ws[mainTotalCell]) {
        ws[mainTotalCell].s.fill = { fgColor: { rgb: "FFFF00" } };
        ws[mainTotalCell].s.font.color = { rgb: "FF0000" }; // red like image
      }

      const remarksTotalCell = XLSX.utils.encode_cell({ c: 11, r: totalTotalsRow });
      if (ws[remarksTotalCell]) {
        ws[remarksTotalCell].s.fill = { fgColor: { rgb: "FFFF00" } };
      }

      // GCASH row styling
      const gcashRow = lastRow - 1;
      const gcashLabel = XLSX.utils.encode_cell({ c: 9, r: gcashRow });
      const gcashVal = XLSX.utils.encode_cell({ c: 10, r: gcashRow });
      if(ws[gcashLabel]) {
        ws[gcashLabel].s.font.bold = true;
        ws[gcashLabel].s.font.color = { rgb: "FF0000" };
        ws[gcashLabel].s.alignment.horizontal = 'right';
      }
      if(ws[gcashVal]) {
        ws[gcashVal].s.font.bold = true;
        ws[gcashVal].s.font.color = { rgb: "FF0000" };
        ws[gcashVal].s.alignment.horizontal = 'right';
      }

      // REMITTED row styling
      const remittedRow = lastRow;
      const remittedLabel = XLSX.utils.encode_cell({ c: 9, r: remittedRow });
      const remittedVal = XLSX.utils.encode_cell({ c: 10, r: remittedRow });
      if(ws[remittedLabel]) {
        ws[remittedLabel].s.font.bold = true;
        ws[remittedLabel].s.alignment.horizontal = 'right';
      }
      if(ws[remittedVal]) {
        ws[remittedVal].s.font.bold = true;
        ws[remittedVal].s.alignment.horizontal = 'right';
      }

      XLSX.utils.book_append_sheet(wb, ws, 'Daily Report');

      const periodName = selectedReportType === 'Daily Report' ? selectedDate : selectedReportType === 'Annual Report' ? selectedYear : `${selectedMonth}_${selectedYear}`;
      XLSX.writeFile(wb, `LH-Connect_Collection_Report_${periodName}.xlsx`);

      showToast('Report exported to Excel successfully', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error exporting report', 'error');
    }
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
