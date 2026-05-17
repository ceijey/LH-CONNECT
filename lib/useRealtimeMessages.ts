import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase-client';

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
    if (!db) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    let unsubscribeAuth = () => {};
    let unsubscribeMessages = () => {};
    let isActive = true;

    const setSortedMessages = (items: MessageThread[]) => {
      items.sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      });

      setMessages(items);
      setIsLoading(false);
    };

    const handleError = (err: { message: string }) => {
      console.error('Error listening to messages:', err);
      setError(err.message);
      setIsLoading(false);
    };

    unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      unsubscribeMessages();

      if (!isActive) {
        return;
      }

      const activeUserId = firebaseUser?.uid || userId;

      if (!firebaseUser || !activeUserId) {
        setMessages([]);
        setIsLoading(false);
        return;
      }

      try {
        const messagesRef = collection(db, 'messages');

        if (role === 'admin') {
          const adminQuery = query(messagesRef);

          unsubscribeMessages = onSnapshot(
            adminQuery,
            (snapshot) => {
              const items: MessageThread[] = [];
              snapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() } as MessageThread);
              });

              setSortedMessages(items);
            },
            handleError,
          );

          return;
        }

        const sentQuery = query(messagesRef, where('senderId', '==', activeUserId));
        const receivedQuery = query(messagesRef, where('recipientId', '==', activeUserId));
        let sentMessages: MessageThread[] = [];
        let receivedMessages: MessageThread[] = [];

        const mergeAndSet = () => {
          const merged = new Map<string, MessageThread>();

          [...sentMessages, ...receivedMessages].forEach((item) => {
            merged.set(item.id, item);
          });

          setSortedMessages(Array.from(merged.values()));
        };

        const unsubscribeSent = onSnapshot(
          sentQuery,
          (snapshot) => {
            sentMessages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as MessageThread));
            mergeAndSet();
          },
          handleError,
        );

        const unsubscribeReceived = onSnapshot(
          receivedQuery,
          (snapshot) => {
            receivedMessages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as MessageThread));
            mergeAndSet();
          },
          handleError,
        );

        unsubscribeMessages = () => {
          unsubscribeSent();
          unsubscribeReceived();
        };
      } catch (err: any) {
        console.error('Error setting up messages listener:', err);
        setError(err.message);
        setIsLoading(false);
      }
    });

    return () => {
      isActive = false;
      unsubscribeAuth();
      unsubscribeMessages();
    };
  }, [userId, role]);

  return { messages, isLoading, error };
}
