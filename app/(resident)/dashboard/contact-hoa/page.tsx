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
  ticketId: string;
  title: string;
  date: string;
  status: 'Replied' | 'New';
  ticketStatus: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  category: string;
  priority: string;
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
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);
  const [newTicketData, setNewTicketData] = useState({
    subject: '',
    category: 'General Inquiry',
    priority: 'Normal',
    message: ''
  });

  const [statusFilter, setStatusFilter] = useState('All');

  const filteredMessages = messages.filter(m => 
    statusFilter === 'All' || m.ticketStatus === statusFilter
  );

  const currentConversation: Conversation[] = (selectedMessage !== null && conversations[selectedMessage]) ? conversations[selectedMessage] : [];
  const currentMessage = selectedMessage === null
    ? null
    : messages.find((m) => m.id === selectedMessage) ?? null;

  const initialLoadRef = useRef(true);

  const formatTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString([], { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return isoString;
    }
  };

  const mapRepliesToConversation = (replies: any[] = []): Conversation[] => {
    return replies
      .map((reply, index) => {
        const createdAt = reply.createdAt || `${reply.date ?? ''} ${reply.time ?? ''}`.trim() || new Date().toISOString();
        const sortStamp = new Date(createdAt).getTime() || index;
        return {
          item: {
            id: String(reply.id ?? `${index}-${Date.now()}`),
            sender: String(reply.senderRole ?? '').toLowerCase() === 'admin' ? 'HOA Admin' : 'You',
            content: String(reply.message ?? ''),
            timestamp: formatTimestamp(createdAt),
          } as Conversation,
          sortStamp,
          index,
        };
      })
      .sort((a, b) => (a.sortStamp === b.sortStamp ? a.index - b.index : a.sortStamp - b.sortStamp))
      .map((entry) => entry.item);
  };

  const fetchMessages = useCallback(async () => {
    try {
      if (initialLoadRef.current) setIsLoading(true);
      const res = await apiCall('/api/messages');
      if (res && res.messages) {
        const threadMessages = (res.messages as any[]).map((message) => ({
          id: String(message.id),
          ticketId: String(message.ticketId || ''),
          title: String(message.subject || 'Ticket'),
          date: String(message.date || ''),
          status: String(message.status ?? '').toLowerCase() === 'unread' ? 'New' : 'Replied',
          ticketStatus: message.ticketStatus || 'Open',
          category: message.category || 'General',
          priority: message.priority || 'Normal',
          preview: String(message.preview || '').slice(0, 120),
          senderId: message.senderId,
          senderName: message.senderName,
          threadId: message.threadId ?? message.id,
          replies: Array.isArray(message.replies) ? mapRepliesToConversation(message.replies) : undefined,
        })) as Message[];

        setMessages(threadMessages);
        
        const threadMap = threadMessages.reduce<{ [key: string]: Conversation[] }>((acc, message) => {
          const threadKey = String(message.id);
          acc[threadKey] = message.replies && message.replies.length > 0 ? message.replies : [];
          return acc;
        }, {});
        setConversations(threadMap);

        if (initialLoadRef.current && threadMessages.length > 0) {
          setSelectedMessage(threadMessages[0].id);
        }
        initialLoadRef.current = false;
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleCreateTicket = async () => {
    if (!newTicketData.message.trim()) {
      showToast('Please enter a message.', 'error');
      return;
    }

    try {
      setIsLoading(true);
      await apiCall('/api/messages', {
        method: 'POST',
        body: JSON.stringify(newTicketData)
      });
      showToast('Ticket created successfully!', 'success');
      setIsNewTicketModalOpen(false);
      setNewTicketData({ subject: '', category: 'General Inquiry', priority: 'Normal', message: '' });
      fetchMessages();
    } catch (err) {
      showToast('Failed to create ticket.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

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

    if (!currentMessage) {
      showToast('Select a ticket first.', 'error');
      return;
    }

    try {
      await apiCall('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          subject: currentMessage.title,
          message: trimmedReply,
          recipientId: 'admin',
          recipientRole: 'admin',
          threadId: currentMessage.id,
        }),
      });

      // Optimistically add the reply to the conversation
      const newConversationEntry: Conversation = {
        id: `${Date.now()}`,
        sender: 'You',
        content: trimmedReply,
        timestamp: new Date().toLocaleString(),
      };

      setConversations(current => ({
        ...current,
        [currentMessage.id]: [...(current[currentMessage.id] ?? []), newConversationEntry]
      }));

      setReplyText('');
      showToast('Message sent!', 'success');
      // Refresh in background to get server-confirmed data
      setTimeout(() => { void fetchMessages(); }, 1500);
    } catch (error) {
      console.error('Failed to send reply:', error);
      showToast('Failed to send message. Please try again.', 'error');
    }
  };

  if (isLoading && messages.length === 0) {
    return <LoadingScreen message="Loading help desk..." />;
  }

  return (
    <div className={styles.container}>
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={isToastVisible}
        onClose={() => setIsToastVisible(false)}
      />

      {isNewTicketModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Create New Ticket</h2>
              <button onClick={() => setIsNewTicketModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>Subject</label>
                <input 
                  type="text" 
                  placeholder="Summarize your concern" 
                  value={newTicketData.subject}
                  onChange={(e) => setNewTicketData({ ...newTicketData, subject: e.target.value })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className={styles.formGroup}>
                  <label>Category</label>
                  <select 
                    value={newTicketData.category}
                    onChange={(e) => setNewTicketData({ ...newTicketData, category: e.target.value })}
                  >
                    <option>Billing Inquiry</option>
                    <option>Maintenance Request</option>
                    <option>Security Concern</option>
                    <option>Complaints</option>
                    <option>General Inquiry</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Priority</label>
                  <select 
                    value={newTicketData.priority}
                    onChange={(e) => setNewTicketData({ ...newTicketData, priority: e.target.value })}
                  >
                    <option>Low</option>
                    <option>Normal</option>
                    <option>High</option>
                    <option>Urgent</option>
                  </select>
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Message</label>
                <textarea 
                  rows={4} 
                  placeholder="Explain your concern in detail..."
                  value={newTicketData.message}
                  onChange={(e) => setNewTicketData({ ...newTicketData, message: e.target.value })}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setIsNewTicketModalOpen(false)}>Cancel</button>
              <button className={styles.submitBtn} onClick={handleCreateTicket}>Submit Ticket</button>
            </div>
          </div>
        </div>
      )}

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
                <h1 className={styles.headerTitle}>Help Desk</h1>
                <p className={styles.headerSubtitle}>LH-Connect Support Portal</p>
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
          {/* Left Column - Tickets List */}
          <aside className={styles.sidebar}>
            <div className={styles.filterSection}>
              <button className={styles.newTicketBtn} onClick={() => setIsNewTicketModalOpen(true)}>
                + Create New Ticket
              </button>
              <select 
                className={styles.filterSelect}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Tickets</option>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <div className={styles.messagesList}>
              {filteredMessages.length === 0 ? (
                <div className={styles.emptyState}>No tickets found.</div>
              ) : (
                filteredMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`${styles.messageItem} ${
                      selectedMessage === message.id ? styles.active : ''
                    }`}
                    onClick={() => setSelectedMessage(message.id)}
                  >
                    <div className={styles.messageContent}>
                      <span className={styles.ticketId}>{message.ticketId}</span>
                      <h3 className={styles.messageTitle}>{message.title}</h3>
                      <p className={styles.messageDate}>{message.date}</p>
                      <span className={`${styles.priorityLabel} ${styles[message.priority.toLowerCase()]}`}>
                        {message.priority} Priority
                      </span>
                    </div>
                    <span className={`${styles.statusBadge} ${styles[message.ticketStatus.replace(' ', '').toLowerCase()]}`}>
                      {message.ticketStatus}
                    </span>
                  </div>
                ))
              )}
            </div>
          </aside>

          {/* Right Column - Ticket Conversation */}
          <section className={styles.conversationSection}>
            {currentMessage ? (
              <>
                <div className={styles.conversationHeader}>
                  <div className={styles.conversationTop}>
                    <h2 className={styles.conversationTitle}>{currentMessage.title}</h2>
                    <span className={`${styles.statusBadge} ${styles[currentMessage.ticketStatus.replace(' ', '').toLowerCase()]}`}>
                      {currentMessage.ticketStatus}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.85rem' }}>
                    <span style={{ color: '#64748b' }}>ID: <strong>{currentMessage.ticketId}</strong></span>
                    <span style={{ color: '#64748b' }}>Category: <strong>{currentMessage.category}</strong></span>
                    <span style={{ color: '#64748b' }}>Date: <strong>{currentMessage.date}</strong></span>
                  </div>
                </div>

                <div className={styles.messagesThread}>
                  {currentConversation.map((msg) => (
                    <div
                      key={msg.id}
                      className={`${styles.chatBubble} ${
                        msg.sender === 'You' ? styles.userBubble : styles.adminBubble
                      }`}
                    >
                      <div className={styles.bubbleHeader}>
                        <strong>{msg.sender}</strong>
                        <span className={styles.bubbleTime}>{msg.timestamp}</span>
                      </div>
                      <div className={styles.bubbleBody}>{msg.content}</div>
                    </div>
                  ))}
                  {currentConversation.length === 0 && (
                    <div className={styles.chatBubble} style={{ alignSelf: 'flex-start', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1B2A4A' }}>
                       <div className={styles.bubbleHeader}><strong>HOA Support</strong></div>
                       <div className={styles.bubbleBody}>{currentMessage.preview}</div>
                    </div>
                  )}
                </div>

                {currentMessage.ticketStatus !== 'Closed' && (
                  <div className={styles.replySection}>
                    <h3 className={styles.replyTitle}>Send Message</h3>
                    <textarea
                      className={styles.replyInput}
                      placeholder="Type your message here..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={4}
                    />
                    <button className={styles.sendBtn} onClick={handleSendReply}>
                      ✉ Send Reply
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                <span style={{ fontSize: '3rem', opacity: 0.3 }}>📬</span>
                <p>Select a ticket to view conversation</p>
              </div>
            )}
          </section>
        </div>

        <div className={styles.infoBox}>
          <div className={styles.infoIcon}>🛡️</div>
          <div className={styles.infoContent}>
            <h3 className={styles.infoTitle}>Official Help Desk</h3>
            <p className={styles.infoText}>
              All conversations are logged for quality and security purposes. Our support team typically 
              responds within 24 business hours. For urgent emergencies, please contact local authorities.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
