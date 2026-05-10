'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiCall } from '@/lib/api-client';
import Toast from '@/app/components/Toast';
import LoadingScreen from '@/app/components/LoadingScreen';
import styles from '../residents/admin-page.module.css';
import messengerStyles from './messenger.module.css';

interface Message {
  id: string;
  ticketId: string;
  senderId?: string;
  senderName?: string;
  from: string;
  block: string;
  lot: string;
  subject: string;
  date: string;
  time: string;
  message: string;
  status: 'Unread' | 'Read' | 'Replied';
  ticketStatus: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  category: string;
  priority: 'High' | 'Normal' | 'Low' | 'Urgent';
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
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [filterStatus, setFilterStatus] = useState('All');

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setIsToastVisible(true);
  };

  const filteredMessages = messages.filter(m => 
    filterStatus === 'All' || m.ticketStatus === filterStatus
  );

  const updateTicketStatus = async (status: string) => {
    if (!selectedMessage) return;
    try {
      await apiCall('/api/messages', {
        method: 'PATCH',
        body: JSON.stringify({ threadId: selectedMessage.id, ticketStatus: status })
      });
      setMessages(current => current.map(m => 
        m.id === selectedMessage.id ? { ...m, ticketStatus: status as any } : m
      ));
      setSelectedMessage(prev => prev ? { ...prev, ticketStatus: status as any } : null);
      showToast(`Ticket status updated to ${status}`, 'success');
    } catch (error) {
      showToast('Failed to update status', 'error');
    }
  };

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
          subject: selectedMessage.subject,
          message: trimmedReply,
          recipientId: selectedMessage.senderId,
          recipientRole: 'resident',
          to: selectedMessage.from,
          priority: selectedMessage.priority,
          threadId: selectedMessage.id,
        }),
      });

      const updatedMessage = response?.message;

      if (updatedMessage) {
        setMessages((current) =>
          current.map((message) =>
            message.id === updatedMessage.id ? { ...updatedMessage, ticketStatus: message.ticketStatus } : message,
          ),
        );
        setSelectedMessage({ ...updatedMessage, ticketStatus: selectedMessage.ticketStatus });
      }

      setReplyText('');
      showToast('Reply sent successfully.', 'success');
    } catch (error) {
      console.error('Failed to send reply:', error);
      showToast('Failed to send reply. Please try again.', 'error');
    }
  };

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setIsLoading(true);
        const res = await apiCall('/api/messages');
        setMessages(res?.messages ?? []);
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMessages();
  }, []);

  if (isLoading) return <LoadingScreen message="Loading help desk..." />;

  return (
    <>
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={isToastVisible}
        onClose={() => setIsToastVisible(false)}
      />
      
      <div className={messengerStyles.messengerContainer}>
          <div className={messengerStyles.messagesList}>
            <div className={messengerStyles.messagesHeader}>
              <h2>Ticketing</h2>
              <select 
                className={messengerStyles.filterSelect}
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="All">All Status</option>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
            <div className={messengerStyles.messageThreads}>
              {filteredMessages.length === 0 ? (
                <div className={messengerStyles.emptyState}>No tickets found.</div>
              ) : (
                filteredMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`${messengerStyles.messageThread} ${selectedMessage?.id === msg.id ? messengerStyles.active : ''}`}
                    onClick={() => setSelectedMessage(msg)}
                  >
                    <div className={messengerStyles.threadTop}>
                      <span className={messengerStyles.ticketId}>{msg.ticketId}</span>
                      <span className={`${messengerStyles.priorityBadge} ${messengerStyles[msg.priority?.toLowerCase()]}`}>
                        {msg.priority}
                      </span>
                    </div>
                    <div className={messengerStyles.threadName}>{msg.from}</div>
                    <div className={messengerStyles.threadSubject}>{msg.subject}</div>
                    <div className={messengerStyles.threadBottom}>
                      <span className={`${messengerStyles.statusLabel} ${messengerStyles[msg.ticketStatus?.replace(' ', '').toLowerCase()]}`}>
                        {msg.ticketStatus}
                      </span>
                      <span className={messengerStyles.threadTime}>{msg.date}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={messengerStyles.messageDetail}>
            {selectedMessage ? (
              <>
                <div className={messengerStyles.detailHeader}>
                  <div className={messengerStyles.detailHeaderTitle}>
                    <span className={messengerStyles.detailTicketId}>{selectedMessage.ticketId}</span>
                    <h3>{selectedMessage.subject}</h3>
                  </div>
                  <div className={messengerStyles.statusToolbar}>
                    <button onClick={() => updateTicketStatus('Open')} className={selectedMessage.ticketStatus === 'Open' ? messengerStyles.activeStatus : ''}>Open</button>
                    <button onClick={() => updateTicketStatus('In Progress')} className={selectedMessage.ticketStatus === 'In Progress' ? messengerStyles.activeStatus : ''}>In Progress</button>
                    <button onClick={() => updateTicketStatus('Resolved')} className={selectedMessage.ticketStatus === 'Resolved' ? messengerStyles.activeStatus : ''}>Resolved</button>
                    <button onClick={() => updateTicketStatus('Closed')} className={selectedMessage.ticketStatus === 'Closed' ? messengerStyles.activeStatus : ''}>Closed</button>
                  </div>
                </div>
                <div className={messengerStyles.detailMeta}>
                  <span><strong>Resident:</strong> {selectedMessage.from} • Blk {selectedMessage.block} - Lot {selectedMessage.lot}</span>
                  <span><strong>Category:</strong> {selectedMessage.category}</span>
                </div>
                
                <div className={messengerStyles.messageContent}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {selectedMessage.replies?.map((reply) => {
                      const isAdminReply = String(reply.senderRole ?? '').toLowerCase() === 'admin';
                      return (
                        <div
                          key={reply.id}
                          className={`${messengerStyles.chatBubble} ${isAdminReply ? messengerStyles.adminBubble : messengerStyles.residentBubble}`}
                        >
                          <div className={messengerStyles.bubbleHeader}>
                            {isAdminReply ? 'HOA Admin' : (reply.senderName ?? selectedMessage.from)}
                            <span className={messengerStyles.bubbleTime}>{reply.date} {reply.time}</span>
                          </div>
                          <div className={messengerStyles.bubbleBody}>{reply.message}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className={messengerStyles.replySection}>
                  <textarea
                    placeholder="Type your reply to the resident..."
                    className={messengerStyles.replyText}
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                  ></textarea>
                  <div className={messengerStyles.replyButtons}>
                    <button className={messengerStyles.sendBtn} onClick={() => void handleSendReply()}>✈ Send Message</button>
                  </div>
                </div>
              </>
            ) : (
              <div className={messengerStyles.noSelected}>
                <div className={messengerStyles.noSelectedIcon}>📩</div>
                <p>Select a ticket to view conversation</p>
              </div>
            )}
        </div>
      </div>
    </>
  );
}
