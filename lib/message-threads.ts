type AnyRecord = Record<string, any>;

const normalizeText = (value: unknown) => String(value ?? '').trim().toLowerCase();

const normalizeSubject = (value: unknown) => {
  const raw = String(value ?? '').trim();
  const hasReplyPrefix = /^\s*(re\s*:\s*)+/i.test(raw);
  const base = raw.replace(/^\s*(re\s*:\s*)+/i, '').trim();

  if (!base) return 'Message';

  return hasReplyPrefix ? `Re: ${base}` : base;
};

const toMillis = (value: unknown) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === 'object' && value !== null && typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  const parsed = new Date(String(value)).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const isUnreadMessage = (message: AnyRecord) => {
  const status = normalizeText(message?.status);
  const read = message?.read;

  if (typeof read === 'boolean') {
    return !read;
  }

  return status === 'unread' || status === 'new';
};

const buildParticipantKey = (message: AnyRecord) => {
  const sender = normalizeText(message?.senderId ?? message?.from ?? message?.senderName ?? 'sender');
  const recipient = normalizeText(message?.recipientId ?? message?.to ?? 'recipient');
  return [sender, recipient].sort().join('::');
};

const buildThreadKey = (message: AnyRecord) => {
  const explicitThreadId = normalizeText(message?.threadId ?? message?.id);
  if (explicitThreadId) {
    return `thread:${explicitThreadId}`;
  }

  const subject = normalizeText(String(message?.subject ?? message?.title ?? '').replace(/^re:\s*/i, ''));
  const block = normalizeText(message?.block);
  const lot = normalizeText(message?.lot);
  return [buildParticipantKey(message), subject, block, lot].filter(Boolean).join('::');
};

const parseOrCreateTimestamp = (createdAt: unknown, fallback: string): string => {
  if (!createdAt && !fallback) {
    return new Date().toISOString();
  }

  const str = String(createdAt || fallback);
  if (str.includes('T')) {
    return str;
  }

  try {
    return new Date(str).toISOString();
  } catch {
    return new Date().toISOString();
  }
};

const extractReplies = (message: AnyRecord) => {
  if (Array.isArray(message?.replies) && message.replies.length > 0) {
    return message.replies.map((reply: AnyRecord, index: number) => {
      const fallbackTime = `${reply.date ?? ''} ${reply.time ?? ''}`.trim();
      const createdAt = parseOrCreateTimestamp(reply.createdAt, fallbackTime);

      return {
        id: String(reply.id ?? `${message.id}-reply-${index}`),
        senderId: reply.senderId,
        senderName: reply.senderName,
        senderRole: reply.senderRole,
        message: String(reply.message ?? ''),
        date: String(reply.date ?? ''),
        time: String(reply.time ?? ''),
        createdAt,
      };
    });
  }

  const fallbackTime = `${message.date ?? ''} ${message.time ?? ''}`.trim();
  const createdAt = parseOrCreateTimestamp(message.updatedAt ?? message.createdAt, fallbackTime);

  return [{
    id: String(message.id),
    senderId: message.senderId,
    senderName: message.senderName ?? message.from,
    senderRole: message.senderRole ?? (normalizeText(message.recipientRole) === 'admin' ? 'admin' : 'resident'),
    message: String(message.message ?? message.preview ?? ''),
    date: String(message.date ?? ''),
    time: String(message.time ?? ''),
    createdAt,
  }];
};

export function groupMessagesIntoThreads(messages: AnyRecord[] = []) {
  const grouped = new Map<string, AnyRecord[]>();

  for (const message of messages) {
    const key = buildThreadKey(message);
    const current = grouped.get(key) ?? [];
    current.push(message);
    grouped.set(key, current);
  }

  return Array.from(grouped.entries())
    .map(([threadKey, threadMessages]) => {
      const sorted = [...threadMessages].sort((a, b) => toMillis(a.updatedAt ?? a.createdAt ?? a.date) - toMillis(b.updatedAt ?? b.createdAt ?? b.date));
      const latest = sorted[sorted.length - 1] ?? {};
      const replies = sorted.flatMap((message) => extractReplies(message));
      const uniqueReplies = Array.from(
        new Map(replies.map((reply) => [
          `${reply.senderId ?? ''}|${reply.senderName ?? ''}|${reply.createdAt ?? ''}|${reply.date ?? ''}|${reply.time ?? ''}|${reply.message ?? ''}`,
          reply,
        ])).values(),
      ).sort((a, b) => {
        const left = toMillis(a.createdAt ?? `${a.date} ${a.time}`);
        const right = toMillis(b.createdAt ?? `${b.date} ${b.time}`);
        return left - right;
      });

      const unread = sorted.some((message) => isUnreadMessage(message));

      return {
        id: String(latest.threadId ?? latest.id ?? threadKey),
        threadId: String(latest.threadId ?? latest.id ?? threadKey),
        senderId: latest.senderId,
        senderName: latest.senderName ?? latest.from,
        from: latest.from ?? latest.senderName ?? 'Unknown',
        to: latest.to ?? latest.recipientId ?? 'admin',
        recipientId: latest.recipientId,
        recipientRole: latest.recipientRole,
        block: latest.block ?? '',
        lot: latest.lot ?? '',
        phase: latest.phase ?? '',
        subject: normalizeSubject(latest.subject ?? latest.title ?? 'Message'),
        date: latest.date ?? '',
        time: latest.time ?? '',
        message: latest.message ?? latest.preview ?? '',
        preview: latest.preview ?? String(latest.message ?? '').slice(0, 120),
        status: unread ? 'Unread' : 'Read',
        priority: latest.priority ?? 'Normal',
        read: !unread,
        createdAt: latest.createdAt ?? latest.updatedAt ?? latest.date ?? '',
        updatedAt: latest.updatedAt ?? latest.createdAt ?? latest.date ?? '',
        replies: uniqueReplies,
        threadKey,
      };
    })
    .sort((a, b) => toMillis(b.updatedAt ?? b.createdAt ?? b.date) - toMillis(a.updatedAt ?? a.createdAt ?? a.date));
}

export function countUnreadThreads(messages: AnyRecord[] = []) {
  return groupMessagesIntoThreads(messages).filter((message) => isUnreadMessage(message)).length;
}
