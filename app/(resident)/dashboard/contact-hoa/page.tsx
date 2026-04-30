'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiCall } from '@/lib/api-client';
import Image from 'next/image';
import { logoutAndRedirect } from '@/lib/auth-session';
import { useAuthPageshow } from '@/lib/useAuthPageshow';
import Toast from '@/app/components/Toast';
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
  useAuthPageshow('resident');
  const [selectedMessage, setSelectedMessage] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<{ [key: number]: Conversation[] }>({});
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [isToastVisible, setIsToastVisible] = useState(false);

  const currentConversation: Conversation[] = (selectedMessage !== null && conversations[selectedMessage]) ? conversations[selectedMessage] : [];
  const currentMessage = selectedMessage === null
    ? null
    : messages.find((m) => m.id === selectedMessage) ?? null;

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setIsLoading(true);
        // Try to fetch resident messages (API may not exist yet)
        const res = await apiCall('/api/messages');
        if (res && res.messages) {
          setMessages(res.messages as Message[]);
        }
        if (res && res.conversations) {
          setConversations(res.conversations as { [key: number]: Conversation[] });
        }
        // if no messages returned, leave empty arrays
        if (res && Array.isArray(res.messages) && res.messages.length > 0) {
          setSelectedMessage(res.messages[0].id);
        }
      } catch (err) {
        // no-op; fall back to empty state
        console.error('Failed to fetch messages:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [router]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setIsToastVisible(true);
  };

  const handleSendReply = async () => {
    const trimmedReply = replyText.trim();

    if (!trimmedReply) {
      showToast('Type a message before sending.', 'error');
      return;
    }

    try {
      const subject = currentMessage?.title ?? 'New HOA Message';
      const response = await apiCall('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          subject,
          message: trimmedReply,
          recipientId: 'admin',
          recipientRole: 'admin',
          to: 'HOA Admin',
          priority: 'Normal',
        }),
      });

      const createdMessage = response?.message;

      if (createdMessage) {
        setMessages((current) => [
          {
            id: createdMessage.id ?? Date.now(),
            title: createdMessage.subject ?? subject,
            date: createdMessage.date ?? new Date().toLocaleDateString(),
            status: 'New',
            preview: createdMessage.preview ?? trimmedReply.slice(0, 60),
          },
          ...current,
        ]);

        setConversations((current) => ({
          ...current,
          [createdMessage.id ?? Date.now()]: [
            {
              id: Date.now(),
              sender: 'You',
              content: trimmedReply,
              timestamp: createdMessage.time ?? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ],
        }));
      }

      setReplyText('');
      showToast('Your message has been sent.', 'success');
      window.dispatchEvent(new Event('lh-messages-updated'));
    } catch (error) {
      console.error('Failed to send reply:', error);
      showToast('Failed to send message. Please try again.', 'error');
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className={styles.container}>
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={isToastVisible}
        onClose={() => setIsToastVisible(false)}
      />
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLefty}>
            <Link href="/dashboard" className={styles.backBtn}>
              ← Back
            </Link>
            <div className={styles.headerBrand}>
              <Image
                src="/lhhoa-logo.png"
                alt="LHHOA Logo"
                width={50}
                height={50}
                className={styles.headerIcon}
                priority
              />
              <div>
                <h1 className={styles.headerTitle}>LH-Connect</h1>
                <p className={styles.headerSubtitle}>Direct Admin Messenger</p>
              </div>
            </div>
          </div>
          <button
            className={styles.logoutBtn}
            onClick={async () => {
              await logoutAndRedirect(router, '/');
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
              {isLoading ? (
                <div className={styles.emptyState}>Loading messages…</div>
              ) : messages.length === 0 ? (
                <div className={styles.emptyState}>No messages yet. Use the form to send a message to the HOA.</div>
              ) : (
                messages.map((message) => (
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
                ))
              )}
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
              {isLoading ? (
                <div className={styles.emptyState}>Loading conversation…</div>
              ) : currentConversation.length === 0 ? (
                <div className={styles.emptyState}>No conversation selected.</div>
              ) : (
                currentConversation.map((msg) => (
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
                ))
              )}
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
