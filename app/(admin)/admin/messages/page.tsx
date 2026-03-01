'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../residents/admin-page.module.css';
import messengerStyles from './messenger.module.css';

interface Message {
  id: string;
  from: string;
  block: string;
  lot: string;
  subject: string;
  date: string;
  time: string;
  message: string;
  status: 'Unread' | 'Read';
  priority: 'High' | 'Normal' | 'Low';
}

export default function AdminMessages() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [activeNav, setActiveNav] = useState('messages');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  const messages: Message[] = [
    { id: 'MSG001', from: 'Maria Santos', block: '2', lot: '8', subject: 'Question about monthly dues', date: '2026-02-23', time: '09:45 AM', message: "Good morning! I'd like to clarify the breakdown of our monthly dues. Can you provide details?", status: 'Unread', priority: 'High' },
    { id: 'MSG002', from: 'Carlos Mendoza', block: '3', lot: '19', subject: 'Payment confirmation', date: '2026-02-23', time: '08:30 AM', message: 'I submitted a payment yesterday. Can you confirm if it was received?', status: 'Read', priority: 'Normal' },
    { id: 'MSG003', from: 'Juan Dela Cruz', block: '1', lot: '15', subject: 'Thank you', date: '2026-02-22', time: '04:15 PM', message: 'Thank you for resolving the issue. Much appreciated!', status: 'Read', priority: 'Normal' },
  ];

  useEffect(() => {
    if (messages.length > 0 && !selectedMessage) {
      setSelectedMessage(messages[0]);
    }
  }, []);

  const unreadCount = messages.filter(m => m.status === 'Unread').length;

  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    const userRole = localStorage.getItem('userRole');

    if (!isAuthenticated || userRole !== 'admin') {
      router.push('/login');
    } else {
      setIsLoading(false);
    }
  }, [router]);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userName');
      localStorage.removeItem('userRole');
      router.push('/');
    }
  };

  if (isLoading) return <div className={styles.loading}>Loading...</div>;

  return (
    <div className={styles.container}>
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
          <Link href="/admin/dashboard" className={styles.navItem} onClick={() => setActiveNav('dashboard')}>
            <span>📊</span> Dashboard
          </Link>
          <Link href="/admin/residents" className={styles.navItem} onClick={() => setActiveNav('residents')}>
            <span>👥</span> Residents
          </Link>
          <Link href="/admin/payments" className={styles.navItem} onClick={() => setActiveNav('payments')}>
            <span>💳</span> Payments
          </Link>
          <Link href="/admin/qr-scanner" className={styles.navItem} onClick={() => setActiveNav('qr-scanner')}>
            <span>📱</span> QR Scanner
          </Link>
          <Link href="/admin/messages" className={`${styles.navItem} ${activeNav === 'messages' ? styles.active : ''}`} onClick={() => setActiveNav('messages')}>
            <span>💬</span> Messages
          </Link>
          <Link href="/admin/reports" className={styles.navItem} onClick={() => setActiveNav('reports')}>
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
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`${messengerStyles.messageThread} ${selectedMessage?.id === msg.id ? messengerStyles.active : ''}`}
                  onClick={() => setSelectedMessage(msg)}
                >
                  <div className={messengerStyles.threadName}>{msg.from}</div>
                  <div className={messengerStyles.threadInfo}>Blk {msg.block} - Lot {msg.lot}</div>
                  <div className={messengerStyles.threadSubject}>{msg.subject}</div>
                  <div className={messengerStyles.threadTime}>{msg.date} {msg.time}</div>
                  {msg.status === 'Unread' && <div className={messengerStyles.unreadDot}></div>}
                </div>
              ))}
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
                  {selectedMessage.message}
                </div>
                <div className={messengerStyles.replySection}>
                  <h4>Reply</h4>
                  <textarea placeholder="Type your reply here..." className={messengerStyles.replyText}></textarea>
                  <div className={messengerStyles.replyButtons}>
                    <button className={messengerStyles.sendBtn}>✈ Send Reply</button>
                    <button className={messengerStyles.markBtn}>Mark as Read</button>
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
