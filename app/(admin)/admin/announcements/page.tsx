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
                <div className={styles.announcementFooter}>
                  <span className={styles.author}>👤 Posted by: {ann.createdBy}</span>
                  <span>
                    📅 {new Date(ann.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
