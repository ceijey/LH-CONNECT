'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { apiCall } from '@/lib/api-client';
import { logoutAndRedirect } from '@/lib/auth-session';
import { useAuthPageshow } from '@/lib/useAuthPageshow';
import LoadingScreen from '@/app/components/LoadingScreen';
import styles from './activity.module.css';

export default function ResidentActivityPage() {
  const router = useRouter();
  useAuthPageshow('resident');

  const [statements, setStatements] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchActivity = async () => {
    try {
      setLoading(true);
      const [payload, profilePayload] = await Promise.all([
        apiCall('/api/statements'),
        apiCall('/api/auth/profile')
      ]);
      setStatements(payload.statements ?? []);
      setProfile(profilePayload.user || {});
    } catch (err: any) {
      setError(err.message || 'Failed to load activity logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity();
  }, []);

  // Compute unified chronological activity log
  const activityLog = useMemo(() => {
    const events: any[] = [];
    
    statements.forEach(stmt => {
      // Add Bill Event
      events.push({
        id: `bill-${stmt.id}`,
        date: stmt.date || new Date().toISOString(),
        description: `Monthly Dues - ${stmt.month} ${stmt.year}`,
        type: 'BILL',
        amount: Number(stmt.totalDues || 0),
        status: stmt.status,
      });

      // Add Payment Events from related submissions
      if (stmt.relatedSubmissions) {
        stmt.relatedSubmissions.forEach((sub: any) => {
          events.push({
            id: `pay-${sub.id}`,
            date: sub.verifiedAt || sub.verifiedDate || sub.submittedDate || stmt.date,
            description: `Payment - ${stmt.month} ${stmt.year}`,
            type: 'PAYMENT',
            amount: Number(sub.paymentAmount || 0),
            status: sub.status,
          });
        });
      }
    });

    // Sort by date descending
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [statements]);

  const handlePrintReport = () => {
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

    const rowsHtml = activityLog.map(event => `
      <tr>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: ${event.type === 'BILL' ? '#e11d48' : '#059669'};">${event.type}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 600;">${event.description}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; color: #475569;">${new Date(event.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #475569;">${event.status ?? 'Pending'}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-weight: 800; text-align: right; color: ${event.type === 'BILL' ? '#e11d48' : '#059669'};">
          ${event.type === 'BILL' ? '-' : '+'}₱${event.amount.toLocaleString()}
        </td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Account Activity Report - ${userName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
            body { font-family: 'Inter', system-ui, sans-serif; padding: 40px; color: #1e293b; background: white; line-height: 1.5; }
            .header { text-align: center; border-bottom: 3px double #1B2A4A; padding-bottom: 24px; margin-bottom: 30px; }
            .logo { font-size: 28px; font-weight: 800; color: #1B2A4A; text-transform: uppercase; letter-spacing: -0.03em; margin-bottom: 6px; }
            .subtitle { font-size: 13px; color: #64748b; margin: 0; text-transform: uppercase; letter-spacing: 0.05em; }
            .report-title { font-size: 22px; font-weight: 800; color: #0f172a; margin: 20px 0 12px 0; text-transform: uppercase; letter-spacing: -0.01em; }
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
            <div class="logo">Lincoln Heights HOA</div>
            <div class="subtitle">Community Management & Resident Connection Portal</div>
          </div>
          
          <div class="report-title">Account Activity Ledger</div>
          
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
                <th>Type</th>
                <th>Description</th>
                <th>Transaction Date</th>
                <th>Status</th>
                <th style="text-align: right;">Amount</th>
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

  if (loading) {
    return <LoadingScreen message="Loading account activity..." />;
  }

  return (
    <div className={styles.container}>
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
                <p className={styles.headerSubtitle}>Account Activity</p>
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
          <div className={styles.heroHeader}>
            <div>
              <h2 className={styles.pageTitle}>📋 Recent Account Activity</h2>
              <p className={styles.pageSubtitle}>
                A comprehensive history of your monthly dues, billings, and payment submissions.
              </p>
            </div>
            <button 
              className={styles.printBtn} 
              onClick={handlePrintReport}
              disabled={activityLog.length === 0}
            >
              🖨️ Export PDF Ledger
            </button>
          </div>
        </section>

        {error && (
          <div className={styles.errorBanner}>
            ⚠️ {error}
          </div>
        )}

        <section className={styles.timelineSection}>
          {activityLog.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📂</div>
              <h3 className={styles.emptyTitle}>No activity logged yet</h3>
              <p className={styles.emptyText}>Your billing history and payment submissions will show up here as they are processed.</p>
            </div>
          ) : (
            <div className={styles.timelineList}>
              {activityLog.map((event) => (
                <div key={event.id} className={`${styles.timelineCard} ${event.type === 'BILL' ? styles.billCardAccent : styles.payCardAccent}`}>
                  <div className={styles.cardInfo}>
                    <div className={styles.activityHeader}>
                      <span className={`${styles.typeBadge} ${event.type === 'BILL' ? styles.billBadge : styles.payBadge}`}>
                        {event.type}
                      </span>
                      <span className={`${styles.statusBadge} ${styles[(event.status ?? 'pending').toLowerCase().replace(/\s/g, '')]}`}>
                        {event.status ?? 'Pending'}
                      </span>
                    </div>
                    <h4 className={styles.activityTitle}>{event.description}</h4>
                    <p className={styles.activityDate}>
                      📅 {new Date(event.date).toLocaleDateString(undefined, {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  <div className={styles.cardAmount}>
                    <span className={`${styles.amountText} ${event.type === 'BILL' ? styles.billAmount : styles.payAmount}`}>
                      {event.type === 'BILL' ? '-' : '+'}₱{event.amount.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
