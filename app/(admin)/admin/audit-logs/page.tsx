'use client';

import { useEffect, useState } from 'react';
import { apiCall } from '@/lib/api-client';
import styles from './AuditLogs.module.css';

interface AuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  details: string;
  targetId: string | null;
  createdAt: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiCall('/api/admin/audit-logs');
      setLogs(data.logs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch audit logs');
    } finally {
      setIsLoading(false);
    }
  };

  const getActionClass = (action: string) => {
    const className = `action${action.replace(/\s+/g, '')}`;
    return styles[className] || styles.actionDefault;
  };

  const getInitials = (name: string) => {
    if (!name) return 'A';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Audit Log</h1>
        <p className={styles.subtitle}>Track all administrative actions and system changes</p>
      </div>

      <div className={styles.card}>
        {isLoading ? (
          <div className={styles.loading}>
            <div className={styles.loader}></div>
            Loading audit logs...
          </div>
        ) : error ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>⚠️</div>
            <h3>Error loading logs</h3>
            <p>{error}</p>
            <button 
              onClick={fetchLogs}
              style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Try Again
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📝</div>
            <h3>No audit logs found</h3>
            <p>Administrative actions will appear here once they occur.</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Details</th>
                  <th>Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const { date, time } = formatDate(log.createdAt);
                  return (
                    <tr key={log.id}>
                      <td>
                        <div className={styles.adminInfo}>
                          <div className={styles.avatar}>{getInitials(log.adminName)}</div>
                          <span className={styles.adminName}>{log.adminName || 'Unknown Admin'}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.actionBadge} ${getActionClass(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td>
                        <div className={styles.details}>{log.details}</div>
                      </td>
                      <td>
                        <div className={styles.timeInfo}>
                          <span className={styles.date}>{date}</span>
                          <span className={styles.time}>{time}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
