'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { apiCall } from '@/lib/api-client';
import { useMessages, type MessageThread } from '@/lib/useMessages';
import { logoutAndRedirect } from '@/lib/auth-session';
import { useAuthPageshow } from '@/lib/useAuthPageshow';
import ChatBox, { type ChatConversationItem, type ChatThreadItem } from '@/app/components/ChatBox';
import Toast from '@/app/components/Toast';
import { compressImageToBase64 } from '@/lib/image-compress';
import styles from './contact-hoa.module.css';

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
      imageUrl: (message as any).imageUrl,
    },
  ];

  return replies.map((reply: any, index) => {
    const senderRole = String(reply.senderRole ?? '').toLowerCase();

    return {
      id: String(reply.id ?? `${message.id}-${index}`),
      sender: senderRole === 'admin' ? String(reply.senderName ?? 'HOA Admin') : String(reply.senderName ?? 'You'),
      content: String(reply.message ?? ''),
      timestamp: formatCombinedTimestamp(reply.date, reply.time),
      align: senderRole === 'resident' ? 'right' : 'left',
      imageUrl: reply.imageUrl,
    };
  });
};

export default function ContactHOAPage() {
  const router = useRouter();
  useAuthPageshow('resident');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  const residentId = typeof window !== 'undefined' ? localStorage.getItem('userId') || '' : '';
  const { messages, isLoading, error } = useMessages(residentId, 'resident');

  useEffect(() => {
    if (!selectedThreadId && messages.length > 0) {
      setSelectedThreadId(messages[0].id);
      return;
    }

    if (selectedThreadId && !messages.some((message) => message.id === selectedThreadId) && messages.length > 0) {
      setSelectedThreadId(messages[0].id);
    }
  }, [messages, selectedThreadId]);

  const selectedThread = useMemo(
    () => messages.find((message) => message.id === selectedThreadId) ?? null,
    [messages, selectedThreadId],
  );

  const threads: ChatThreadItem[] = useMemo(() => {
    return messages.map((message) => ({
      id: message.id,
      title: message.subject || 'New HOA message',
      meta: message.senderName ? `From ${message.senderName}` : 'Direct HOA conversation',
      preview: message.message,
      timestamp: formatCombinedTimestamp(message.date, message.time),
      status: message.status,
      unread: message.status === 'Unread',
    }));
  }, [messages]);

  const conversation: ChatConversationItem[] = useMemo(() => {
    if (!selectedThread) {
      return [];
    }

    return normalizeConversation(selectedThread);
  }, [selectedThread]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setIsToastVisible(true);
  };

  const handleSendReply = async () => {
    const trimmedReply = replyText.trim();

    if (!trimmedReply && !selectedImage) {
      showToast('Type a message or attach an image before sending.', 'error');
      return;
    }

    try {
      let fileBase64 = undefined;
      let fileName = undefined;
      if (selectedImage) {
        showToast('Compressing and preparing image...', 'info');
        fileBase64 = await compressImageToBase64(selectedImage);
        fileName = selectedImage.name;
      }

      const subject = selectedThread?.subject ?? 'New HOA Message';
      await apiCall('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          subject,
          message: trimmedReply,
          recipientId: 'admin',
          recipientRole: 'admin',
          to: 'HOA Admin',
          priority: 'Normal',
          threadId: selectedThread?.id,
          fileBase64,
          fileName,
        }),
      });

      setReplyText('');
      setSelectedImage(null);
      showToast('Your message has been sent.', 'success');
    } catch (error) {
      console.error('Failed to send reply:', error);
      showToast('Failed to send message. Please try again.', 'error');
    }
  };

  return (
    <div className={styles.container}>
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={isToastVisible}
        onClose={() => setIsToastVisible(false)}
      />

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

      <main className={styles.main}>
        <ChatBox
          title="Your Messages"
          subtitle="Message the HOA and see responses instantly"
          threads={threads}
          selectedThreadId={selectedThreadId}
          onSelectThread={setSelectedThreadId}
          conversation={conversation}
          replyValue={replyText}
          onReplyChange={setReplyText}
          onSendReply={handleSendReply}
          sendLabel="Send Message"
          isLoading={isLoading}
          error={error}
          emptyMessage="No messages yet. Use the form to send a message to the HOA."
          composerPlaceholder="Type your message to the HOA..."
          selectedImage={selectedImage}
          onImageSelect={setSelectedImage}
        />

        <div className={styles.infoBox}>
          <div className={styles.infoIcon}>💬</div>
          <div className={styles.infoContent}>
            <h3 className={styles.infoTitle}>Direct Communication with HOA</h3>
            <p className={styles.infoText}>
              Use this messenger to ask questions about your monthly dues, payment status, community announcements,
              or any concerns. Our HOA officers typically respond within 24 hours during business days.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
