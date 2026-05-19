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
    
    statements.forEach(stmt => {
      // Add Bill Event
      events.push({
        id: `bill-${stmt.id}`,
        date: stmt.date,
        description: `Monthly Dues - ${stmt.month} ${stmt.year}`,
        type: 'BILL',
        amount: stmt.totalDues,
        status: stmt.status,
        referenceId: stmt.id
      });

      // Add Payment Events
      if (stmt.relatedSubmissions) {
        stmt.relatedSubmissions.forEach(sub => {
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
    const email = profile?.email || 'N/A';
    const phase = profile?.phase || 'Lincoln Heights';
    const block = profile?.block || 'N/A';
    const lot = profile?.lot || 'N/A';

    const dateStr = new Date().toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const rowsHtml = filteredEvents.map(event => `
      <tr>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 500;">
          ${new Date(event.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 600;">${event.description}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: ${event.type === 'BILL' ? '#e11d48' : '#059669'};">${event.type}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-weight: 800; color: ${event.type === 'BILL' ? '#dc2626' : '#15803d'}; text-align: right;">
          ${event.type === 'BILL' ? '+' : '-'} ₱${event.amount.toLocaleString()}
        </td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #475569;">${event.status}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Billing Audit Log - ${userName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
            body { font-family: 'Inter', system-ui, sans-serif; padding: 40px; color: #1e293b; background: white; line-height: 1.5; }
            .header { text-align: center; border-bottom: 3px double #1B2A4A; padding-bottom: 24px; margin-bottom: 30px; }
            .logo-section { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 8px; }
            .logo-img { width: 44px; height: 44px; object-fit: contain; }
            .logo-text { font-size: 28px; font-weight: 800; color: #1B2A4A; text-transform: uppercase; letter-spacing: -0.03em; }
            .subtitle { font-size: 13px; color: #64748b; margin: 0; text-transform: uppercase; letter-spacing: 0.05em; text-align: center; }
            .report-title { font-size: 22px; font-weight: 800; color: #0f172a; margin: 25px 0 12px 0; text-transform: uppercase; letter-spacing: -0.01em; text-align: center; }
            .profile-info { font-size: 14px; background: #f8fafc; border: 1.5px solid #e2e8f0; padding: 18px; border-radius: 12px; margin-bottom: 30px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 30px; }
            .info-item { display: flex; justify-content: space-between; border-bottom: 1px dashed #e2e8f0; padding-bottom: 4px; }
            .info-label { font-weight: 700; color: #475569; }
            .info-value { color: #0f172a; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-top: 25px; }
            th { text-align: left; padding: 14px 10px; background: #1B2A4A; color: white; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border: none; }
            td { font-size: 13px; }
            tr:nth-child(even) td { background: #f8fafc; }
            .footer { margin-top: 60px; font-size: 11px; text-align: center; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; text-transform: uppercase; letter-spacing: 0.05em; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-section">
              <img src="/lhhoa-logo.png" alt="LH Logo" class="logo-img" />
              <span class="logo-text">LH-Connect</span>
            </div>
            <div class="subtitle">Sta Rosa Delosguzon Suban • TIN: 420-968-199-000</div>
          </div>
          
          <div class="report-title">Billing Audit Log — ${reportType.toUpperCase()} Statement</div>
          
          <div class="profile-info">
            <div class="info-grid">
              <div>
                <div class="info-item">
                  <span class="info-label">Resident Name:</span>
                  <span class="info-value">${userName}</span>
                </div>
                <div class="info-item" style="margin-top: 8px;">
                  <span class="info-label">Email Address:</span>
                  <span class="info-value">${email}</span>
                </div>
              </div>
              <div>
                <div class="info-item">
                  <span class="info-label">Location Phase:</span>
                  <span class="info-value">${phase}</span>
                </div>
                <div class="info-item" style="margin-top: 8px;">
                  <span class="info-label">Block / Lot:</span>
                  <span class="info-value">Block ${block} - Lot ${lot}</span>
                </div>
              </div>
            </div>
            <div style="margin-top: 12px; font-size: 12px; color: #64748b; text-align: right;">
              Report Generated: <strong>${dateStr}</strong>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Transaction Description</th>
                <th>Type</th>
                <th style="text-align: right;">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          
          <div class="footer">
            Lincoln Heights Homeowners Association © 2026. All rights reserved.
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
            <div className={styles.controlGroup}>
              <label>Report Type</label>
              <select value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)}>
                <option value="audit">Full Activity History</option>
                <option value="daily">Daily Activity</option>
                <option value="monthly">Monthly Summary</option>
                <option value="annual">Annual Statement</option>
              </select>
            </div>
            <div className={styles.controlGroup}>
              <label>Year</label>
              <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))}>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                {availableYears.length === 0 && <option value={currentYear}>{currentYear}</option>}
              </select>
            </div>
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
          <div className={styles.tableCard}>
            <table className={styles.auditTable}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Transaction Description</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length > 0 ? (
                  filteredEvents.map((event) => (
                    <tr key={event.id} className={styles.tableRow}>
                      <td className={styles.dateCell}>
                        {new Date(event.date).toLocaleDateString(undefined, { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </td>
                      <td className={styles.descCell}>{event.description}</td>
                      <td className={styles.typeCell}>
                        <span className={`${styles.typeBadge} ${styles[(event.type || 'bill').toLowerCase()]}`}>
                          {event.type}
                        </span>
                      </td>
                      <td className={styles.amountCell}>
                        <span className={event.type === 'BILL' ? styles.billAmount : styles.payAmount}>
                          {event.type === 'BILL' ? '+' : '-'} ₱{event.amount.toLocaleString()}
                        </span>
                      </td>
                      <td className={styles.statusCell}>
                        <span className={`${styles.statusBadge} ${styles[(event.status || 'pending').toLowerCase().replace(/\s/g, '')]}`}>
                          {event.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className={styles.noData}>
                      No transactions found for {filterYear}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
