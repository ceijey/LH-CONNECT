'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiCall } from '@/lib/api-client';
import { useMessages, type MessageThread } from '@/lib/useMessages';
import ChatBox, { type ChatConversationItem, type ChatThreadItem } from '@/app/components/ChatBox';
import Toast from '@/app/components/Toast';

type ReadStatus = 'Unread' | 'Read';

const formatCombinedTimestamp = (date?: string, time?: string) => {
  const trimmedDate = String(date ?? '').trim();
  const trimmedTime = String(time ?? '').trim();

  if (!trimmedDate && !trimmedTime) {
    return '';
  }

  return [trimmedDate, trimmedTime].filter(Boolean).join(' ');
};

const normalizeConversation = (message: MessageThread): ChatConversationItem[] => {
  const replies = Array.isArray(message.replies) && message.replies.length > 0 ? message.replies : [
    {
      id: message.id,
      senderName: message.from,
      senderRole: 'resident',
      message: message.message,
      date: message.date,
      time: message.time,
    },
  ];

  return replies.map((reply: any, index) => {
    const senderRole = String(reply.senderRole ?? '').toLowerCase();

    return {
      id: String(reply.id ?? `${message.id}-${index}`),
      sender: senderRole === 'admin' ? String(reply.senderName ?? 'HOA Admin') : String(reply.senderName ?? message.from ?? 'Resident'),
      content: String(reply.message ?? ''),
      timestamp: formatCombinedTimestamp(reply.date, reply.time),
      align: senderRole === 'admin' ? 'right' : 'left',
    };
  });
};

export default function AdminMessages() {
  const router = useRouter();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [readMessageIds, setReadMessageIds] = useState<string[]>([]);

  const adminId = typeof window !== 'undefined' ? localStorage.getItem('userId') || '' : '';
  const { messages, isLoading, error } = useMessages(adminId, 'admin');

  const displayMessages = useMemo(() => {
    const readSet = new Set(readMessageIds);

    return messages.map((message) => ({
      ...message,
      status: readSet.has(message.id) ? 'Read' : (message.status as ReadStatus),
    }));
  }, [messages, readMessageIds]);

  useEffect(() => {
    if (!selectedThreadId && displayMessages.length > 0) {
      setSelectedThreadId(displayMessages[0].id);
      return;
    }

    if (selectedThreadId && !displayMessages.some((message) => message.id === selectedThreadId) && displayMessages.length > 0) {
      setSelectedThreadId(displayMessages[0].id);
    }
  }, [displayMessages, selectedThreadId]);

  const selectedThread = useMemo(
    () => displayMessages.find((message) => message.id === selectedThreadId) ?? null,
    [displayMessages, selectedThreadId],
  );

  const threads: ChatThreadItem[] = useMemo(() => {
    return displayMessages.map((message) => ({
      id: message.id,
      title: message.subject || 'New message',
      meta: `From ${message.from} • Blk ${message.block} - Lot ${message.lot}`,
      preview: message.message,
      timestamp: formatCombinedTimestamp(message.date, message.time),
      status: message.status,
      unread: message.status === 'Unread',
    }));
  }, [displayMessages]);

  const conversation: ChatConversationItem[] = useMemo(() => {
    if (!selectedThread) {
      return [];
    }

    return normalizeConversation(selectedThread);
  }, [selectedThread]);

  const markMessageAsRead = async (messageId: string) => {
    const target = displayMessages.find((message) => message.id === messageId);

    if (!target || target.status === 'Read') {
      return;
    }

    try {
      await apiCall(`/api/messages/${messageId}`, { method: 'PATCH' });
      setReadMessageIds((current) => (current.includes(messageId) ? current : [...current, messageId]));
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setIsToastVisible(true);
  };

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    void markMessageAsRead(threadId);
  };

  const handleSendReply = async () => {
    const trimmedReply = replyText.trim();

    if (!selectedThread?.senderId) {
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
          subject: `Re: ${selectedThread.subject}`,
          message: trimmedReply,
          recipientId: selectedThread.senderId,
          recipientRole: 'resident',
          to: selectedThread.from,
          priority: selectedThread.priority ?? 'Normal',
          threadId: selectedThread.id,
        }),
      });

      if (response?.message?.id) {
        setSelectedThreadId(String(response.message.id));
      }

      setReplyText('');
      showToast('Reply sent successfully.', 'success');
    } catch (error) {
      console.error('Failed to send reply:', error);
      showToast('Failed to send reply. Please try again.', 'error');
    }
  };

  const handleMarkSelectedRead = () => {
    if (selectedThreadId) {
      void markMessageAsRead(selectedThreadId);
    }
  };

  return (
    <>
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={isToastVisible}
        onClose={() => setIsToastVisible(false)}
      />
      <div style={{ padding: '1.5rem', background: '#f3f6fb', minHeight: '100vh' }}>
        <ChatBox
          title="Messages"
          subtitle="Resident inbox"
          threads={threads}
          selectedThreadId={selectedThreadId}
          onSelectThread={handleSelectThread}
          conversation={conversation}
          replyValue={replyText}
          onReplyChange={setReplyText}
          onSendReply={handleSendReply}
          sendLabel="Send Reply"
          secondaryActionLabel="Mark as Read"
          onSecondaryAction={handleMarkSelectedRead}
          isLoading={isLoading}
          error={error}
          emptyMessage="No messages yet. Residents can send messages via the Contact HOA form."
          composerPlaceholder="Type a reply to the resident..."
        />
      </div>
    </>
  );
}
