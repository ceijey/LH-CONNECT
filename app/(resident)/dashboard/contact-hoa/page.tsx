'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import styles from './contact-hoa.module.css';

interface Message {
  id: number;
  title: string;
  date: string;
  status: 'Replied' | 'New';
  preview: string;
}

interface Conversation {
  id: number;
  sender: 'You' | 'HOA Admin';
  content: string;
  timestamp: string;
}

export default function ContactHOAPage() {
  const router = useRouter();
  const [selectedMessage, setSelectedMessage] = useState<number>(1);
  const [replyText, setReplyText] = useState('');

  const messages: Message[] = [
    {
      id: 1,
      title: 'Thank you',
      date: '2026-02-22 04:15 PM',
      status: 'Replied',
      preview: 'Thank you for quickly verifying my payment. Appreciated!',
    },
    {
      id: 2,
      title: 'Question about maintenance schedule',
      date: '2026-02-20 10:00 AM',
      status: 'Replied',
      preview: 'When is the next scheduled maintenance in our area?',
    },
  ];

  const conversations: { [key: number]: Conversation[] } = {
    1: [
      {
        id: 1,
        sender: 'You',
        content: 'Thank you for quickly verifying my payment. Appreciated!',
        timestamp: '2026-02-22 04:15 PM',
      },
      {
        id: 2,
        sender: 'HOA Admin',
        content:
          "You're welcome! We're always happy to help. If you have any other questions, feel free to reach out.",
        timestamp: '2026-02-22 04:30 PM',
      },
    ],
    2: [
      {
        id: 1,
        sender: 'You',
        content: 'When is the next scheduled maintenance in our area?',
        timestamp: '2026-02-20 10:00 AM',
      },
      {
        id: 2,
        sender: 'HOA Admin',
        content:
          'The next maintenance for Block A is scheduled for March 5, 2026. Work will be done from 8 AM to 5 PM. Please ensure your gates are open for contractor access.',
        timestamp: '2026-02-20 02:30 PM',
      },
    ],
  };

  const currentConversation = conversations[selectedMessage] || [];
  const currentMessage = messages.find((m) => m.id === selectedMessage);

  const handleSendReply = () => {
    if (replyText.trim()) {
      alert('Your reply has been sent!');
      setReplyText('');
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLefty}>
            <Link href="/dashboard" className={styles.backBtn}>
              ← Back
            </Link>
            <div className={styles.headerBrand}>
              <span className={styles.headerIcon}>🏠</span>
              <div>
                <h1 className={styles.headerTitle}>LH-Connect</h1>
                <p className={styles.headerSubtitle}>Direct Admin Messenger</p>
              </div>
            </div>
          </div>
          <button
            className={styles.logoutBtn}
            onClick={() => {
              localStorage.removeItem('isAuthenticated');
              localStorage.removeItem('userEmail');
              router.push('/');
            }}
          >
            ⬅ Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        <div className={styles.contentWrapper}>
          {/* Left Column - Messages List */}
          <aside className={styles.sidebar}>
            <div className={styles.messagesHeader}>
              <h2 className={styles.messagesTitle}>Your Messages</h2>
              <button className={styles.newBtn}>✏ New</button>
            </div>

            <div className={styles.messagesList}>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`${styles.messageItem} ${
                    selectedMessage === message.id ? styles.active : ''
                  }`}
                  onClick={() => setSelectedMessage(message.id)}
                >
                  <div className={styles.messageContent}>
                    <h3 className={styles.messageTitle}>{message.title}</h3>
                    <p className={styles.messageDate}>{message.date}</p>
                  </div>
                  <span className={`${styles.badge} ${styles[message.status.toLowerCase()]}`}>
                    {message.status}
                  </span>
                </div>
              ))}
            </div>
          </aside>

          {/* Right Column - Conversation */}
          <section className={styles.conversationSection}>
            {/* Conversation Header */}
            <div className={styles.conversationHeader}>
              <h2 className={styles.conversationTitle}>{currentMessage?.title}</h2>
              <p className={styles.conversationDate}>{currentMessage?.date}</p>
            </div>

            {/* Messages Thread */}
            <div className={styles.messagesThread}>
              {currentConversation.map((msg) => (
                <div
                  key={msg.id}
                  className={`${styles.messageThread} ${
                    msg.sender === 'You' ? styles.userMessage : styles.adminMessage
                  }`}
                >
                  <div className={styles.senderInfo}>
                    <strong className={styles.senderName}>{msg.sender}</strong>
                    <span className={styles.timestamp}>{msg.timestamp}</span>
                  </div>
                  <div className={styles.messageBody}>{msg.content}</div>
                </div>
              ))}
            </div>

            {/* Reply Section */}
            <div className={styles.replySection}>
              <h3 className={styles.replyTitle}>Reply to HOA</h3>
              <textarea
                className={styles.replyInput}
                placeholder="Type your reply here..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={4}
              />
              <button className={styles.sendBtn} onClick={handleSendReply}>
                ✉ Send Reply
              </button>
            </div>
          </section>
        </div>

        {/* Information Box */}
        <div className={styles.infoBox}>
          <div className={styles.infoIcon}>💬</div>
          <div className={styles.infoContent}>
            <h3 className={styles.infoTitle}>Direct Communication with HOA</h3>
            <p className={styles.infoText}>
              Use this messenger to ask questions about your monthly dues, payment status, community
              announcements, or any concerns. Our HOA officers typically respond within 24 hours during
              business days.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
