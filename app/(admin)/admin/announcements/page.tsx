'use client';

import { useState, useEffect } from 'react';
import { apiCall } from '@/lib/api-client';
import styles from './announcements.module.css';

interface Announcement {
  id: string;
  title: string;
  content: string;
  severity: 'info' | 'warning' | 'success' | 'event';
  createdBy: string;
  createdAt: string;
}

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form Fields
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [severity, setSeverity] = useState<'info' | 'warning' | 'success' | 'event'>('info');

  // Attendance & Printable Report States
  const [selectedEvent, setSelectedEvent] = useState<Announcement | null>(null);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'attendance' | 'viewers'>('attendance');
  const [viewers, setViewers] = useState<any[]>([]);

  const handleViewReaders = async (ann: Announcement) => {
    setSelectedEvent(ann);
    setModalType('viewers');
    setShowModal(true);
    setLoadingAttendees(true);
    try {
      const data = await apiCall(`/api/announcements/${ann.id}/views`);
      setViewers(data.viewers || []);
    } catch (err: any) {
      console.error('Failed to load viewers:', err);
    } finally {
      setLoadingAttendees(false);
    }
  };

  const handleViewAttendance = async (event: Announcement) => {
    setSelectedEvent(event);
    setModalType('attendance');
    setShowModal(true);
    setLoadingAttendees(true);
    try {
      const data = await apiCall(`/api/announcements/${event.id}/join`);
      setAttendees(data.attendees || []);
    } catch (err: any) {
      console.error('Failed to load attendees:', err);
    } finally {
      setLoadingAttendees(false);
    }
  };

  const handlePrint = () => {
    if (!selectedEvent) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print.');
      return;
    }

    const eventTitle = selectedEvent.title;
    const dateStr = new Date().toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const rowsHtml = attendees.map(att => `
      <tr>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b;">${att.userName}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; color: #475569;">${att.email || 'N/A'}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; color: #475569;">${att.phase || 'Lincoln Heights'}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; color: #475569;">Block ${att.block || 'N/A'}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; color: #475569;">Lot ${att.lot || 'N/A'}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; color: #475569;">${new Date(att.joinedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Meeting Attendance - ${eventTitle}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
            body { font-family: 'Inter', system-ui, sans-serif; padding: 40px; color: #1e293b; background: white; line-height: 1.5; }
            .header { text-align: center; border-bottom: 3px double #1B2A4A; padding-bottom: 24px; margin-bottom: 30px; }
            .logo { font-size: 28px; font-weight: 800; color: #1B2A4A; text-transform: uppercase; letter-spacing: -0.03em; margin-bottom: 6px; }
            .subtitle { font-size: 13px; color: #64748b; margin: 0; text-transform: uppercase; letter-spacing: 0.05em; }
            .report-title { font-size: 22px; font-weight: 800; color: #0f172a; margin: 20px 0 12px 0; text-transform: uppercase; letter-spacing: -0.01em; }
            .meeting-info { font-size: 14px; background: #f8fafc; border: 1.5px solid #e2e8f0; padding: 18px; border-radius: 12px; margin-bottom: 30px; }
            .info-grid { display: grid; grid-template-columns: auto 1fr; gap: 8px 16px; }
            .info-label { font-weight: 700; color: #475569; }
            .info-value { color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-top: 25px; }
            th { text-align: left; padding: 14px 10px; background: #1B2A4A; color: white; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border: none; }
            td { font-size: 13px; }
            tr:nth-child(even) td { background: #f8fafc; }
            .footer { margin-top: 60px; font-size: 11px; text-align: center; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; text-transform: uppercase; letter-spacing: 0.05em; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">Lincoln Heights HOA</div>
            <div class="subtitle">Community Management & Resident Connection Portal</div>
          </div>
          
          <div class="report-title">Meeting Attendance Report</div>
          
          <div class="meeting-info">
            <div class="info-grid">
              <div class="info-label">Meeting/Event:</div>
              <div class="info-value" style="font-weight: 700;">${eventTitle}</div>
              
              <div class="info-label">Date Printed:</div>
              <div class="info-value">${dateStr}</div>
              
              <div class="info-label">Status:</div>
              <div class="info-value" style="color: #10b981; font-weight: 700;">Official RSVP Sheet</div>
              
              <div class="info-label">Total Attendance:</div>
              <div class="info-value" style="font-weight: 700; font-size: 16px;">${attendees.length} Residents Registered</div>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Resident Name</th>
                <th>Email</th>
                <th>Phase</th>
                <th>Block</th>
                <th>Lot</th>
                <th>Registration Date</th>
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

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const data = await apiCall('/api/announcements');
      setAnnouncements(data.announcements || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!title.trim() || !content.trim()) {
      setError('Please fill in both the title and the content.');
      return;
    }

    try {
      setSubmitting(true);
      await apiCall('/api/admin/announcements', {
        method: 'POST',
        body: JSON.stringify({
          title,
          content,
          severity,
        }),
      });

      setSuccess('Announcement published and notifications sent successfully!');
      setTitle('');
      setContent('');
      setSeverity('info');
      // Re-fetch list
      await fetchAnnouncements();
    } catch (err: any) {
      setError(err.message || 'Failed to post announcement');
    } finally {
      setSubmitting(false);
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

  return (
    <div className={styles.container}>
      {/* 1. Left Side: Announcement Post Form */}
      <div className={styles.card}>
        <h2 className={styles.title}>📢 Post Announcement</h2>
        <p className={styles.subtitle}>Publish updates or emergency warnings. All residents will receive immediate notifications.</p>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Title</label>
            <input
              type="text"
              className={styles.input}
              placeholder="e.g. Monthly HOA Meeting / Water Interruption"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Severity / Type</label>
            <select
              className={styles.select}
              value={severity}
              onChange={(e) => setSeverity(e.target.value as any)}
              disabled={submitting}
            >
              <option value="info">Info (General news & updates)</option>
              <option value="warning">Warning (Emergency / Interruption)</option>
              <option value="success">Success (Milestone / Resolution)</option>
              <option value="event">Event (Gathering / Holiday celebration)</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Content</label>
            <textarea
              className={styles.textarea}
              placeholder="Describe the announcement in detail..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={submitting}
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={submitting}>
            {submitting ? 'Publishing...' : '📢 Broadcast Announcement'}
          </button>
        </form>
      </div>

      {/* 2. Right Side: Recent Announcements Feed */}
      <div>
        <h2 className={styles.title} style={{ marginBottom: '1.5rem' }}>📋 Announcements Feed</h2>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading feed...</div>
        ) : announcements.length === 0 ? (
          <div className={styles.emptyFeed}>
            <div className={styles.emptyIcon}>📭</div>
            <h3 className={styles.emptyTitle}>No announcements yet</h3>
            <p className={styles.emptyText}>Announcements you post will appear here as a chronological timeline feed.</p>
          </div>
        ) : (
          <div className={styles.announcementsFeed}>
            {announcements.map((ann) => (
              <div key={ann.id} className={styles.announcementCard}>
                <div className={styles.announcementHeader}>
                  <h3 className={styles.announcementTitle}>{ann.title}</h3>
                  <span className={`${styles.severityBadge} ${styles[`severity_${ann.severity}`]}`}>
                    {getSeverityLabel(ann.severity)}
                  </span>
                </div>
                <p className={styles.announcementContent}>{ann.content}</p>
                
                {ann.severity === 'event' && (
                  <div style={{ marginBottom: '1rem', marginTop: '0.75rem' }}>
                    <button 
                      className={styles.viewAttendanceBtn}
                      onClick={() => handleViewAttendance(ann)}
                    >
                      👥 View Attendance & RSVPs
                    </button>
                  </div>
                )}

                <div className={styles.announcementFooter} style={{ justifyContent: 'flex-start', gap: '8px', flexWrap: 'wrap', marginTop: ann.severity !== 'event' ? '1rem' : '0' }}>
                  <span className={styles.author}>👤 Posted by: {ann.createdBy}</span>
                  <span>-</span>
                  <span>
                    📅 {new Date(ann.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span>-</span>
                  <button 
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: '#475569', 
                      fontSize: 'inherit',
                      fontWeight: '600',
                      padding: '0', 
                      cursor: 'pointer',
                      textDecoration: 'none'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; e.currentTarget.style.color = '#1B2A4A'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; e.currentTarget.style.color = '#475569'; }}
                    onClick={() => handleViewReaders(ann)}
                  >
                    views
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Attendance Modal Overlay */}
      {showModal && selectedEvent && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>
                  {modalType === 'attendance' ? '📅 Event Attendance' : '👁️ Post Viewers'}
                </h3>
                <p className={styles.modalSubtitle}>{selectedEvent.title}</p>
              </div>
              <button className={styles.closeBtn} onClick={() => setShowModal(false)}>✕</button>
            </div>
            
            {modalType === 'attendance' && (
              <div className={styles.modalActions}>
                <button 
                  className={styles.printBtn} 
                  onClick={handlePrint}
                  disabled={attendees.length === 0}
                >
                  🖨️ Print Attendance Sheet
                </button>
              </div>
            )}

            <div className={styles.modalBody}>
              {loadingAttendees ? (
                <div style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                  {modalType === 'attendance' ? 'Loading attendance list...' : 'Loading viewers...'}
                </div>
              ) : modalType === 'attendance' ? (
                attendees.length === 0 ? (
                  <div className={styles.emptyAttendees}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>👥</div>
                    <h4>No Attendees Registered</h4>
                    <p>No residents have registered to attend this event yet.</p>
                  </div>
                ) : (
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Resident Name</th>
                          <th>Email</th>
                          <th>Phase</th>
                          <th>Block</th>
                          <th>Lot</th>
                          <th>RSVP Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendees.map((att) => (
                          <tr key={att.id}>
                            <td style={{ fontWeight: '700', color: '#0f172a' }}>{att.userName}</td>
                            <td>{att.email}</td>
                            <td>{att.phase || 'N/A'}</td>
                            <td>{att.block ? `Block ${att.block}` : 'N/A'}</td>
                            <td>{att.lot ? `Lot ${att.lot}` : 'N/A'}</td>
                            <td>
                              {new Date(att.joinedAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                viewers.length === 0 ? (
                  <div className={styles.emptyAttendees}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>👁️</div>
                    <h4>No Views Yet</h4>
                    <p>No residents have viewed this announcement yet.</p>
                  </div>
                ) : (
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Resident Name</th>
                          <th>Viewed At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewers.map((v) => (
                          <tr key={v.userId}>
                            <td style={{ fontWeight: '700', color: '#0f172a' }}>{v.userName}</td>
                            <td>
                              {new Date(v.viewedAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
