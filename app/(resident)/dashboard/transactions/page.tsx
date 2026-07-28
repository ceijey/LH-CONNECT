'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiCall } from '@/lib/api-client';
import { useAuthPageshow } from '@/lib/useAuthPageshow';
import LoadingScreen from '@/app/components/LoadingScreen';
import styles from './transactions.module.css';

export default function TransactionsPage() {
  const router = useRouter();
  useAuthPageshow('resident');
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'All' | 'Paid' | 'Pending' | 'Rejected'>('All');
  const [statements, setStatements] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadError('');
        const payload = await apiCall('/api/statements');
        setStatements(payload.statements || []);

        try {
          const profilePayload = await apiCall('/api/auth/profile');
          setProfile(profilePayload.user || null);
        } catch (profileError) {
          console.warn('Failed to load profile', profileError);
          setProfile(null);
        }
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

    const rowsHtml = filteredTransactions.map(event => {
      const isPayment = event.type === 'PAYMENT';
      const isBill = event.type === 'BILL';
      const amount = event.amount || 0;
      
      const orNo = isPayment ? (event.id.replace('pay-', '').substring(0, 8).toUpperCase()) : '—';
      
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
          <td class="col-status" style="color: ${remarks === 'PAID' || remarks === 'CONFIRMED' || remarks === 'VERIFIED' ? '#16a34a' : (isBill ? '#dc2626' : '#475569')};">${remarks}</td>
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
    return <LoadingScreen message="Loading transaction history..." />;
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
        <div className={styles.printHeader}>
          <div className={styles.printHeaderCard}>
            <div className={styles.printBrand}>
              <img src="/lhhoa-logo.png" alt="LHconnect logo" className={styles.printLogo} />
              <div>
                <div className={styles.printBrandName}>LHconnect</div>
                <div className={styles.printSubtitle}>Transaction Audit Log</div>
              </div>
            </div>
            <div className={styles.printHeaderFields}>
              <div className={styles.printField}>
                <span className={styles.printFieldLabel}>Resident</span>
                <span className={styles.printFieldValue}>{profile?.fullName || 'N/A'}</span>
              </div>
              <div className={styles.printField}>
                <span className={styles.printFieldLabel}>Unit</span>
                <span className={styles.printFieldValue}>{profile?.phase ? `${profile.phase} - Block ${profile.block}, Lot ${profile.lot}` : 'N/A'}</span>
              </div>
              <div className={styles.printField}>
                <span className={styles.printFieldLabel}>Contact</span>
                <span className={styles.printFieldValue}>{profile?.phone || profile?.email || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>

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
            <div className={`${styles.summaryValue} ${styles.paidValue}`}>₱{totalPaid.toLocaleString()}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>Net Balance</div>
            <div className={`${styles.summaryValue} ${styles.balanceValue}`}>₱{(totalBilled - totalPaid).toLocaleString()}</div>
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
                    <th rowSpan={2} className={styles.thDate}>Date</th>
                    <th colSpan={2} className={styles.thGroup}>Transaction Details</th>
                    <th colSpan={1} className={styles.thGroup}>Financials</th>
                    <th rowSpan={2} className={styles.thStatus}>Status</th>
                  </tr>
                  <tr>
                    <th className={styles.thSub}>Type</th>
                    <th className={styles.thSub}>Description</th>
                    <th className={styles.thSub}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((t) => (
                    <tr key={t.id} className={styles.tableRow}>
                      <td className={styles.dateCell}>{new Date(t.date).toLocaleDateString()}</td>
                      <td className={styles.typeCell}>
                        <div className={styles.typeBadgeGroup}>
                          <span className={`${styles.typeBadge} ${styles[t.type.toLowerCase()]}`}>
                            {t.type}
                          </span>
                          <span className={styles.typeTag}>T</span>
                        </div>
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
                          <span className={styles.statusIcon}>
                            {t.status === 'Paid' ? '✔' : t.status === 'Pending' ? '⏳' : '•'}
                          </span>
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

        <div className={styles.printFooter}>
          <span>LHconnect • Transaction Audit Log</span>
        </div>

        <section className={styles.downloadSection}>
          <button className={styles.downloadBtn} onClick={handleDownloadCSV} disabled={isDownloading || filteredTransactions.length === 0}>
            📥 {isDownloading ? 'Downloading...' : 'Download Full History (CSV)'}
          </button>
          <button className={styles.printBtn} onClick={handlePrintPDF}>
            🖨️ Print Audit Log
          </button>
        </section>
      </main>
    </div>
  );
}
