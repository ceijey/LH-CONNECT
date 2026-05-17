import { useRealtimeMessages, type MessageThread } from '@/lib/useRealtimeMessages';

export type { MessageThread };

export function useMessages(userId: string, role: 'admin' | 'resident') {
  return useRealtimeMessages(userId, role);
}
