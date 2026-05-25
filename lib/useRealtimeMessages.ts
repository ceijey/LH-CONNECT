import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';
import { apiCall } from '@/lib/api-client';

export interface MessageThread {
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
  replies?: any[];
  threadId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function useRealtimeMessages(userId: string, role: 'admin' | 'resident') {
  const [messages, setMessages] = useState<MessageThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    let eventSource: EventSource | null = null;

    const fetchMessages = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const payload = await apiCall('/api/messages');
        if (!isActive) return;
        const items = Array.isArray(payload.messages) ? payload.messages : [];

        items.sort((a: MessageThread, b: MessageThread) => {
          const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return bTime - aTime;
        });

        setMessages(items);
      } catch (err: any) {
        console.error('Error fetching messages via API:', err);
        if (isActive) setError(err.message || String(err));
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    // Listen for auth changes and then fetch initial messages + subscribe to SSE
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      // Only proceed when there is an active authenticated user
      if (!firebaseUser && !userId) {
        setMessages([]);
        setIsLoading(false);
        return;
      }

      void fetchMessages();

      try {
        // Subscribe to server-sent events for live updates
        eventSource = new EventSource('/api/messages/subscribe');

        eventSource.addEventListener('message', (ev: MessageEvent) => {
          try {
            const data = JSON.parse(ev.data || '{}');
            if (data && data.type === 'message_update') {
              void fetchMessages();
            }
          } catch (e) {
            // ignore malformed SSE payloads
          }
        });

        eventSource.addEventListener('error', (err) => {
          console.warn('SSE connection error for messages:', err);
          // On error, attempt to re-fetch once
          void fetchMessages();
        });
      } catch (sseErr) {
        console.warn('Failed to initialize SSE for messages:', sseErr);
      }
    });

    return () => {
      isActive = false;
      unsubscribeAuth();
      if (eventSource) {
        try { eventSource.close(); } catch (_) {}
      }
    };
  }, [userId, role]);

  return { messages, isLoading, error };
}
