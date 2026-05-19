'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { apiCall } from '@/lib/api-client';
import { logoutAndRedirect } from '@/lib/auth-session';
import { useAuthPageshow } from '@/lib/useAuthPageshow';
import LoadingScreen from '@/app/components/LoadingScreen';
import styles from './announcements.module.css';

interface Announcement {
  id: string;
  title: string;
  content: string;
  severity: 'info' | 'warning' | 'success' | 'event';
  createdBy: string;
  createdAt: string;
}

export default function ResidentAnnouncementsPage() {
  const router = useRouter();
  useAuthPageshow('resident');

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [joinedEventIds, setJoinedEventIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const data = await apiCall('/api/announcements');
      setAnnouncements(data.announcements || []);
      setJoinedEventIds(data.joinedEventIds || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const toggleAttendance = async (announcementId: string, isJoining: boolean) => {
    try {
      setTogglingId(announcementId);
      await apiCall(`/api/announcements/${announcementId}/join`, {
        method: isJoining ? 'POST' : 'DELETE',
      });
      setJoinedEventIds(prev => 
        isJoining ? [...prev, announcementId] : prev.filter(id => id !== announcementId)
      );
    } catch (err: any) {
      alert(err.message || 'Failed to update meeting attendance.');
    } finally {
      setTogglingId(null);
    }
  };

  const getSeverityLabel = (sev: string) => {
    switch (sev) {
      case 'info': return 'ℹ️ Info';
      case 'warning': return '⚠️ Warning';
      case 'success': return '✅ Success';
      case 'event': return '📅 Event';
      default: return sev;
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading announcements..." />;
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
                <p className={styles.headerSubtitle}>Community Announcements</p>
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
          <h2 className={styles.pageTitle}>Community Announcements</h2>
          <p className={styles.pageSubtitle}>
            Stay informed with the latest updates, event schedules, and emergency notifications from the HOA administration.
          </p>
        </section>

        {error && (
          <div style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c', padding: '1rem', borderRadius: '12px', marginBottom: '2rem' }}>
            ⚠️ {error}
          </div>
        )}

        <section className={styles.announcementsFeed}>
          {announcements.length === 0 ? (
            <div className={styles.emptyFeed}>
              <div className={styles.emptyIcon}>📯</div>
              <h3 className={styles.emptyTitle}>All quiet here</h3>
              <p className={styles.emptyText}>There are no community announcements at the moment. Check back later for updates!</p>
            </div>
          ) : (
            <div className={styles.feedWrapper}>
              {/* Featured Announcement (Latest) */}
              <div className={styles.featuredCard}>
                <div className={styles.featuredTag}>✨ LATEST ANNOUNCEMENT</div>
                <div className={styles.featuredHeader}>
                  <h3 className={styles.featuredTitle}>{announcements[0].title}</h3>
                  <span className={`${styles.severityBadge} ${styles[`severity_${announcements[0].severity}`]}`}>
                    {getSeverityLabel(announcements[0].severity)}
                  </span>
                </div>
                <p className={styles.featuredContent}>{announcements[0].content}</p>
                {announcements[0].severity === 'event' && (
                  <div className={styles.attendanceWrapper}>
                    <button
                      className={`${styles.attendanceBtn} ${joinedEventIds.includes(announcements[0].id) ? styles.attending : ''}`}
                      disabled={togglingId === announcements[0].id}
                      onClick={() => toggleAttendance(announcements[0].id, !joinedEventIds.includes(announcements[0].id))}
                    >
                      {togglingId === announcements[0].id ? (
                        'Updating RSVP...'
                      ) : joinedEventIds.includes(announcements[0].id) ? (
                        'Attending ✓ (Click to cancel)'
                      ) : (
                        'Join Meeting / Attend Event ➔'
                      )}
                    </button>
                  </div>
                )}
                <div className={styles.featuredFooter}>
                  <span className={styles.author}>👤 HOA Admin ({announcements[0].createdBy})</span>
                  <span>
                    📅 {new Date(announcements[0].createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              {/* Remaining Announcements Grid */}
              {announcements.length > 1 && (
                <div className={styles.gridSection}>
                  <h3 className={styles.gridSectionTitle}>Previous Notices</h3>
                  <div className={styles.recentGrid}>
                    {announcements.slice(1).map((ann) => (
                      <div key={ann.id} className={styles.announcementCard}>
                        <div>
                          <div className={styles.announcementHeader}>
                            <h3 className={styles.announcementTitle}>{ann.title}</h3>
                            <span className={`${styles.severityBadge} ${styles[`severity_${ann.severity}`]}`}>
                              {getSeverityLabel(ann.severity)}
                            </span>
                          </div>
                          <p className={styles.announcementContent}>{ann.content}</p>
                        </div>
                        {ann.severity === 'event' && (
                          <div className={styles.attendanceWrapper} style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
                            <button
                              className={`${styles.attendanceBtn} ${joinedEventIds.includes(ann.id) ? styles.attending : ''}`}
                              disabled={togglingId === ann.id}
                              onClick={() => toggleAttendance(ann.id, !joinedEventIds.includes(ann.id))}
                            >
                              {togglingId === ann.id ? (
                                'Updating RSVP...'
                              ) : joinedEventIds.includes(ann.id) ? (
                                'Attending ✓'
                              ) : (
                                'Join Event ➔'
                              )}
                            </button>
                          </div>
                        )}
                        <div className={styles.announcementFooter}>
                          <span className={styles.author}>👤 HOA Admin ({ann.createdBy})</span>
                          <span>
                            📅 {new Date(ann.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
