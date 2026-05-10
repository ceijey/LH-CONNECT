import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedUser, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';
import { groupMessagesIntoThreads } from '@/lib/message-threads';

const formatTimestamp = (date: Date) => {
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return {
    date: date.toLocaleDateString(),
    time,
  };
};

const buildReply = (
  messageText: string,
  senderId: string,
  senderName: string,
  senderRole: string,
  date: string,
  time: string,
  createdAt: string,
) => {
  const isoCreatedAt = createdAt && createdAt.includes('T') ? createdAt : new Date(createdAt).toISOString();
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    senderId,
    senderName,
    senderRole,
    message: messageText,
    date,
    time,
    createdAt: isoCreatedAt,
  };
};

const normalizeSubject = (value: unknown) => {
  const raw = String(value ?? '').trim();
  const hasReplyPrefix = /^\s*(re\s*:\s*)+/i.test(raw);
  const base = raw.replace(/^\s*(re\s*:\s*)+/i, '').trim();

  if (!base) {
    return '';
  }

  return hasReplyPrefix ? `Re: ${base}` : base;
};

export async function GET(request: NextRequest) {
  const tokenVerification = await requireApprovedUser(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const decoded = tokenVerification.decoded!;
  const userId = decoded.uid;

  try {
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData) {
      return createErrorResponse('User not found', 404);
    }

    const userRole = userData.role;
    let messagesSnapshot;

    if (userRole === 'admin') {
      // Admins see all tickets — simple collection fetch, sorted client-side
      messagesSnapshot = await adminDb.collection('messages').get();
    } else {
      // Residents see only their own tickets
      // NOTE: Avoid compound where+orderBy queries to prevent requiring Firestore composite indexes
      messagesSnapshot = await adminDb.collection('messages')
        .where('senderId', '==', userId)
        .get();
    }

    const messages = (messagesSnapshot.docs || [])
      .map((doc: any) => ({ id: doc.id, ...doc.data() }))
      // Sort by updatedAt client-side (most recent first)
      .sort((a: any, b: any) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bTime - aTime;
      });

    return NextResponse.json({ messages, user: decoded });
  } catch (error: any) {
    // Log the full error detail so server logs show the real cause
    console.error('Error fetching messages:', error?.message || error?.code || String(error));
    return createErrorResponse('Internal server error', 500);
  }
}

export async function POST(request: NextRequest) {
  const tokenVerification = await requireApprovedUser(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const decoded = tokenVerification.decoded!;

  try {
    const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
    const userData = userDoc.data();

    if (!userData) {
      return createErrorResponse('User not found', 404);
    }

    const body = await request.json().catch(() => ({}));
    const messageText = String(body.message ?? '').trim();
    const subjectText = String(body.subject ?? '').trim();
    const recipientId = String(body.recipientId ?? '').trim() || 'admin';
    const priority = String(body.priority ?? 'Normal').trim();
    const category = String(body.category ?? 'General').trim();
    const threadId = String(body.threadId ?? '').trim();

    if (!messageText) {
      return createErrorResponse('Message is required', 400);
    }

    const senderName = String(userData.fullName ?? userData.name ?? decoded.uid).trim();
    const senderRole = String(userData.role ?? 'resident').toLowerCase();
    const now = new Date();
    const { date, time } = formatTimestamp(now);
    const reply = buildReply(messageText, decoded.uid, senderName, senderRole, date, time, now.toISOString());

    if (threadId) {
      const threadRef = adminDb.collection('messages').doc(threadId);
      const threadDoc = await threadRef.get();

      if (!threadDoc.exists) {
        return createErrorResponse('Ticket not found', 404);
      }

      const existingData = threadDoc.data() || {};
      const updatedReplies = [...(existingData.replies || []), reply];

      await threadRef.update({
        replies: updatedReplies,
        updatedAt: now.toISOString(),
        status: senderRole === 'admin' ? 'Replied' : 'New',
        lastMessage: messageText.slice(0, 100),
        read: false
      });

      return NextResponse.json({ message: { id: threadId, ...existingData, replies: updatedReplies } });
    }

    // Generate readable Ticket ID
    const ticketCountDoc = await adminDb.collection('metadata').doc('ticket_counter').get();
    let nextId = 1001;
    if (ticketCountDoc.exists) {
      nextId = (ticketCountDoc.data()?.count || 1000) + 1;
    }
    await adminDb.collection('metadata').doc('ticket_counter').set({ count: nextId }, { merge: true });
    
    const ticketId = `#TKT-${nextId}`;

    const messagePayload = {
      ticketId,
      senderId: decoded.uid,
      senderName,
      recipientId,
      recipientRole: recipientId === 'admin' ? 'admin' : 'resident',
      subject: subjectText || `Ticket: ${category}`,
      category,
      priority,
      status: 'New', // UI status
      ticketStatus: 'Open', // Workflow status
      message: messageText,
      preview: messageText.slice(0, 120),
      replies: [reply],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      read: false,
      date,
      time,
      phase: userData.phase || '',
      block: userData.block || '',
      lot: userData.lot || '',
    };

    const ref = adminDb.collection('messages').doc();
    await ref.set({ ...messagePayload, id: ref.id });

    if (recipientId === 'admin') {
      await adminDb.collection('admin_notifications').add({
        type: 'new_ticket',
        title: `New Ticket ${ticketId}`,
        message: `${senderName}: ${messageText.slice(0, 50)}`,
        residentId: decoded.uid,
        residentName: senderName,
        threadId: ref.id,
        read: false,
        createdAt: now,
      });
    }

    return NextResponse.json({ message: { id: ref.id, ...messagePayload } }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating ticket:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

export async function PATCH(request: NextRequest) {
  const tokenVerification = await requireApprovedUser(request);
  if (tokenVerification.error) return createErrorResponse(tokenVerification.error, tokenVerification.status);

  try {
    const { threadId, ticketStatus, priority, category } = await request.json();
    if (!threadId) return createErrorResponse('Thread ID is required', 400);

    const updateData: any = { updatedAt: new Date().toISOString() };
    if (ticketStatus) updateData.ticketStatus = ticketStatus;
    if (priority) updateData.priority = priority;
    if (category) updateData.category = category;

    await adminDb.collection('messages').doc(threadId).update(updateData);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return createErrorResponse(error.message, 500);
  }
}
