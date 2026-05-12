'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useCallback, useRef } from 'react';
import { apiCall } from '@/lib/api-client';
import Image from 'next/image';
import { logoutAndRedirect } from '@/lib/auth-session';
import { useAuthPageshow } from '@/lib/useAuthPageshow';
import Toast from '@/app/components/Toast';
import LoadingScreen from '@/app/components/LoadingScreen';
import styles from './contact-hoa.module.css';

interface Message {
  id: string;
  title: string;
  date: string;
  status: 'Replied' | 'New';
  preview: string;
  senderId?: string;
  senderName?: string;
  threadId?: string;
  replies?: Conversation[];
}

interface Conversation {
  id: string;
  sender: 'You' | 'HOA Admin';
  content: string;
  timestamp: string;
}

export default function ContactHOAPage() {
  const router = useRouter();
  useAuthPageshow('resident');
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<{ [key: string]: Conversation[] }>({});
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [isToastVisible, setIsToastVisible] = useState(false);

  const currentConversation: Conversation[] = (selectedMessage !== null && conversations[selectedMessage]) ? conversations[selectedMessage] : [];
  const currentMessage = selectedMessage === null
    ? null
    : messages.find((m) => m.id === selectedMessage) ?? null;

  const getThreadKey = (message: Message | null | undefined) => String(message?.threadId ?? message?.id ?? '');

  const initialLoadRef = useRef(true);
  const messagesRef = useRef<Message[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const formatTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString([], { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return isoString;
    }
  };

  const mapRepliesToConversation = (replies: any[] = []): Conversation[] => {
    const toMillis = (value: unknown) => {
      if (!value) return 0;
      if (typeof value === 'number') return value;
      const parsed = new Date(String(value)).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    };

    return replies
      .map((reply, index) => {
        const createdAt = reply.createdAt || `${reply.date ?? ''} ${reply.time ?? ''}`.trim() || new Date().toISOString();
        const sortStamp = toMillis(createdAt);
        const displayTime = formatTimestamp(createdAt);

        return {
          conversation: {
            id: String(reply.id ?? `${index}-${Date.now()}`),
            sender: String(reply.senderRole ?? '').toLowerCase() === 'admin' ? 'HOA Admin' : 'You',
            content: String(reply.message ?? ''),
            timestamp: displayTime,
          } as Conversation,
          sortStamp,
          index,
        };
      })
      .sort((a, b) => (a.sortStamp === b.sortStamp ? a.index - b.index : a.sortStamp - b.sortStamp))
      .map((entry) => entry.conversation);
  };

  const fetchMessages = useCallback(async () => {
    try {
      if (initialLoadRef.current) setIsLoading(true);
      const res = await apiCall('/api/messages');
      if (res && res.messages) {
        const threadMessages = (res.messages as any[]).map((message) => ({
          id: String(message.id),
          title: String(message.subject ?? message.title ?? 'New HOA Message'),
          date: String(message.date ?? new Date().toLocaleDateString()),
          status: String(message.status ?? '').toLowerCase() === 'unread' ? 'New' : 'Replied',
          preview: String(message.preview ?? message.message ?? '').slice(0, 120),
          senderId: message.senderId,
          senderName: message.senderName,
          threadId: message.threadId ?? message.id,
          replies: Array.isArray(message.replies) ? mapRepliesToConversation(message.replies) : undefined,
        })) as Message[];

        const oldKey = messagesRef.current.map((m) => `${m.id}@${m.threadId ?? m.id}`).join('|');
        const newKey = threadMessages.map((m) => `${m.id}@${m.threadId ?? m.id}`).join('|');
        if (oldKey !== newKey) {
          setMessages(threadMessages);

          const threadMap = threadMessages.reduce<{ [key: string]: Conversation[] }>((acc, message) => {
            const threadKey = getThreadKey(message);

            acc[threadKey] = message.replies && message.replies.length > 0
              ? message.replies
              : [{
                  id: `${threadKey}-starter`,
                  sender: 'You',
                  content: message.preview,
                  timestamp: message.date,
                }];
            return acc;
          }, {});

          setConversations(threadMap);
        }
        if (initialLoadRef.current && threadMessages.length > 0) {
          setSelectedMessage(getThreadKey(threadMessages[0]));
        }

        initialLoadRef.current = false;
      }
    } catch (err: any) {
      // Use console.warn to avoid triggering the Next.js dev error overlay on network hiccups
      console.warn('Polling notice - failed to fetch messages:', err?.message || err);
    } finally {
      if (initialLoadRef.current === false) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

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
        if (pollRef.current) {
          clearInterval(pollRef.current as number);
          pollRef.current = null;
        }
      };

      ws.onerror = () => {
        if (ws) {
          try { ws.close(); } catch {}
        }
        startPolling();
      };

      ws.onclose = () => {
        startPolling();
      };
    } catch (err) {
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
          threadId: currentMessage?.id,
        }),
      });

      const createdMessage = response?.message;

      if (createdMessage) {
        const nextThreadKey = String(createdMessage.threadId ?? createdMessage.id ?? currentMessage?.id ?? Date.now());
        const nextMessage: Message = {
          id: String(createdMessage.id ?? currentMessage?.id ?? Date.now()),
          title: String(createdMessage.subject ?? subject),
          date: String(createdMessage.date ?? new Date().toLocaleDateString()),
          status: 'New',
          preview: String(createdMessage.preview ?? trimmedReply.slice(0, 60)),
          senderId: createdMessage.senderId,
          senderName: createdMessage.senderName,
          threadId: createdMessage.threadId ?? createdMessage.id,
          replies: Array.isArray(createdMessage.replies) ? mapRepliesToConversation(createdMessage.replies) : undefined,
        };

        setMessages((current) => {
          const existingIndex = current.findIndex((message) => message.id === nextMessage.id);

          if (existingIndex >= 0) {
            return current.map((message) => (message.id === nextMessage.id ? nextMessage : message));
          }

          return [nextMessage, ...current];
        });

        setConversations((current) => ({
          ...current,
          [nextThreadKey]: nextMessage.replies && nextMessage.replies.length > 0
            ? nextMessage.replies
            : [
                ...(current[getThreadKey(currentMessage)] ?? current[nextThreadKey] ?? []),
                {
                  id: `${Date.now()}`,
                  sender: 'You',
                  content: trimmedReply,
                  timestamp: createdMessage.time ?? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
              ],
        }));

        setSelectedMessage(nextThreadKey);
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
    return <LoadingScreen message="Loading conversation history..." />;
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
              await logoutAndRedirect(router, '/login');
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
