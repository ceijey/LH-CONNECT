'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { apiCall } from '@/lib/api-client';

type UnreadMessagesBadgeProps = {
  className?: string;
};

const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '1.5rem',
  height: '1.5rem',
  marginLeft: '0.5rem',
  padding: '0 0.45rem',
  borderRadius: '999px',
  background: '#e53935',
  color: '#fff',
  fontSize: '0.75rem',
  fontWeight: 700,
  lineHeight: 1,
};

export default function UnreadMessagesBadge({ className }: UnreadMessagesBadgeProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;

    const loadCount = async () => {
      try {
        const payload = await apiCall('/api/messages/unread-count');
        if (active) {
          setCount(Number(payload?.unreadCount ?? 0));
        }
      } catch {
        if (active) {
          setCount(0);
        }
      }
    };

    const onMessagesUpdated = () => {
      void loadCount();
    };

    loadCount();
    const interval = window.setInterval(loadCount, 120000);
    window.addEventListener('lh-messages-updated', onMessagesUpdated);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('lh-messages-updated', onMessagesUpdated);
    };
  }, []);

  if (count <= 0) {
    return null;
  }

  return (
    <span className={className} style={badgeStyle} aria-label={`${count} unread messages`}>
      {count > 9 ? '9+' : count}
    </span>
  );
}