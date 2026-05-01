'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiCall } from '@/lib/api-client';
import { groupMessagesIntoThreads } from '@/lib/message-threads';
import Link from 'next/link';
import UnreadMessagesBadge from '@/app/components/UnreadMessagesBadge';
import Toast from '@/app/components/Toast';
import { logoutAndRedirect } from '@/lib/auth-session';
import { useAuthPageshow } from '@/lib/useAuthPageshow';
import styles from '../residents/admin-page.module.css';
import messengerStyles from './messenger.module.css';

interface Message {
  id: string;
  senderId?: string;
  senderName?: string;
  from: string;
  block: string;
  lot: string;
  subject: string;
  date: string;
  time: string;
  message: string;
  status: 'Unread' | 'Read';
  priority: 'High' | 'Normal' | 'Low';
  replies?: ConversationEntry[];
  threadId?: string;
}

interface ConversationEntry {
  id: string;
  senderId?: string;
  senderName?: string;
  senderRole?: string;
  message: string;
  date: string;
  time: string;
}

export default function AdminMessages() {
  useAuthPageshow('admin');
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const [activeNav, setActiveNav] = useState('messages');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [isToastVisible, setIsToastVisible] = useState(false);

  useEffect(() => {
    if (messages.length > 0 && !selectedMessage) {
      setSelectedMessage(messages[0]);
    }
  }, [messages]);

  const markMessageAsRead = async (messageId: string) => {
    const target = messages.find((message) => message.id === messageId);

    if (!target || target.status === 'Read') {
      return;
    }

    try {
      await apiCall(`/api/messages/${messageId}`, { method: 'PATCH' });

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId ? { ...message, status: 'Read' } : message,
        ),
      );

      setSelectedMessage((current) =>
        current && current.id === messageId ? { ...current, status: 'Read' } : current,
      );

      window.dispatchEvent(new Event('lh-messages-updated'));
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    }
  };

  const handleSelectMessage = (message: Message) => {
    setSelectedMessage(message);
    void markMessageAsRead(message.id);
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setIsToastVisible(true);
  };

  const initialLoadRef = useRef(true);
  const messagesRef = useRef<Message[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const handleSendReply = async () => {
    const trimmedReply = replyText.trim();

    if (!selectedMessage?.senderId) {
      showToast('Select a resident message to reply to.', 'error');
      return;
    }

    if (!trimmedReply) {
      showToast('Type a reply before sending.', 'error');
      return;
    }

    try {
      const response = await apiCall('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          subject: `Re: ${selectedMessage.subject}`,
          message: trimmedReply,
          recipientId: selectedMessage.senderId,
          recipientRole: 'resident',
          to: selectedMessage.from,
          priority: selectedMessage.priority ?? 'Normal',
          threadId: selectedMessage.id,
        }),
      });

      const updatedMessage = response?.message;

      if (updatedMessage) {
        setMessages((current) =>
          current.map((message) =>
            message.id === updatedMessage.id ? updatedMessage : message,
          ),
        );
        setSelectedMessage(updatedMessage);
      }

      setReplyText('');
      showToast('Reply sent successfully.', 'success');
      window.dispatchEvent(new Event('lh-messages-updated'));
    } catch (error) {
      console.error('Failed to send reply:', error);
      showToast('Failed to send reply. Please try again.', 'error');
    }
  };

  // Fetch messages from API on mount
  const fetchMessages = useCallback(async () => {
    try {
      if (initialLoadRef.current) setIsLoading(true);
      const res = await apiCall('/api/messages');
      const payload = res?.messages ?? [];
      const threads = groupMessagesIntoThreads(payload as any[]);

      const oldKey = messagesRef.current.map((m) => `${m.id}@${(m as any).updatedAt ?? m.date ?? ''}`).join('|');
      const newKey = threads.map((m: any) => `${m.id}@${m.updatedAt ?? m.date ?? ''}`).join('|');
      if (oldKey !== newKey) {
        setMessages(threads as Message[]);
      }

      initialLoadRef.current = false;
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      if (initialLoadRef.current === false) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  const unreadCount = messages.filter((m) => m.status === 'Unread').length;

  // keep selectedMessage pointing to the current thread object if it exists
  useEffect(() => {
    setSelectedMessage((current) => {
      if (!current) return messages[0] ?? null;
      const found = messages.find((m) => m.id === (current as Message).id);
      if (!found) return messages[0] ?? null;
      // keep same reference when id unchanged to avoid re-renders
      if ((current as Message).id === found.id) return current;
      return found;
    });
  }, [messages]);

  // Real-time updates: listen for internal events and attempt WebSocket, fallback to polling
  const pollRef = useRef<number | null>(null);
  useEffect(() => {
    const handleUpdate = () => {
      void fetchMessages();
    };

    window.addEventListener('lh-messages-updated', handleUpdate);

    let ws: WebSocket | null = null;
    const startPolling = () => {
      if (pollRef.current == null) {
        pollRef.current = window.setInterval(() => {
          void fetchMessages();
        }, 5000) as unknown as number;
      }
    };

    // start polling immediately as a reliable fallback
    startPolling();

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/messages/ws`;
      ws = new WebSocket(wsUrl);

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data || '{}');
          if (data && (data.message || data.messages)) {
            void fetchMessages();
          }
        } catch (e) {
          void fetchMessages();
        }
      };

      ws.onopen = () => {
        // stop polling while WS is open to avoid duplicate fetches
        if (pollRef.current) {
          clearInterval(pollRef.current as number);
          pollRef.current = null;
        }
      };

      ws.onerror = () => {
        if (ws) {
          try { ws.close(); } catch {};
        }
        // ensure polling is running
        startPolling();
      };

      ws.onclose = () => {
        // resume polling when WS closes
        startPolling();
      };
    } catch (err) {
      // ensure polling if WS creation fails
      startPolling();
    }

    return () => {
      window.removeEventListener('lh-messages-updated', handleUpdate);
      if (ws) {
        try { ws.close(); } catch {}
      }
      if (pollRef.current) {
        clearInterval(pollRef.current as number);
        pollRef.current = null;
      }
    };
  }, [fetchMessages]);

  useEffect(() => {
    // minimal loader behavior until messages are fetched from API
    setIsLoading(false);
  }, [router]);

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await logoutAndRedirect(router, '/');
    }
  };

  if (isLoading) return <div className={styles.loading}>Loading...</div>;

  return (
    <div className={styles.container}>
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={isToastVisible}
        onClose={() => setIsToastVisible(false)}
      />
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🏠</span>
            <div>
              <div className={styles.logoText}>LH-Connect</div>
              <div className={styles.logoSubtext}>Admin Dashboard</div>
            </div>
          </div>
        </div>
        <nav className={styles.nav}>
          <Link href="/admin/dashboard" className={styles.navItem} onClick={(e) => { e.preventDefault(); setActiveNav('dashboard'); router.push('/admin/dashboard'); }}>
            <span>📊</span> Dashboard
          </Link>
          <Link href="/admin/residents" className={styles.navItem} onClick={(e) => { e.preventDefault(); setActiveNav('residents'); router.push('/admin/residents'); }}>
            <span>👥</span> Residents
          </Link>
          <Link href="/admin/payments" className={styles.navItem} onClick={(e) => { e.preventDefault(); setActiveNav('payments'); router.push('/admin/payments'); }}>
            <span>💳</span> Payments
          </Link>
          <Link href="/admin/qr-scanner" className={styles.navItem} onClick={(e) => { e.preventDefault(); setActiveNav('qr-scanner'); router.push('/admin/qr-scanner'); }}>
            <span>📱</span> QR Scanner
          </Link>
          <Link href="/admin/messages" className={`${styles.navItem} ${activeNav === 'messages' ? styles.active : ''}`} onClick={(e) => { e.preventDefault(); setActiveNav('messages'); router.push('/admin/messages'); }}>
            <span>💬</span> Messages
            <UnreadMessagesBadge />
          </Link>
          <Link href="/admin/reports" className={styles.navItem} onClick={(e) => { e.preventDefault(); setActiveNav('reports'); router.push('/admin/reports'); }}>
            <span>📑</span> Reports
          </Link>
        </nav>
        <button className={styles.logoutBtn} onClick={handleLogout}>🚪 Logout</button>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.pageTitle}>Direct Admin Messenger</h1>
          <div className={styles.headerRight}>
            <span className={styles.userLabel}>Admin User</span>
            <div className={styles.userAvatar}>👤</div>
          </div>
        </header>

        <div className={messengerStyles.messengerContainer}>
          <div className={messengerStyles.messagesList}>
            <div className={messengerStyles.messagesHeader}>
              <h2>Messages</h2>
              <span className={messengerStyles.badge}>{unreadCount} New</span>
            </div>
            <div className={messengerStyles.messageThreads}>
              {isLoading ? (
                <div className={messengerStyles.emptyState}>Loading messages…</div>
              ) : messages.length === 0 ? (
                <div className={messengerStyles.emptyState}>
                  No messages yet. Residents can send messages via the Contact HOA form.
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`${messengerStyles.messageThread} ${selectedMessage?.id === msg.id ? messengerStyles.active : ''}`}
                    onClick={() => handleSelectMessage(msg)}
                  >
                    <div className={messengerStyles.threadName}>{msg.from}</div>
                    <div className={messengerStyles.threadInfo}>Blk {msg.block} - Lot {msg.lot}</div>
                    <div className={messengerStyles.threadSubject}>{msg.subject}</div>
                    <div className={messengerStyles.threadTime}>{msg.date} {msg.time}</div>
                    {msg.status === 'Unread' && <div className={messengerStyles.unreadDot}></div>}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={messengerStyles.messageDetail}>
            {selectedMessage && (
              <>
                <div className={messengerStyles.detailHeader}>
                  <h3>{selectedMessage.subject}</h3>
                  <span className={messengerStyles.statusBadge}>{selectedMessage.status}</span>
                </div>
                <div className={messengerStyles.detailMeta}>
                  <span>From: {selectedMessage.from} • Blk {selectedMessage.block} - Lot {selectedMessage.lot}</span>
                  <span>{selectedMessage.date} {selectedMessage.time}</span>
                </div>
                  <div className={messengerStyles.messageContent}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {(selectedMessage.replies && selectedMessage.replies.length > 0
                        ? selectedMessage.replies
                        : [{
                            id: selectedMessage.id,
                            senderName: selectedMessage.from,
                            senderRole: 'resident',
                            message: selectedMessage.message,
                            date: selectedMessage.date,
                            time: selectedMessage.time,
                          }]
                      ).map((reply) => {
                        const isAdminReply = String(reply.senderRole ?? '').toLowerCase() === 'admin';

                        return (
                          <div
                            key={reply.id}
                            style={{
                              alignSelf: isAdminReply ? 'flex-end' : 'flex-start',
                              maxWidth: '85%',
                              padding: '0.85rem 1rem',
                              borderRadius: '16px',
                              background: isAdminReply ? '#0f172a' : '#f8fafc',
                              color: isAdminReply ? '#ffffff' : '#0f172a',
                              border: isAdminReply ? 'none' : '1px solid #e2e8f0',
                            }}
                          >
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', opacity: 0.8 }}>
                              {isAdminReply ? 'HOA Admin' : (reply.senderName ?? selectedMessage.from)}
                            </div>
                            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{reply.message}</div>
                            <div style={{ fontSize: '0.75rem', marginTop: '0.45rem', opacity: 0.7 }}>
                              {reply.date} {reply.time}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                <div className={messengerStyles.replySection}>
                  <h4>Reply</h4>
                  <textarea
                    placeholder="Type your reply here..."
                    className={messengerStyles.replyText}
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                  ></textarea>
                  <div className={messengerStyles.replyButtons}>
                    <button className={messengerStyles.sendBtn} onClick={() => void handleSendReply()}>✈ Send Reply</button>
                    <button
                      className={messengerStyles.markBtn}
                      onClick={() => void markMessageAsRead(selectedMessage.id)}
                    >
                      Mark as Read
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
