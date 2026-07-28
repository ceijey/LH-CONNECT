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
  const [profile, setProfile] = useState<any>(null);
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
        const [data, profilePayload] = await Promise.all([
          apiCall('/api/statements'),
          apiCall('/api/auth/profile')
        ]);
        setStatements(data.statements ?? []);
        setProfile(profilePayload.user || {});
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
    const processedBills = new Set<string>();
    const processedPays = new Set<string>();
    
    statements.forEach(stmt => {
      const billKey = `${stmt.month}-${stmt.year}`;
      // Add Bill Event
      if (!processedBills.has(billKey)) {
        processedBills.add(billKey);
        events.push({
          id: `bill-${stmt.id}`,
          date: stmt.date,
          description: `Monthly Dues - ${stmt.month} ${stmt.year}`,
          type: 'BILL',
          amount: stmt.totalDues,
          status: stmt.status,
          referenceId: stmt.id
        });
      }

      // Add Payment Events
      if (stmt.relatedSubmissions) {
        stmt.relatedSubmissions.forEach(sub => {
          if (!processedPays.has(sub.id)) {
            processedPays.add(sub.id);
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
          }
        });
      }
    });

    // Sort by date descending
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [statements]);

  const filteredEvents = useMemo(() => {
    return auditEvents.filter(event => {
      // 'audit' (Full Audit Log) shows EVERYTHING from the beginning
      if (reportType === 'audit') return true;

      const eventDate = new Date(event.date);
      const eventYear = eventDate.getFullYear();
      
      // Type-specific filters
      if (reportType === 'daily') {
        const today = new Date();
        return eventDate.getDate() === today.getDate() &&
               eventDate.getMonth() === today.getMonth() &&
               eventDate.getFullYear() === today.getFullYear();
      }

      // For monthly/annual, we still respect the year filter
      return eventYear === filterYear;
    });
  }, [auditEvents, filterYear, reportType]);

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

  const handlePrintPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print.');
      return;
    }

    const userName = profile?.fullName || 'Resident';
    const block = profile?.block || 'N/A';
    const lot = profile?.lot || 'N/A';

    const householdNo = `P${profile?.phase ? profile.phase.substring(0,1) : '1'}B${block}L${lot}`;
    const address = `BLK. ${block} LOT ${lot}`;

    const reportDate = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    
    let currentMonthTotal = 0;
    let arrearsTotal = 0;
    let othersTotal = 0;
    let grandTotal = 0;

    const rowsHtml = filteredEvents.map(event => {
      const isPayment = event.type === 'PAYMENT';
      const isBill = event.type === 'BILL';
      const amount = event.amount || 0;
      
      const orNo = event.referenceId ? event.referenceId.substring(0, 8).toUpperCase() : '—';
      
      let monthLabel = '—';
      const monthMatch = event.description.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/);
      if (monthMatch) {
        const date = new Date(monthMatch[0]);
        monthLabel = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() + '-' + date.getFullYear().toString().slice(-2);
      } else {
        const d = new Date(event.date);
        monthLabel = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() + '-' + d.getFullYear().toString().slice(-2);
      }

      let currentMonthAmount = 0;
      let arrearsAmount = 0;
      let arrearsMonth = '—';
      let otherParticular = isBill ? 'MONTHLY DUES' : '—';
      let othersAmount = 0;
      let totalAmount = 0;
      
      if (isPayment) {
        currentMonthAmount = amount;
        totalAmount = amount;
        currentMonthTotal += amount;
        grandTotal += amount;
      } else if (isBill) {
        othersAmount = amount;
        othersTotal += amount;
        otherParticular = 'BILL/CHARGE';
      }

      const remarks = event.status.toUpperCase();

      return `
        <tr>
          <td>${householdNo}</td>
          <td>${userName}</td>
          <td>${address}</td>
          <td>${isPayment ? orNo : '—'}</td>
          <td class="col-small">${isPayment ? monthLabel : '—'}</td>
          <td class="col-amount">${currentMonthAmount > 0 ? '₱' + currentMonthAmount.toLocaleString() : '—'}</td>
          <td class="col-small">${arrearsMonth}</td>
          <td class="col-amount" style="color: #dc2626;">${arrearsAmount > 0 ? '₱' + arrearsAmount.toLocaleString() : '—'}</td>
          <td class="col-small">${otherParticular}</td>
          <td class="col-amount" style="color: #0284c7;">${othersAmount > 0 ? '₱' + othersAmount.toLocaleString() : '—'}</td>
          <td class="col-amount" style="font-weight: 800; color: #0f172a;">${totalAmount > 0 ? '₱' + totalAmount.toLocaleString() : '—'}</td>
          <td class="col-status" style="color: ${remarks === 'PAID' || remarks === 'CONFIRMED' ? '#16a34a' : (isBill ? '#dc2626' : '#475569')};">${remarks}</td>
        </tr>
      `;
    }).join('');

    const totalRow = `
      <tr class="total-row">
        <td colspan="5"></td>
        <td class="col-amount">₱${currentMonthTotal.toLocaleString()}</td>
        <td></td>
        <td class="col-amount" style="color: #dc2626;">₱${arrearsTotal.toLocaleString()}</td>
        <td></td>
        <td class="col-amount" style="color: #0284c7;">₱${othersTotal.toLocaleString()}</td>
        <td class="col-amount" style="font-weight: 800; color: #0f172a;">₱${grandTotal.toLocaleString()}</td>
        <td></td>
      </tr>
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>TRANSACTION HISTORY & AUDIT LOG - ${userName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
            body { font-family: 'Inter', system-ui, sans-serif; margin: 0; padding: 12px; color: #111827; background: white; }
            .brand-header { text-align: center; margin-bottom: 2px; }
            .brand-logo { width: 48px; height: 48px; border-radius: 18px; background: #eef2ff; display: inline-flex; align-items: center; justify-content: center; margin: 0 auto 2px; }
            .brand-logo img { width: auto; height: 28px; max-width: 100%; max-height: 28px; object-fit: contain; }
            .brand-title { font-size: 18px; font-weight: 900; line-height: 1.1; letter-spacing: -0.02em; margin: 0; color: #111827; }
            .brand-subtitle { font-size: 10px; color: #64748b; margin: 1px 0 0; text-transform: uppercase; letter-spacing: 0.18em; line-height: 1.2; }
            .brand-divider { width: 100%; max-width: 640px; height: 1px; background: #0f172a; margin: 2px auto 4px; }
            .header { text-align: center; margin-bottom: 2px; }
            .report-title { font-size: 24px; font-weight: 900; margin: 0; letter-spacing: -0.02em; text-transform: uppercase; }
            .report-date { margin: 0; font-size: 12px; color: #475569; }
            .table-wrapper { overflow-x: auto; }
            table { width: 100%; border-collapse: collapse; border: 1px solid #1f2937; margin-top: 15px; }
            th, td { border: 1px solid #1f2937; padding: 6px 6px; font-size: 10px; }
            th { background: #1f2937; color: white; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; text-align: center; }
            td { vertical-align: top; color: #111827; }
            .col-amount { text-align: right; font-weight: 700; }
            .col-status { text-align: right; font-weight: 700; }
            .col-small { font-size: 10px; color: #475569; text-align: center; }
            .total-row td { background: #f8fafc; }
            .footer { margin-top: 10px; font-size: 10px; color: #475569; text-align: right; }
            @media print {
              @page { margin: 16mm; size: landscape; }
              body { margin: 0; }
              .footer { position: fixed; bottom: 0; left: 0; right: 0; }
            }
          </style>
        </head>
        <body>
          <div class="brand-header">
            <div class="brand-logo">
              <img src="/lhhoa-logo.png" alt="LH Logo" />
            </div>
            <div class="brand-title">LH-CONNECT</div>
            <div class="brand-subtitle">LINCOLN HEIGHTS SUBD., SAN PABLO, DINALUPIHAN, BATAAN • TIN: 420-968-199-000</div>
            <div class="brand-divider"></div>
          </div>

          <div class="header">
            <div class="report-title">TRANSACTION HISTORY & AUDIT LOG</div>
            <div class="report-date">${reportDate}</div>
          </div>

          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th rowspan="2" style="width: 9%;">HOUSEHOLD NO.</th>
                  <th rowspan="2" style="width: 14%;">NAME</th>
                  <th rowspan="2" style="width: 14%;">ADDRESS</th>
                  <th rowspan="2" style="width: 9%;">OR NO.</th>
                  <th colspan="2" style="width: 12%;">CURRENT MONTH</th>
                  <th colspan="2" style="width: 12%;">ARREARS</th>
                  <th colspan="2" style="width: 12%;">OTHERS</th>
                  <th rowspan="2" style="width: 10%;">TOTAL COLLECTION</th>
                  <th rowspan="2" style="width: 8%;">REMARKS</th>
                </tr>
                <tr>
                  <th>MONTH</th>
                  <th>AMOUNT</th>
                  <th>MONTH</th>
                  <th>AMOUNT</th>
                  <th>PARTICULAR</th>
                  <th>AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
                ${totalRow}
              </tbody>
            </table>
          </div>

          <div class="footer">LINCOLN HEIGHTS HOMEOWNERS ASSOCIATION © ${new Date().getFullYear()}. ALL RIGHTS RESERVED.</div>
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

            <button 
              className={styles.downloadReportBtn}
              onClick={handlePrintPDF}
              disabled={filteredEvents.length === 0}
            >
              ⬇ Export PDF
            </button>
          </div>
        </section>

        <section className={styles.tableSection}>
          <div className={styles.tableCard} style={{ padding: 0 }}>
            <div style={{ overflowX: 'auto', background: 'white', borderRadius: '12px' }}>
              <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Monthly Dues - Table View</h2>
                  <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '4px 0 0 0' }}>Overview of all monthly dues payments for {filterYear}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem', fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '4px', background: '#dcfce7', border: '1px solid #bbf7d0' }}></span>
                    <span style={{ color: '#166534' }}>Paid</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '4px', background: '#fee2e2', border: '1px solid #fecaca' }}></span>
                    <span style={{ color: '#991b1b' }}>Unpaid</span>
                  </div>
                </div>
              </div>
              <table style={{ minWidth: '1000px', width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '12px 14px', background: '#f8fafc', fontSize: '12px', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>PHASE</th>
                    <th style={{ padding: '12px 14px', background: '#f8fafc', fontSize: '12px', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>BLOCK</th>
                    <th style={{ padding: '12px 14px', background: '#f8fafc', fontSize: '12px', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>LOT</th>
                    <th style={{ padding: '12px 14px', background: '#f8fafc', fontSize: '12px', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>OWNER</th>
                    <th style={{ padding: '12px 14px', background: '#f8fafc', fontSize: '12px', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>PAST DUE</th>
                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                      <th key={m} style={{ padding: '12px 14px', background: '#f8fafc', fontSize: '12px', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{m.substring(0, 3).toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '14px', fontWeight: 600, color: '#0f172a', borderBottom: '1px solid #e2e8f0', fontSize: '13px' }}>{profile?.phase || '-'}</td>
                    <td style={{ padding: '14px', fontWeight: 600, color: '#0f172a', borderBottom: '1px solid #e2e8f0', fontSize: '13px' }}>{profile?.block || '-'}</td>
                    <td style={{ padding: '14px', fontWeight: 600, color: '#0f172a', borderBottom: '1px solid #e2e8f0', fontSize: '13px' }}>{profile?.lot || '-'}</td>
                    <td style={{ padding: '14px', fontWeight: 500, color: '#334155', borderBottom: '1px solid #e2e8f0', fontSize: '13px' }}>{profile?.fullName || '-'}</td>
                    <td style={{ padding: '14px', fontWeight: 600, background: profile?.balance > 0 ? '#fee2e2' : '#dcfce7', color: profile?.balance > 0 ? '#991b1b' : '#166534', borderBottom: '1px solid #e2e8f0', fontSize: '13px' }}>
                      ₱{Number(profile?.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(month => {
                      const stmt = statements.find(s => s.month === month && Number(s.year) === filterYear);
                      if (!stmt) {
                        return <td key={month} style={{ padding: '14px', background: '#f8fafc', color: '#cbd5e1', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>-</td>;
                      }
                      const isPaid = stmt.status === 'Paid' || stmt.balance === 0;
                      const displayAmount = stmt.totalDues || 400;
                      return (
                        <td key={month} style={{
                          padding: '14px',
                          background: isPaid ? '#dcfce7' : '#fee2e2',
                          color: isPaid ? '#166534' : '#991b1b',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          borderBottom: '1px solid #e2e8f0',
                          fontSize: '13px'
                        }}>
                          ₱{Number(displayAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* PRINT ONLY SECTION */}
        <div className={styles.printOnlyHeader}>
          <div className={styles.printBrand}>
            <h1>LH-Connect</h1>
            <p>San Pablo Dinalupihan Bataan • TIN: 480-266-103-000</p>
          </div>
          <div className={styles.printTitle}>
            <h2>{reportType.toUpperCase()} REPORT - {filterYear}</h2>
            <p>Generated on: {new Date().toLocaleString()}</p>
          </div>
        </div>

        <div className={styles.printOnlyFooter}>
          <p>LH-Connect Community Management • All Rights Reserved</p>
          <p>This is an official transaction log generated via LH-Connect Portal.</p>
        </div>
      </main>
    </div>
  );
}
