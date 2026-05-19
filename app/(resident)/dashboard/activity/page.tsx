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

interface PaymentRecord {
  id: string;
  amount: number;
  type: string;
  description: string;
  paymentMethod?: string;
  referenceNumber?: string;
  status: string;
  date: string;
}

export default function ResidentActivityPage() {
  const router = useRouter();
  useAuthPageshow('resident');

  const [statements, setStatements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchActivity = async () => {
    try {
      setLoading(true);
      const payload = await apiCall('/api/statements');
      setStatements(payload.statements ?? []);
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
          <h2 className={styles.pageTitle}>📋 Recent Account Activity</h2>
          <p className={styles.pageSubtitle}>
            A comprehensive history of your monthly dues, billings, and payment submissions.
          </p>
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
                <div key={event.id} className={styles.timelineItem}>
                  <div className={styles.timelineMarker}>
                    <span className={`${styles.markerDot} ${event.type === 'BILL' ? styles.billDot : styles.payDot}`} />
                    <span className={styles.markerLine} />
                  </div>

                  <div className={styles.timelineCard}>
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
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
