'use client';

import { useState, useEffect, useRef } from 'react';
import { apiCall } from '@/lib/api-client';
import Toast from './Toast';
import styles from './AdminLayout.module.css';
import Link from 'next/link';

interface AdminNotification {
  id: string;
  type: 'resident_registration' | 'payment_submission' | 'new_message';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  residentId?: string;
  residentName?: string;
  submissionId?: string;
  threadId?: string;
  details?: {
    phase?: string;
    block?: string;
    lot?: string;
    phone?: string;
  };
}

export default function AdminNotifications() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState({ isVisible: false, message: '', type: 'info' as 'success' | 'error' | 'info' });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ isVisible: true, message, type });
  };

  const fetchNotifications = async (before?: string) => {
    try {
      setIsLoading(true);
      const qs = before ? `?limit=50&before=${encodeURIComponent(before)}` : '?limit=50';
      const payload = await apiCall(`/api/admin/notifications${qs}`);

      if (before) {
        // append older notifications
        setNotifications(prev => {
          const merged = [...prev, ...(payload.notifications ?? [])];
          // dedupe by id
          const map = new Map<string, AdminNotification>();
          for (const n of merged) map.set(n.id, n);
          return Array.from(map.values());
        });
      } else {
        setNotifications(payload.notifications ?? []);
      }

      setNextCursor(payload.nextCursor ?? null);
    } catch (error: any) {
      console.error('Failed to fetch admin notifications:', error);
      if (notifications.length > 0) {
        showToast(error.message || 'Failed to fetch notifications', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Fetch on mount but don't block rendering
    fetchNotifications().catch(err => console.error('Initial notification fetch failed:', err));

    // Refresh every 2 minutes to reduce Firestore reads
    const interval = setInterval(() => fetchNotifications().catch(() => {}), 120000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const markAsRead = async (id: string) => {
    try {
      await apiCall('/api/admin/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ notificationId: id }),
      });
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiCall('/api/admin/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ readAll: true }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleResidentAction = async (notificationId: string, residentId: string, name: string, status: 'Approved' | 'Pending' | 'Rejected') => {
    try {
      await apiCall(`/api/residents/${residentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ 
          approvalStatus: status,
          status: status === 'Approved' ? 'Active' : (status === 'Rejected' ? 'Inactive' : 'Pending')
        }),
      });
      
      // Mark as read and show toast
      await markAsRead(notificationId);
      showToast(`${name} has been ${status.toLowerCase()}.`, 'success');
      
    } catch (error: any) {
      console.error(`Failed to update resident ${residentId} to ${status}:`, error);
      showToast(`Failed to update: ${error.message}`, 'error');
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'resident_registration': return '👤';
      case 'payment_submission': return '💰';
      case 'new_message': return '💬';
      case 'resident_action': return '✅';
      default: return '🔔';
    }
  };

  const getLink = (notification: AdminNotification) => {
    switch (notification.type) {
      case 'resident_registration': return '/admin/residents';
      case 'payment_submission': return '/admin/payments';
      case 'new_message': return '/admin/messages';
      default: return '#';
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <>
      <Toast 
        isVisible={toast.isVisible} 
        message={toast.message} 
        type={toast.type} 
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} 
      />

      <div className={styles.notificationWrapper} ref={dropdownRef}>
        <button 
          className={styles.notificationBell} 
          onClick={() => setIsOpen(!isOpen)}
          title="Notifications"
        >
          🔔
          {unreadCount > 0 && (
            <span className={styles.badge}>{unreadCount}</span>
          )}
        </button>

        {isOpen && (
          <div className={styles.notificationDropdown}>
            <div className={styles.dropdownHeader}>
              <h3>Notifications</h3>
              {unreadCount > 0 && (
                <button 
                  className={styles.residentDetails} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1B2A4A', fontWeight: 600 }}
                  onClick={markAllAsRead}
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className={styles.notificationList}>
              {isLoading && notifications.length === 0 ? (
                <div className={styles.emptyState}>Loading...</div>
              ) : notifications.length === 0 ? (
                <div className={styles.emptyState}>No notifications</div>
              ) : (
                notifications.map((notification) => (
                  <div 
                    key={notification.id} 
                    className={`${styles.notificationItem} ${!notification.read ? styles.unread : ''}`}
                    style={{ position: 'relative' }}
                    onClick={() => !notification.read && markAsRead(notification.id)}
                  >
                    <div className={`${styles.accentBar} ${
                      notification.type === 'resident_registration' ? styles.accentResident :
                      notification.type === 'payment_submission' ? styles.accentPayment :
                      notification.type === 'new_message' ? styles.accentMessage :
                      styles.accentAction
                    }`} />

                    <div className={styles.notificationHeader}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span className={`${styles.typeBadge} ${
                          notification.type === 'resident_registration' ? styles.badgeResident :
                          notification.type === 'payment_submission' ? styles.badgePayment :
                          notification.type === 'new_message' ? styles.badgeMessage :
                          styles.badgeAction
                        }`}>
                          {notification.type === 'resident_registration' ? 'Resident' :
                           notification.type === 'payment_submission' ? 'Payment' :
                           notification.type === 'new_message' ? 'Message' :
                           'Action'}
                        </span>
                        <span className={styles.notificationTitle}>
                          {getIcon(notification.type)} {notification.title}
                        </span>
                      </div>
                      <span className={styles.notificationTime}>
                        {formatTime(notification.createdAt)}
                      </span>
                    </div>
                    
                    <div className={styles.notificationMessage}>
                      {notification.message}
                    </div>

                    {notification.type === 'resident_registration' && notification.details && (
                      <div className={styles.residentDetails} style={{ marginTop: '4px' }}>
                        Phase {notification.details.phase} • Blk {notification.details.block} Lot {notification.details.lot}
                        {notification.details.phone && <div style={{ marginTop: '2px' }}>{notification.details.phone}</div>}
                      </div>
                    )}

                    {notification.type === 'resident_registration' && notification.residentId && (
                      <div className={styles.notificationActions}>
                        <button 
                          className={`${styles.actionBtn} ${styles.approveBtn}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResidentAction(notification.id, notification.residentId!, notification.residentName!, 'Approved');
                          }}
                        >
                          Approve
                        </button>
                        <button 
                          className={`${styles.actionBtn} ${styles.pendingBtn}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResidentAction(notification.id, notification.residentId!, notification.residentName!, 'Pending');
                          }}
                        >
                          Pending
                        </button>
                        <button 
                          className={`${styles.actionBtn} ${styles.rejectBtn}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResidentAction(notification.id, notification.residentId!, notification.residentName!, 'Rejected');
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    )}

                    <Link 
                      href={getLink(notification)}
                      className={styles.residentDetails}
                      style={{ marginTop: '4px', display: 'block', textDecoration: 'underline' }}
                      onClick={() => setIsOpen(false)}
                    >
                      View Details
                    </Link>
                  </div>
                ))
              )}
              {nextCursor && (
                <div style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => fetchNotifications(nextCursor)}
                    style={{ cursor: 'pointer', background: 'transparent', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: 8 }}
                  >
                    Load more
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
